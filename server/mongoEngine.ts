import {MongoClient, ObjectId} from 'mongodb';
import type {Document, IndexDirection, Sort} from 'mongodb';
import type {
  AggregationResponse,
  AggregationStage,
  CollectionSummary,
  ConnectionMode,
  ConnectionStatus,
  DatabaseSummary,
  IndexSummary,
  QueryDocumentsResponse,
  SchemaAnalysisResponse,
  SchemaFieldSummary,
  ShellExecuteResponse,
} from '../src/types/mongo.ts';
import {isDateMarker, isObjectIdMarker, parseRelaxedJson} from './jsonParser.ts';
import {createStarterStore, SandboxEngine} from './sandboxEngine.ts';

const DEFAULT_URI = process.env.MONGODB_URI?.trim() || 'mongodb://localhost:27017/';

export function validateMongoUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error('Connection URI cannot be empty');
  }
  if (trimmed.includes('<db_password>')) {
    throw new Error('Replace <db_password> with your MongoDB password before connecting');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid MongoDB URI format');
  }
  if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
    throw new Error('URI must start with mongodb:// or mongodb+srv://');
  }
  return trimmed;
}

export function maskMongoUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return 'mongodb://localhost:27017/';
  }
}

export function validateIdentifier(name: string, label: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) {
    throw new Error(`Invalid ${label} name`);
  }
  if (/[\0/\\$"\s]/.test(trimmed)) {
    throw new Error(`${label} name contains disallowed characters`);
  }
  return trimmed;
}

function toBsonValue(val: unknown): unknown {
  if (isObjectIdMarker(val)) {
    if (!val.value) return new ObjectId();
    if (!ObjectId.isValid(val.value)) {
      throw new Error(`Invalid ObjectId "${val.value}"`);
    }
    return new ObjectId(val.value);
  }
  if (isDateMarker(val)) {
    return new Date(val.value);
  }
  if (Array.isArray(val)) {
    return val.map(toBsonValue);
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = toBsonValue(v);
    }
    return out;
  }
  return val;
}

function serializeBson(val: unknown): unknown {
  if (val instanceof ObjectId) return val.toHexString();
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(serializeBson);
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = serializeBson(v);
    }
    return out;
  }
  return val;
}

function detectBsonType(val: unknown): string {
  if (val === null) return 'Null';
  if (val instanceof ObjectId) return 'ObjectId';
  if (val instanceof Date) return 'Date';
  if (Array.isArray(val)) return 'Array';
  if (typeof val === 'boolean') return 'Boolean';
  if (typeof val === 'number') return Number.isInteger(val) ? 'Int32' : 'Double';
  if (typeof val === 'string') return 'String';
  if (typeof val === 'object') return 'Object';
  return 'Mixed';
}

