import {KeyRound, Plus, RefreshCw, Trash2} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {mongoApi} from '../api/client';
import type {IndexSummary, SchemaAnalysisResponse} from '../types/mongo';

interface SchemaIndexesViewProps {
  db: string;
  collection: string;
}

export function SchemaIndexesView({db, collection}: SchemaIndexesViewProps) {
  const [schema, setSchema] = useState<SchemaAnalysisResponse | null>(null);
  const [indexes, setIndexes] = useState<IndexSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newField, setNewField] = useState('');
  const [newDir, setNewDir] = useState<1 | -1 | 'text'>(1);
  const [newUnique, setNewUnique] = useState(false);
  const [creatingIndex, setCreatingIndex] = useState(false);

  const loadData = useCallback(async () => {
    if (!db || !collection) return;
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, idxRes] = await Promise.all([
        mongoApi.analyzeSchema(db, collection),
        mongoApi.listIndexes(db, collection),
      ]);
      setSchema(schemaRes);
      setIndexes(idxRes.indexes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema & indexes');
    } finally {
      setLoading(false);
    }
  }, [db, collection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newField.trim()) return;
    setCreatingIndex(true);
    setError(null);
    try {
      const res = await mongoApi.createIndex(db, collection, newField.trim(), newDir, newUnique);
      setIndexes(res.indexes);
      setNewField('');
      setNewUnique(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create index');
    } finally {
      setCreatingIndex(false);
    }
  };

  const handleDropIndex = async (name: string) => {
    setError(null);
    try {
      const res = await mongoApi.dropIndex(db, collection, name);
      setIndexes(res.indexes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to drop index');
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-8 max-w-6xl">
      {error && (
        <div className="px-4 py-2.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Schema Field Distribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              {schema
                ? `Analyzed ${schema.sampledCount} of ${schema.totalCount} documents in ${db}.${collection}`
                : 'Sampling collection structure...'}
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Analyze Sample
          </button>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 overflow-x-auto">
          {!schema || schema.fields.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {loading ? 'Inspecting documents...' : 'Insert documents to analyze field types and distribution.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Field</th>
                  <th className="px-4 py-2.5 font-medium">Detected Types</th>
                  <th className="px-4 py-2.5 font-medium">Presence</th>
                  <th className="px-4 py-2.5 font-medium">Sample Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {schema.fields.map((field) => (
                  <tr key={field.field} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {field.field}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {field.types.map((t, idx) => (
                        <span key={t.type}>
                          {idx > 0 && <span className="mx-1.5 text-slate-400">·</span>}
                          <span className="font-mono text-emerald-700 dark:text-emerald-400">{t.type}</span>{' '}
                          <span className="tabular-nums text-slate-500 dark:text-slate-400">({t.percentage}%)</span>
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3 w-48">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 dark:bg-emerald-500"
                            style={{width: `${field.presencePercentage}%`}}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400 w-9 text-right">
                          {field.presencePercentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {field.samples.join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Indexes</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active indexes accelerating queries on <span className="font-mono">{db}.{collection}</span>.
          </p>
        </div>

        <form
          onSubmit={handleCreateIndex}
          className="flex flex-wrap items-center gap-3 p-3.5 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900"
        >
          <input
            type="text"
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            placeholder="Field path (e.g. email or ordersCount)"
            className="flex-1 min-w-[200px] px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
          />
          <select
            value={String(newDir)}
            onChange={(e) => {
              const v = e.target.value;
              setNewDir(v === '-1' ? -1 : v === 'text' ? 'text' : 1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none"
          >
            <option value="1">1 (Ascending)</option>
            <option value="-1">-1 (Descending)</option>
            <option value="text">text (Text Search)</option>
          </select>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer px-1">
            <input
              type="checkbox"
              checked={newUnique}
              onChange={(e) => setNewUnique(e.target.checked)}
              className="accent-emerald-700"
            />
            Unique
          </label>
          <button
            type="submit"
            disabled={creatingIndex || !newField.trim()}
            className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Index
          </button>
        </form>

        <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
                <th className="px-4 py-2.5 font-medium">Index Name</th>
                <th className="px-4 py-2.5 font-medium">Key Definition</th>
                <th className="px-4 py-2.5 font-medium">Properties</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {indexes.map((idx) => (
                <tr key={idx.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-mono text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    {idx.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                    {JSON.stringify(idx.key)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                    {idx.unique ? 'Unique' : 'Standard'}
                    {idx.sparse ? ' · Sparse' : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {idx.name === '_id_' ? (
                      <span className="text-slate-400">System</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDropIndex(idx.name)}
                        className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Drop
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
