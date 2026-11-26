import type {
  AggregationResponse,
  AggregationStage,
  ConnectionMode,
  ConnectionStatus,
  DatabaseSummary,
  IndexSummary,
  QueryDocumentsResponse,
  SchemaAnalysisResponse,
  ShellExecuteResponse,
} from '../types/mongo';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {'Content-Type': 'application/json', ...(init?.headers ?? {})},
    ...init,
  });
  const data = (await res.json()) as T & {error?: string};
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const mongoApi = {
  getStatus: () => requestJson<ConnectionStatus>('/api/status'),

  connect: (uri: string, fallbackToSandbox = false, enableCompression = false) =>
    requestJson<ConnectionStatus>('/api/connect', {
      method: 'POST',
      body: JSON.stringify({uri, fallbackToSandbox, enableCompression}),
    }),

  seedSchema: () =>
    requestJson<{summary: {seeded: string[]; skipped: string[]}; databases: DatabaseSummary[]}>('/api/seed', {
      method: 'POST',
    }),

  switchMode: (mode: ConnectionMode) =>
    requestJson<ConnectionStatus>('/api/mode', {
      method: 'POST',
      body: JSON.stringify({mode}),
    }),

  listDatabases: () => requestJson<{databases: DatabaseSummary[]; status: ConnectionStatus}>('/api/databases'),

  createCollection: (db: string, collection: string) =>
    requestJson<{databases: DatabaseSummary[]}>('/api/databases', {
      method: 'POST',
      body: JSON.stringify({db, collection}),
    }),

  dropCollection: (db: string, collection: string) =>
    requestJson<{databases: DatabaseSummary[]}>(
      `/api/collections?db=${encodeURIComponent(db)}&collection=${encodeURIComponent(collection)}`,
      {method: 'DELETE'},
    ),

  queryDocuments: (params: {
    db: string;
    collection: string;
    filter: string;
    projection: string;
    sort: string;
    skip: number;
    limit: number;
  }) =>
    requestJson<QueryDocumentsResponse>('/api/documents/query', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  insertDocument: (db: string, collection: string, document: string) =>
    requestJson<{document: Record<string, unknown>}>('/api/documents/insert', {
      method: 'POST',
      body: JSON.stringify({db, collection, document}),
    }),

  updateDocument: (db: string, collection: string, id: string, document: string) =>
    requestJson<{document: Record<string, unknown>}>('/api/documents/update', {
      method: 'PUT',
      body: JSON.stringify({db, collection, id, document}),
    }),

  deleteDocument: (db: string, collection: string, id: string) =>
    requestJson<{ok: boolean}>(
      `/api/documents/delete?db=${encodeURIComponent(db)}&collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(id)}`,
      {method: 'DELETE'},
    ),

  runAggregation: (db: string, collection: string, stages: AggregationStage[]) =>
    requestJson<AggregationResponse>('/api/aggregate', {
      method: 'POST',
      body: JSON.stringify({db, collection, stages}),
    }),

  analyzeSchema: (db: string, collection: string) =>
    requestJson<SchemaAnalysisResponse>(
      `/api/schema?db=${encodeURIComponent(db)}&collection=${encodeURIComponent(collection)}`,
    ),

  listIndexes: (db: string, collection: string) =>
    requestJson<{indexes: IndexSummary[]}>(
      `/api/indexes?db=${encodeURIComponent(db)}&collection=${encodeURIComponent(collection)}`,
    ),

  createIndex: (db: string, collection: string, field: string, direction: 1 | -1 | 'text', unique: boolean) =>
    requestJson<{created: IndexSummary; indexes: IndexSummary[]}>('/api/indexes', {
      method: 'POST',
      body: JSON.stringify({db, collection, field, direction, unique}),
    }),

  dropIndex: (db: string, collection: string, name: string) =>
    requestJson<{indexes: IndexSummary[]}>(
      `/api/indexes?db=${encodeURIComponent(db)}&collection=${encodeURIComponent(collection)}&name=${encodeURIComponent(name)}`,
      {method: 'DELETE'},
    ),

  executeShell: (db: string, command: string) =>
    requestJson<ShellExecuteResponse>('/api/shell', {
      method: 'POST',
      body: JSON.stringify({db, command}),
    }),
};