export class MongoConnectionManager {
  private targetUri = DEFAULT_URI;
  private client: MongoClient | null = null;
  private mode: ConnectionMode = 'sandbox';
  private serverVersion = 'Local Sandbox';
  private lastError: string | null = null;
  private checkedAt = new Date().toISOString();
  private sandbox = new SandboxEngine();
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      this.initialized = true;
      await this.tryConnect(this.targetUri, true);
    }
  }

  async tryConnect(uri: string, fallbackToSandbox = false, enableCompression = false): Promise<ConnectionStatus> {
    const validated = validateMongoUri(uri);
    this.targetUri = validated;
    this.checkedAt = new Date().toISOString();

    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close error
      }
      this.client = null;
    }

    const isSrv = validated.startsWith('mongodb+srv:');
    const timeoutMs = isSrv ? 5000 : 2000;
    const nextClient = new MongoClient(validated, {
      serverSelectionTimeoutMS: timeoutMs,
      connectTimeoutMS: timeoutMs,
      ...(enableCompression ? {compressors: ['zlib']} : {}),
    });

    try {
      await nextClient.connect();
      let version = 'Atlas';
      try {
        const buildInfo = await nextClient.db('admin').command({buildInfo: 1});
        if (buildInfo?.version) version = String(buildInfo.version);
      } catch {
        const hello = await nextClient.db('admin').command({hello: 1}).catch(() => null);
        if (hello?.maxWireVersion) version = 'Atlas';
      }
      this.client = nextClient;
      this.mode = 'live';
      this.serverVersion = version;
      this.lastError = null;
    } catch (err) {
      try {
        await nextClient.close();
      } catch {
        // Ignore cleanup failure
      }
      const msg = err instanceof Error ? err.message : 'Connection refused';
      this.lastError = msg;
      this.mode = 'sandbox';
      this.serverVersion = 'Local Sandbox';
      if (!fallbackToSandbox) {
        return this.getStatus();
      }
    }

    return this.getStatus();
  }

  switchMode(mode: ConnectionMode): ConnectionStatus {
    if (mode === 'live' && !this.client) {
      throw new Error('Live MongoDB client is not connected. Try Reconnect first.');
    }
    this.mode = mode;
    return this.getStatus();
  }

  getStatus(): ConnectionStatus {
    let hostLabel = 'localhost:27017';
    try {
      const u = new URL(this.targetUri);
      hostLabel = u.host || 'localhost:27017';
    } catch {
      hostLabel = 'localhost:27017';
    }

    return {
      mode: this.mode,
      targetUri: maskMongoUri(this.targetUri),
      maskedUri: maskMongoUri(this.targetUri),
      connected: this.mode === 'live' && this.client !== null,
      serverVersion: this.serverVersion,
      hostLabel,
      lastError: this.lastError,
      checkedAt: this.checkedAt,
    };
  }

  async listDatabases(): Promise<DatabaseSummary[]> {
    await this.ensureInitialized();
    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.listDatabases();
    }

    const admin = this.client.db('admin');
    const result = await admin.command({listDatabases: 1});
    const databases: DatabaseSummary[] = [];

    for (const dbInfo of result.databases as Array<{name: string; sizeOnDisk?: number}>) {
      const db = this.client.db(dbInfo.name);
      let colInfos: Array<{name?: string}> = [];
      try {
        colInfos = await db.listCollections().toArray();
      } catch {
        if (dbInfo.name === 'admin' || dbInfo.name === 'local' || dbInfo.name === 'config') {
          continue;
        }
      }
      const collections: CollectionSummary[] = [];

      for (const colInfo of colInfos) {
        if (!colInfo.name || colInfo.name.startsWith('system.')) continue;
        const col = db.collection(colInfo.name);
        const count = await col.estimatedDocumentCount().catch(() => 0);
        const indexes = await col.indexes().catch(() => []);
        collections.push({
          name: colInfo.name,
          count,
          storageSizeBytes: 0,
          avgObjSizeBytes: 0,
          indexCount: indexes.length,
        });
      }

      if ((dbInfo.name === 'admin' || dbInfo.name === 'local' || dbInfo.name === 'config') && collections.length === 0) {
        continue;
      }

      databases.push({
        name: dbInfo.name,
        sizeOnDiskBytes: Number(dbInfo.sizeOnDisk ?? 0),
        collections,
      });
    }

    return databases;
  }

  async seedStarterSchema(): Promise<{seeded: string[]; skipped: string[]}> {
    await this.ensureInitialized();
    const starter = createStarterStore();
    const seeded: string[] = [];
    const skipped: string[] = [];

    if (this.mode === 'sandbox' || !this.client) {
      for (const [dbName, cols] of Object.entries(starter.databases)) {
        for (const [colName, colData] of Object.entries(cols)) {
          const existingDbs = this.sandbox.listDatabases();
          const hasCol = existingDbs.some(
            (d) => d.name === dbName && d.collections.some((c) => c.name === colName && c.count > 0),
          );
          if (hasCol) {
            skipped.push(`${dbName}.${colName}`);
          } else {
            this.sandbox.createDatabaseCollection(dbName, colName);
            for (const doc of colData.documents) {
              try {
                this.sandbox.insertDocument(dbName, colName, JSON.stringify(doc));
              } catch {
                // Ignore duplicate _id
              }
            }
            seeded.push(`${dbName}.${colName}`);
          }
        }
      }
      return {seeded, skipped};
    }

    for (const [dbName, cols] of Object.entries(starter.databases)) {
      if (dbName === 'local' || dbName === 'admin') continue;
      const db = this.client.db(dbName);
      for (const [colName, colData] of Object.entries(cols)) {
        const col = db.collection(colName);
        const existingCount = await col.estimatedDocumentCount().catch(() => 0);
        if (existingCount > 0) {
          skipped.push(`${dbName}.${colName}`);
          continue;
        }
        const docsToInsert = colData.documents.map((d) => {
          const copy: Document = {...d};
          if (typeof copy._id === 'string' && ObjectId.isValid(copy._id)) {
            copy._id = new ObjectId(copy._id);
          }
          if (typeof copy.createdAt === 'string') {
            copy.createdAt = new Date(copy.createdAt);
          }
          if (typeof copy.updatedAt === 'string') {
            copy.updatedAt = new Date(copy.updatedAt);
          }
          if (typeof copy.orderedAt === 'string') {
            copy.orderedAt = new Date(copy.orderedAt);
          }
          if (typeof copy.ts === 'string') {
            copy.ts = new Date(copy.ts);
          }
          return copy;
        });
        if (docsToInsert.length > 0) {
          await col.insertMany(docsToInsert);
        }
        for (const idx of colData.indexes) {
          if (idx.name === '_id_') continue;
          await col
            .createIndex(idx.key as Record<string, IndexDirection>, {unique: idx.unique})
            .catch(() => {});
        }
        seeded.push(`${dbName}.${colName}`);
      }
    }

    return {seeded, skipped};
  }

  async createDatabaseCollection(dbName: string, collectionName: string): Promise<void> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      this.sandbox.createDatabaseCollection(db, collection);
      return;
    }

    await this.client.db(db).createCollection(collection);
  }

  async dropCollection(dbName: string, collectionName: string): Promise<void> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      this.sandbox.dropCollection(db, collection);
      return;
    }

    await this.client.db(db).collection(collection).drop();
  }

  async findDocuments(
    dbName: string,
    collectionName: string,
    filterRaw = '{}',
    projectionRaw = '{}',
    sortRaw = '{}',
    skip = 0,
    limit = 25,
  ): Promise<QueryDocumentsResponse> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');
    const safeSkip = Math.max(0, Math.floor(Number(skip) || 0));
    const safeLimit = Math.min(200, Math.max(1, Math.floor(Number(limit) || 25)));

    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.findDocuments(db, collection, filterRaw, projectionRaw, sortRaw, safeSkip, safeLimit);
    }

    const start = performance.now();
    const filter = toBsonValue(parseRelaxedJson(filterRaw, {})) as Document;
    const projection = toBsonValue(parseRelaxedJson(projectionRaw, {})) as Document;
    const sort = toBsonValue(parseRelaxedJson(sortRaw, {})) as Sort;

    const col = this.client.db(db).collection(collection);
    const [totalCount, docs] = await Promise.all([
      col.countDocuments(filter),
      col.find(filter, {projection}).sort(sort).skip(safeSkip).limit(safeLimit).toArray(),
    ]);

    return {
      documents: docs.map((d) => serializeBson(d) as Record<string, unknown>),
      totalCount,
      executionMs: Math.max(1, Math.round(performance.now() - start)),
      mode: 'live',
    };
  }

  async insertDocument(dbName: string, collectionName: string, docRaw: string): Promise<Record<string, unknown>> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.insertDocument(db, collection, docRaw);
    }

    const parsed = toBsonValue(parseRelaxedJson(docRaw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Document must be a JSON object');
    }
    const doc = {...(parsed as Document)};
    const col = this.client.db(db).collection(collection);
    const res = await col.insertOne(doc);
    return serializeBson({...doc, _id: res.insertedId}) as Record<string, unknown>;
  }

  async updateDocument(
    dbName: string,
    collectionName: string,
    id: string,
    replacementRaw: string,
  ): Promise<Record<string, unknown>> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.updateDocument(db, collection, id, replacementRaw);
    }

    const parsed = toBsonValue(parseRelaxedJson(replacementRaw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Document must be a JSON object');
    }
    const replacement = {...(parsed as Document)};
    delete replacement._id;

    const col = this.client.db(db).collection(collection);
    const idFilter = ObjectId.isValid(id) ? {_id: new ObjectId(id)} : {_id: id as unknown as ObjectId};
    const res = await col.replaceOne(idFilter, replacement);
    if (res.matchedCount === 0) {
      throw new Error(`Document with _id "${id}" not found`);
    }
    return serializeBson({...replacement, _id: idFilter._id}) as Record<string, unknown>;
  }

  async deleteDocument(dbName: string, collectionName: string, id: string): Promise<void> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      this.sandbox.deleteDocument(db, collection, id);
      return;
    }

    const col = this.client.db(db).collection(collection);
    const idFilter = ObjectId.isValid(id) ? {_id: new ObjectId(id)} : {_id: id as unknown as ObjectId};
    const res = await col.deleteOne(idFilter);
    if (res.deletedCount === 0) {
      throw new Error(`Document with _id "${id}" not found`);
    }
  }

  async runAggregation(
    dbName: string,
    collectionName: string,
    stages: AggregationStage[],
  ): Promise<AggregationResponse> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.runAggregation(db, collection, stages);
    }

    const start = performance.now();
    const pipeline: Document[] = [];
    for (const stage of stages) {
      if (!stage.enabled) continue;
      const body = toBsonValue(parseRelaxedJson(stage.body));
      pipeline.push({[stage.operator]: body});
    }

    const col = this.client.db(db).collection(collection);
    const docs = await col.aggregate(pipeline).limit(200).toArray();
    return {
      results: docs.map((d) => serializeBson(d) as Record<string, unknown>),
      executionMs: Math.max(1, Math.round(performance.now() - start)),
      mode: 'live',
    };
  }

  async analyzeSchema(dbName: string, collectionName: string): Promise<SchemaAnalysisResponse> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.analyzeSchema(db, collection);
    }

    const col = this.client.db(db).collection(collection);
    const totalCount = await col.estimatedDocumentCount();
    const sampled = await col.find({}).limit(200).toArray();
    const sampledCount = sampled.length;

    const fieldMap = new Map<
      string,
      {presence: number; typeCounts: Map<string, number>; samples: Set<string>}
    >();

    for (const doc of sampled) {
      for (const [field, val] of Object.entries(doc)) {
        let entry = fieldMap.get(field);
        if (!entry) {
          entry = {presence: 0, typeCounts: new Map(), samples: new Set()};
          fieldMap.set(field, entry);
        }
        entry.presence += 1;
        const t = detectBsonType(val);
        entry.typeCounts.set(t, (entry.typeCounts.get(t) ?? 0) + 1);
        if (entry.samples.size < 3) {
          const serialized = serializeBson(val);
          const preview = typeof serialized === 'object' ? JSON.stringify(serialized) : String(serialized);
          entry.samples.add(preview.length > 48 ? preview.slice(0, 45) + '...' : preview);
        }
      }
    }

    const fields: SchemaFieldSummary[] = Array.from(fieldMap.entries()).map(([field, info]) => ({
      field,
      presenceCount: info.presence,
      presencePercentage: sampledCount ? Math.round((info.presence / sampledCount) * 100) : 0,
      types: Array.from(info.typeCounts.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: sampledCount ? Math.round((count / sampledCount) * 100) : 0,
      })),
      samples: Array.from(info.samples),
    }));

    return {sampledCount, totalCount, fields};
  }

  async listIndexes(dbName: string, collectionName: string): Promise<IndexSummary[]> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.listIndexes(db, collection);
    }

    const raw = await this.client.db(db).collection(collection).indexes();
    return raw.map((idx) => ({
      name: String(idx.name ?? ''),
      key: (idx.key ?? {}) as Record<string, 1 | -1 | 'text'>,
      unique: Boolean(idx.unique),
      sparse: Boolean(idx.sparse),
    }));
  }

  async createIndex(
    dbName: string,
    collectionName: string,
    keySpec: Record<string, 1 | -1 | 'text'>,
    unique: boolean,
  ): Promise<IndexSummary> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');

    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.createIndex(db, collection, keySpec, unique);
    }

    const name = await this.client
      .db(db)
      .collection(collection)
      .createIndex(keySpec as Record<string, IndexDirection>, {unique});

    return {name, key: keySpec, unique};
  }

  async dropIndex(dbName: string, collectionName: string, indexName: string): Promise<void> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');
    const collection = validateIdentifier(collectionName, 'collection');
    if (indexName === '_id_') throw new Error('Cannot drop the default _id_ index');

    if (this.mode === 'sandbox' || !this.client) {
      this.sandbox.dropIndex(db, collection, indexName);
      return;
    }

    await this.client.db(db).collection(collection).dropIndex(indexName);
  }

  async executeShell(dbName: string, command: string): Promise<ShellExecuteResponse> {
    await this.ensureInitialized();
    const db = validateIdentifier(dbName, 'database');

    if (this.mode === 'sandbox' || !this.client) {
      return this.sandbox.executeShell(db, command);
    }

    const start = performance.now();
    const trimmed = command.trim().replace(/;$/, '');
    try {
      if (trimmed === 'show dbs' || trimmed === 'show databases') {
        const dbs = await this.listDatabases();
        return {
          ok: true,
          command,
          output: dbs.map((d) => ({name: d.name, sizeOnDisk: d.sizeOnDiskBytes, collections: d.collections.length})),
          executionMs: Math.max(1, Math.round(performance.now() - start)),
        };
      }
      if (trimmed === 'show collections' || trimmed === 'show tables') {
        const cols = await this.client.db(db).listCollections().toArray();
        return {
          ok: true,
          command,
          output: cols.map((c) => c.name),
          executionMs: Math.max(1, Math.round(performance.now() - start)),
        };
      }
      if (trimmed === 'db.stats()') {
        const stats = await this.client.db(db).stats();
        return {
          ok: true,
          command,
          output: serializeBson(stats),
          executionMs: Math.max(1, Math.round(performance.now() - start)),
        };
      }

      const match = trimmed.match(/^db\.([a-zA-Z0-9_.-]+)\.(find|findOne|countDocuments|insertOne)\(([\s\S]*)\)$/);
      if (match) {
        const [, colName, method, argsRaw] = match;
        if (method === 'find') {
          const res = await this.findDocuments(db, colName, argsRaw.trim() || '{}', '{}', '{}', 0, 25);
          return {ok: true, command, output: res.documents, executionMs: res.executionMs};
        }
        if (method === 'findOne') {
          const res = await this.findDocuments(db, colName, argsRaw.trim() || '{}', '{}', '{}', 0, 1);
          return {ok: true, command, output: res.documents[0] ?? null, executionMs: res.executionMs};
        }
        if (method === 'countDocuments') {
          const res = await this.findDocuments(db, colName, argsRaw.trim() || '{}', '{}', '{}', 0, 1);
          return {ok: true, command, output: res.totalCount, executionMs: res.executionMs};
        }
        if (method === 'insertOne') {
          const inserted = await this.insertDocument(db, colName, argsRaw);
          return {
            ok: true,
            command,
            output: {acknowledged: true, insertedId: inserted._id},
            executionMs: Math.max(1, Math.round(performance.now() - start)),
          };
        }
      }

      return {
        ok: false,
        command,
        output: null,
        executionMs: Math.max(1, Math.round(performance.now() - start)),
        error: 'Supported commands: show dbs, show collections, db.stats(), db.<col>.find({...}), db.<col>.findOne({...}), db.<col>.countDocuments({...}), db.<col>.insertOne({...})',
      };
    } catch (err) {
      return {
        ok: false,
        command,
        output: null,
        executionMs: Math.max(1, Math.round(performance.now() - start)),
        error: err instanceof Error ? err.message : 'Command execution failed',
      };
    }
  }
}
