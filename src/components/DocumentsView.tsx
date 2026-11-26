import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {mongoApi} from '../api/client';

interface DocumentsViewProps {
  db: string;
  collection: string;
  onMutated: () => void;
}

type ViewMode = 'table' | 'json';

function formatCellValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export function DocumentsView({db, collection, onMutated}: DocumentsViewProps) {
  const [filter, setFilter] = useState('{}');
  const [projection, setProjection] = useState('{}');
  const [sort, setSort] = useState('{}');
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [executionMs, setExecutionMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editorState, setEditorState] = useState<{
    mode: 'insert' | 'edit';
    id?: string;
    json: string;
  } | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const runQuery = useCallback(
    async (targetPage = page) => {
      if (!db || !collection) return;
      setLoading(true);
      setError(null);
      try {
        const res = await mongoApi.queryDocuments({
          db,
          collection,
          filter,
          projection,
          sort,
          skip: targetPage * limit,
          limit,
        });
        setDocuments(res.documents);
        setTotalCount(res.totalCount);
        setExecutionMs(res.executionMs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to execute query');
      } finally {
        setLoading(false);
      }
    },
    [db, collection, filter, projection, sort, limit, page],
  );

  useEffect(() => {
    setPage(0);
    setConfirmDeleteId(null);
  }, [db, collection]);

  useEffect(() => {
    runQuery(page);
  }, [db, collection, page, limit, runQuery]);

  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) {
      for (const key of Object.keys(doc)) {
        set.add(key);
      }
    }
    const keys = Array.from(set);
    keys.sort((a, b) => {
      if (a === '_id') return -1;
      if (b === '_id') return 1;
      return a.localeCompare(b);
    });
    return keys;
  }, [documents]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    runQuery(0);
  };

  const handleResetQuery = () => {
    setFilter('{}');
    setProjection('{}');
    setSort('{}');
    setPage(0);
    setTimeout(() => {
      mongoApi
        .queryDocuments({db, collection, filter: '{}', projection: '{}', sort: '{}', skip: 0, limit})
        .then((res) => {
          setDocuments(res.documents);
          setTotalCount(res.totalCount);
          setExecutionMs(res.executionMs);
          setError(null);
        })
        .catch(() => {});
    }, 0);
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorState) return;
    setSaving(true);
    setEditorError(null);
    try {
      if (editorState.mode === 'insert') {
        await mongoApi.insertDocument(db, collection, editorState.json);
      } else if (editorState.id) {
        await mongoApi.updateDocument(db, collection, editorState.id, editorState.json);
      }
      setEditorState(null);
      await runQuery(page);
      onMutated();
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mongoApi.deleteDocument(db, collection, id);
      setConfirmDeleteId(null);
      await runQuery(page);
      onMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(documents, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${db}.${collection}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="flex flex-col h-full">
      <form
        onSubmit={handleFilterSubmit}
        className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[260px] flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-950 focus-within:ring-2 focus-within:ring-emerald-600/30 focus-within:border-emerald-600">
            <span className="px-3 py-2 text-xs font-mono text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 select-none">
              Filter
            </span>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder='{ "active": true }'
              aria-label="MongoDB filter query"
              className="flex-1 px-3 py-2 text-xs font-mono bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showOptions ? 'Hide Options' : 'Options'}
          </button>

          <button
            type="button"
            onClick={handleResetQuery}
            title="Reset filter"
            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <Play className="w-3.5 h-3.5" />
            Find
          </button>
        </div>

        {showOptions && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-950">
              <span className="px-2.5 py-2 text-xs font-mono text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                Project
              </span>
              <input
                type="text"
                value={projection}
                onChange={(e) => setProjection(e.target.value)}
                placeholder='{ "name": 1 }'
                className="flex-1 px-2.5 py-2 text-xs font-mono bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-950">
              <span className="px-2.5 py-2 text-xs font-mono text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                Sort
              </span>
              <input
                type="text"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                placeholder='{ "_id": -1 }'
                className="flex-1 px-2.5 py-2 text-xs font-mono bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-950">
              <span className="px-2.5 py-2 text-xs font-mono text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                Limit
              </span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(0);
                }}
                className="flex-1 px-2.5 py-2 text-xs font-mono bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value={10}>10 documents</option>
                <option value={25}>25 documents</option>
                <option value={50}>50 documents</option>
                <option value={100}>100 documents</option>
              </select>
            </div>
          </div>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 tabular-nums">
          <span>
            {totalCount} {totalCount === 1 ? 'document' : 'documents'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{executionMs} ms</span>
          <span aria-hidden="true">·</span>
          <span>
            Page {page + 1} of {totalPages}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'json'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              JSON
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={documents.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>

          <button
            type="button"
            onClick={() => {
              setEditorError(null);
              setEditorState({
                mode: 'insert',
                json: JSON.stringify(
                  {
                    name: 'New Record',
                    createdAt: new Date().toISOString(),
                  },
                  null,
                  2,
                ),
              });
            }}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Insert Document
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden bg-white dark:bg-slate-900">
            {Array.from({length: 5}).map((_, i) => (
              <div
                key={i}
                className="h-10 border-b last:border-b-0 border-slate-100 dark:border-slate-800 px-4 flex items-center gap-4 animate-pulse"
              >
                <div className="h-3 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              No documents matched in <span className="font-mono">{db}.{collection}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adjust your filter query or insert a new document into this collection.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditorError(null);
                setEditorState({
                  mode: 'insert',
                  json: '{\n  "title": "Sample document",\n  "active": true\n}',
                });
              }}
              className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Insert First Document
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2.5 font-mono font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documents.map((doc, rowIdx) => {
                  const idStr = doc._id !== undefined ? String(doc._id) : String(rowIdx);
                  const isConfirming = confirmDeleteId === idStr;

                  return (
                    <tr
                      key={idStr}
                      className="h-10 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {columns.map((col) => {
                        const rawVal = doc[col];
                        const isNum = typeof rawVal === 'number';
                        return (
                          <td
                            key={col}
                            className={`px-3 py-2 font-mono max-w-[260px] truncate ${
                              isNum ? 'tabular-nums text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
                            }`}
                            title={formatCellValue(rawVal)}
                          >
                            {formatCellValue(rawVal)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(idStr)}
                              className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditorError(null);
                                setEditorState({
                                  mode: 'edit',
                                  id: idStr,
                                  json: JSON.stringify(doc, null, 2),
                                });
                              }}
                              title="Edit document"
                              aria-label="Edit document"
                              className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {doc._id !== undefined && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(idStr)}
                                title="Delete document"
                                aria-label="Delete document"
                                className="p-1.5 rounded text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc, idx) => {
              const idStr = doc._id !== undefined ? String(doc._id) : String(idx);
              return (
                <div
                  key={idStr}
                  className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
                    <span className="font-mono text-slate-500 dark:text-slate-400">_id: {idStr}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditorError(null);
                          setEditorState({
                            mode: 'edit',
                            id: idStr,
                            json: JSON.stringify(doc, null, 2),
                          });
                        }}
                        className="text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium cursor-pointer"
                      >
                        Edit
                      </button>
                      {doc._id !== undefined && (
                        <button
                          type="button"
                          onClick={() => handleDelete(idStr)}
                          className="text-red-600 dark:text-red-400 hover:underline font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed">
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {editorState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {editorState.mode === 'insert'
                  ? `Insert Document into ${db}.${collection}`
                  : `Edit Document (${editorState.id})`}
              </h3>
              <button
                type="button"
                onClick={() => setEditorState(null)}
                aria-label="Close document editor"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditor} className="p-5 space-y-4">
              <textarea
                rows={14}
                value={editorState.json}
                onChange={(e) => setEditorState({...editorState, json: e.target.value})}
                spellCheck={false}
                className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              />
              {editorError && <p className="text-xs text-red-600 dark:text-red-400">{editorError}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditorState(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editorState.mode === 'insert' ? 'Insert' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
