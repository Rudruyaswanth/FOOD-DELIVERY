import {
  ChevronDown,
  ChevronRight,
  Database,
  FolderPlus,
  Plus,
  RefreshCw,
  Search,
  Server,
  Table2,
  Trash2,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import type {ConnectionStatus, DatabaseSummary} from '../types/mongo';

interface SidebarProps {
  status: ConnectionStatus | null;
  databases: DatabaseSummary[];
  activeDb: string;
  activeCollection: string;
  loading: boolean;
  seeding: boolean;
  onSelectCollection: (db: string, collection: string) => void;
  onRefresh: () => void;
  onOpenConnect: () => void;
  onCreateCollection: (db: string, collection: string) => Promise<void>;
  onDropCollection: (db: string, collection: string) => Promise<void>;
  onSeedSchema: () => Promise<void>;
}

export function Sidebar({
  status,
  databases,
  activeDb,
  activeCollection,
  loading,
  seeding,
  onSelectCollection,
  onRefresh,
  onOpenConnect,
  onCreateCollection,
  onDropCollection,
  onSeedSchema,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [expandedDbs, setExpandedDbs] = useState<Record<string, boolean>>({
    ecommerce_local: true,
    telemetry_dev: true,
  });
  const [creatingForDb, setCreatingForDb] = useState<string | null>(null);
  const [newDbName, setNewDbName] = useState('');
  const [newColName, setNewColName] = useState('');
  const [confirmDrop, setConfirmDrop] = useState<{db: string; col: string} | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredDatabases = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return databases;
    return databases
      .map((db) => {
        const dbMatch = db.name.toLowerCase().includes(q);
        const matchingCols = db.collections.filter((c) => c.name.toLowerCase().includes(q));
        if (dbMatch) return db;
        if (matchingCols.length > 0) return {...db, collections: matchingCols};
        return null;
      })
      .filter((d): d is DatabaseSummary => d !== null);
  }, [databases, search]);

  const toggleDb = (name: string) => {
    setExpandedDbs((prev) => ({...prev, [name]: !(prev[name] ?? name === activeDb)}));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const targetDb = creatingForDb === '__new__' ? newDbName.trim() : creatingForDb;
    const col = newColName.trim();
    if (!targetDb || !col) {
      setFormError('Database and collection names are required.');
      return;
    }
    try {
      await onCreateCollection(targetDb, col);
      setExpandedDbs((prev) => ({...prev, [targetDb]: true}));
      setCreatingForDb(null);
      setNewDbName('');
      setNewColName('');
      onSelectCollection(targetDb, col);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create collection');
    }
  };

  return (
    <aside className="w-full lg:w-[272px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate font-mono">
              {status?.hostLabel || 'localhost:27017'}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh databases"
            aria-label="Refresh databases"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate">
            {status?.mode === 'live' ? `Live · MongoDB ${status.serverVersion}` : 'Local Sandbox · Port 27017'}
          </span>
          <button
            type="button"
            onClick={onOpenConnect}
            className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            Configure
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter databases or collections"
            className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Databases ({databases.length})
          </span>
          <button
            type="button"
            onClick={() => {
              setCreatingForDb('__new__');
              setFormError(null);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Database
          </button>
        </div>

        {creatingForDb && (
          <form
            onSubmit={handleCreateSubmit}
            className="mx-1 mb-2 p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2"
          >
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {creatingForDb === '__new__' ? 'Create database & collection' : `Add collection to ${creatingForDb}`}
            </p>
            {creatingForDb === '__new__' && (
              <input
                type="text"
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                placeholder="Database name"
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
              />
            )}
            <input
              type="text"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder="Collection name"
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
            />
            {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreatingForDb(null)}
                className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded whitespace-nowrap shrink-0 cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {filteredDatabases.length === 0 ? (
          <p className="px-3 py-6 text-xs text-slate-500 dark:text-slate-400 text-center">
            No matching databases found.
          </p>
        ) : (
          filteredDatabases.map((db) => {
            const isExpanded = expandedDbs[db.name] ?? db.name === activeDb;
            return (
              <div key={db.name} className="space-y-0.5">
                <div className="group flex items-center justify-between rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/70 pr-1.5">
                  <button
                    type="button"
                    onClick={() => toggleDb(db.name)}
                    className="flex-1 flex items-center gap-2 px-2 py-2 text-left text-xs font-medium text-slate-800 dark:text-slate-200 min-w-0 cursor-pointer"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <Database className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="truncate font-mono">{db.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingForDb(db.name);
                      setFormError(null);
                    }}
                    title={`Create collection in ${db.name}`}
                    aria-label={`Create collection in ${db.name}`}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400 transition-opacity cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="pl-5 space-y-0.5">
                    {db.collections.map((col) => {
                      const isActive = db.name === activeDb && col.name === activeCollection;
                      const isConfirming = confirmDrop?.db === db.name && confirmDrop?.col === col.name;

                      return (
                        <div key={col.name} className="group relative">
                          {isConfirming ? (
                            <div className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs">
                              <span className="truncate text-red-700 dark:text-red-300">Drop {col.name}?</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDrop(null)}
                                  className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                                >
                                  No
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDropCollection(db.name, col.name);
                                    setConfirmDrop(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                                >
                                  Drop
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`flex items-center justify-between rounded-md pr-1.5 transition-colors ${
                                isActive
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => onSelectCollection(db.name, col.name)}
                                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left text-xs min-w-0 cursor-pointer"
                              >
                                <Table2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
                                <span className="truncate font-mono">{col.name}</span>
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[11px] tabular-nums font-mono text-slate-400 dark:text-slate-500 group-hover:hidden">
                                  {col.count}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDrop({db: db.name, col: col.name})}
                                  title={`Drop ${col.name}`}
                                  aria-label={`Drop ${col.name}`}
                                  className="hidden group-hover:inline-flex p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onSeedSchema}
          disabled={seeding}
          className="w-full px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {seeding ? 'Seeding Starter Schema...' : 'Seed Starter Schema'}
        </button>
      </div>
    </aside>
  );
}
