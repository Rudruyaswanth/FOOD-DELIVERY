import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type {AggregationStage, ConnectionMode} from './src/types/mongo.ts';
import {MongoConnectionManager} from './server/mongoEngine.ts';

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const manager = new MongoConnectionManager();

app.use(express.json({limit: '2mb'}));

app.get('/api/status', async (_req, res) => {
  try {
    await manager.ensureInitialized();
    res.json(manager.getStatus());
  } catch (err) {
    res.status(500).json({error: err instanceof Error ? err.message : 'Status check failed'});
  }
});

app.post('/api/connect', async (req, res) => {
  try {
    const uri = typeof req.body?.uri === 'string' ? req.body.uri : '';
    const fallbackToSandbox = Boolean(req.body?.fallbackToSandbox);
    const enableCompression = Boolean(req.body?.enableCompression);
    const status = await manager.tryConnect(uri, fallbackToSandbox, enableCompression);
    res.json(status);
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Invalid connection request'});
  }
});

app.post('/api/seed', async (_req, res) => {
  try {
    const summary = await manager.seedStarterSchema();
    const databases = await manager.listDatabases();
    res.json({summary, databases});
  } catch (err) {
    res.status(500).json({error: err instanceof Error ? err.message : 'Failed to seed starter schema'});
  }
});

app.post('/api/mode', async (req, res) => {
  try {
    const mode = req.body?.mode as ConnectionMode;
    if (mode !== 'live' && mode !== 'sandbox') {
      res.status(400).json({error: 'Mode must be "live" or "sandbox"'});
      return;
    }
    const status = manager.switchMode(mode);
    res.json(status);
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Failed to switch mode'});
  }
});

app.get('/api/databases', async (_req, res) => {
  try {
    const databases = await manager.listDatabases();
    res.json({databases, status: manager.getStatus()});
  } catch (err) {
    res.status(500).json({error: err instanceof Error ? err.message : 'Failed to list databases'});
  }
});

app.post('/api/databases', async (req, res) => {
  try {
    const db = typeof req.body?.db === 'string' ? req.body.db : '';
    const collection = typeof req.body?.collection === 'string' ? req.body.collection : '';
    await manager.createDatabaseCollection(db, collection);
    const databases = await manager.listDatabases();
    res.json({databases});
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Failed to create collection'});
  }
});

app.delete('/api/collections', async (req, res) => {
  try {
    const db = typeof req.query.db === 'string' ? req.query.db : '';
    const collection = typeof req.query.collection === 'string' ? req.query.collection : '';
    await manager.dropCollection(db, collection);
    const databases = await manager.listDatabases();
    res.json({databases});
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Failed to drop collection'});
  }
});

app.post('/api/documents/query', async (req, res) => {
  try {
    const db = typeof req.body?.db === 'string' ? req.body.db : '';
    const collection = typeof req.body?.collection === 'string' ? req.body.collection : '';
    const filter = typeof req.body?.filter === 'string' ? req.body.filter : '{}';
    const projection = typeof req.body?.projection === 'string' ? req.body.projection : '{}';
    const sort = typeof req.body?.sort === 'string' ? req.body.sort : '{}';
    const skip = Number(req.body?.skip ?? 0);
    const limit = Number(req.body?.limit ?? 25);

    const result = await manager.findDocuments(db, collection, filter, projection, sort, skip, limit);
    res.json(result);
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Query failed'});
  }
});

app.post('/api/documents/insert', async (req, res) => {
  try {
    const db = typeof req.body?.db === 'string' ? req.body.db : '';
    const collection = typeof req.body?.collection === 'string' ? req.body.collection : '';
    const document = typeof req.body?.document === 'string' ? req.body.document : '';
    const inserted = await manager.insertDocument(db, collection, document);
    res.json({document: inserted});
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Insert failed'});
  }
});

app.put('/api/documents/update', async (req, res) => {
  try {
    const db = typeof req.body?.db === 'string' ? req.body.db : '';
    const collection = typeof req.body?.collection === 'string' ? req.body.collection : '';
    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    const document = typeof req.body?.document === 'string' ? req.body.document : '';
    const updated = await manager.updateDocument(db, collection, id, document);
    res.json({document: updated});
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Update failed'});
  }
});

app.delete('/api/documents/delete', async (req, res) => {
  try {
    const db = typeof req.query.db === 'string' ? req.query.db : '';
    const collection = typeof req.query.collection === 'string' ? req.query.collection : '';
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    await manager.deleteDocument(db, collection, id);
    res.json({ok: true});
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Delete failed'});
  }
});

app.post('/api/aggregate', async (req, res) => {
  try {
    const db = typeof req.body?.db === 'string' ? req.body.db : '';
    const collection = typeof req.body?.collection === 'string' ? req.body.collection : '';
    const stages = Array.isArray(req.body?.stages) ? (req.body.stages as AggregationStage[]) : [];
    const result = await manager.runAggregation(db, collection, stages);
    res.json(result);
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Aggregation failed'});
  }
});

app.get('/api/schema', async (req, res) => {
  try {
    const db = typeof req.query.db === 'string' ? req.query.db : '';
    const collection = typeof req.query.collection === 'string' ? req.query.collection : '';
    const result = await manager.analyzeSchema(db, collection);
    res.json(result);
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Schema analysis failed'});
  }
});

app.get('/api/indexes', async (req, res) => {
  try {
    const db = typeof req.query.db === 'string' ? req.query.db : '';
    const collection = typeof req.query.collection === 'string' ? req.query.collection : '';
    const indexes = await manager.listIndexes(db, collection);
    res.json({indexes});
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Failed to list indexes'});
  }
});

app.post('/api/indexes', async (req, res) => {
  try {
    const db = typeof req.body?.db === 'string' ? req.body.db : '';
    const collection = typeof req.body?.collection === 'string' ? req.body.collection : '';
    const field = typeof req.body?.field === 'string' ? req.body.field.trim() : '';
    const direction = req.body?.direction === -1 ? -1 : req.body?.direction === 'text' ? 'text' : 1;
    const unique = Boolean(req.body?.unique);
    if (!field || /[\0$\s]/.test(field)) {
      res.status(400).json({error: 'Valid index field name is required'});
      return;
    }
    const created = await manager.createIndex(db, collection, {[field]: direction}, unique);
    const indexes = await manager.listIndexes(db, collection);
    res.json({created, indexes});
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Failed to create index'});
  }
});

app.delete('/api/indexes', async (req, res) => {
  try {
    const db = typeof req.query.db === 'string' ? req.query.db : '';
    const collection = typeof req.query.collection === 'string' ? req.query.collection : '';
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    await manager.dropIndex(db, collection, name);
    const indexes = await manager.listIndexes(db, collection);
    res.json({indexes});
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Failed to drop index'});
  }
});

app.post('/api/shell', async (req, res) => {
  try {
    const db = typeof req.body?.db === 'string' ? req.body.db : 'ecommerce_local';
    const command = typeof req.body?.command === 'string' ? req.body.command : '';
    const result = await manager.executeShell(db, command);
    res.json(result);
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Shell execution failed'});
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Leafline Studio listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
