import {Moon, Sun} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {mongoApi} from './api/client';
import {AggregationView} from './components/AggregationView';
import {ConnectModal} from './components/ConnectModal';
import {DocumentsView} from './components/DocumentsView';
import {FoodOrderingView} from './components/FoodOrderingView';
import {KitchenQueueView} from './components/KitchenQueueView';
import {OrderTrackerView} from './components/OrderTrackerView';
import {SchemaIndexesView} from './components/SchemaIndexesView';
import {ShellSnippetsView} from './components/ShellSnippetsView';
import {Sidebar} from './components/Sidebar';
import type {ConnectionStatus, DatabaseSummary} from './types/mongo';

type AppSection = 'order' | 'track' | 'kitchen' | 'studio';
type StudioTab = 'documents' | 'aggregation' | 'schema' | 'shell';

export default function App() {
  const [dark, setDark] = useState(false);
  const [section, setSection] = useState<AppSection>('order');
  const [trackedOrderNumber, setTrackedOrderNumber] = useState<string | null>(null);

  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [databases, setDatabases] = useState<DatabaseSummary[]>([]);
  const [activeDb, setActiveDb] = useState('');
  const [activeCollection, setActiveCollection] = useState('');
  const [studioTab, setStudioTab] = useState<StudioTab>('documents');
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const loadDatabases = useCallback(async () => {
    setLoadingDatabases(true);
    try {
      const res = await mongoApi.listDatabases();
      setDatabases(res.databases);
      setStatus(res.status);

      setActiveDb((prevDb) => {
        const dbMatch = res.databases.find((d) => d.name === prevDb);
        if (dbMatch && dbMatch.collections.length > 0) {
          setActiveCollection((prevCol) => {
            if (dbMatch.collections.some((c) => c.name === prevCol)) return prevCol;
            return dbMatch.collections[0].name;
          });
          return prevDb;
        }
        const preferred =
          res.databases.find((d) => d.name === 'food_delivery' && d.collections.length > 0) ??
          res.databases.find((d) => d.collections.length > 0) ??
          res.databases[0];
        if (preferred) {
          setActiveCollection(preferred.collections[0]?.name ?? '');
          return preferred.name;
        }
        setActiveCollection('');
        return '';
      });
    } catch {
      // Handled by status state
    } finally {
      setLoadingDatabases(false);
    }
  }, []);

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  const activeCollectionMeta = useMemo(() => {
    const db = databases.find((d) => d.name === activeDb);
    return db?.collections.find((c) => c.name === activeCollection) ?? null;
  }, [databases, activeDb, activeCollection]);

  const handleSelectCollection = (db: string, collection: string) => {
    setActiveDb(db);
    setActiveCollection(collection);
  };

  const handleConnectUri = async (uri: string, enableCompression = false) => {
    const nextStatus = await mongoApi.connect(uri, false, enableCompression);
    setStatus(nextStatus);
    if (nextStatus.connected) {
      await loadDatabases();
    }
    return nextStatus;
  };

  const handleSeedSchema = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await mongoApi.seedSchema();
      setDatabases(res.databases);
      if (res.summary.seeded.length > 0) {
        setSeedMessage(`Seeded ${res.summary.seeded.length} collections (${res.summary.seeded.join(', ')}).`);
      } else {
        setSeedMessage('Starter collections already exist on this cluster.');
      }
      await loadDatabases();
    } catch (err) {
      setSeedMessage(err instanceof Error ? err.message : 'Failed to seed starter schema.');
    } finally {
      setSeeding(false);
    }
  };

  const handleUseSandbox = async () => {
    const nextStatus = await mongoApi.switchMode('sandbox');
    setStatus(nextStatus);
    await loadDatabases();
  };

  const handleCreateCollection = async (db: string, collection: string) => {
    const res = await mongoApi.createCollection(db, collection);
    setDatabases(res.databases);
  };

  const handleDropCollection = async (db: string, collection: string) => {
    const res = await mongoApi.dropCollection(db, collection);
    setDatabases(res.databases);
    if (db === activeDb && collection === activeCollection) {
      const sameDb = res.databases.find((d) => d.name === db);
      const nextCol = sameDb?.collections[0]?.name ?? res.databases[0]?.collections[0]?.name ?? '';
      const nextDb = sameDb?.collections.length ? db : res.databases[0]?.name ?? '';
      setActiveDb(nextDb);
      setActiveCollection(nextCol);
    }
  };

  const navItems: Array<{id: AppSection; label: string}> = [
    {id: 'order', label: 'Order'},
    {id: 'track', label: 'Track'},
    {id: 'kitchen', label: 'Kitchen'},
    {id: 'studio', label: 'MongoDB Studio'},
  ];

  const studioTabs: Array<{id: StudioTab; label: string}> = [
    {id: 'documents', label: 'Documents'},
    {id: 'aggregation', label: 'Aggregation'},
    {id: 'schema', label: 'Schema & Indexes'},
    {id: 'shell', label: 'Shell & Snippets'},
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="h-14 shrink-0 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setSection('order');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          Leafline
        </a>

        <nav className="flex items-center gap-6 overflow-x-auto" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`py-4 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-emerald-700 text-slate-900 dark:border-emerald-400 dark:text-slate-100'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setConnectModalOpen(true)}
            className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Connect DB
          </button>
        </div>
      </header>

      {seedMessage && (
        <div className="px-6 py-2 border-b border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <span>{seedMessage}</span>
          <button
            type="button"
            onClick={() => setSeedMessage(null)}
            className="font-medium hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {section === 'order' && (
        <FoodOrderingView
          onOrderCreated={(orderNum) => {
            setTrackedOrderNumber(orderNum);
            loadDatabases();
          }}
          onTrackLatest={() => setSection('track')}
          onOpenStudio={() => setSection('studio')}
        />
      )}

      {section === 'track' && (
        <OrderTrackerView
          selectedOrderNumber={trackedOrderNumber}
          onSelectOrderNumber={(orderNum) => setTrackedOrderNumber(orderNum)}
        />
      )}

      {section === 'kitchen' && <KitchenQueueView onOrderUpdated={loadDatabases} />}

      {section === 'studio' && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <Sidebar
            status={status}
            databases={databases}
            activeDb={activeDb}
            activeCollection={activeCollection}
            loading={loadingDatabases}
            seeding={seeding}
            onSelectCollection={handleSelectCollection}
            onRefresh={loadDatabases}
            onOpenConnect={() => setConnectModalOpen(true)}
            onCreateCollection={handleCreateCollection}
            onDropCollection={handleDropCollection}
            onSeedSchema={handleSeedSchema}
          />

          <main className="flex-1 flex flex-col min-w-0 min-h-0">
            {activeDb && activeCollection ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md overflow-x-auto">
                    {studioTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStudioTab(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          studioTab === tab.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeCollectionMeta && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {activeDb}.{activeCollection}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{activeCollectionMeta.count} docs</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeCollectionMeta.indexCount} indexes</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  {studioTab === 'documents' && (
                    <DocumentsView db={activeDb} collection={activeCollection} onMutated={loadDatabases} />
                  )}
                  {studioTab === 'aggregation' && <AggregationView db={activeDb} collection={activeCollection} />}
                  {studioTab === 'schema' && <SchemaIndexesView db={activeDb} collection={activeCollection} />}
                  {studioTab === 'shell' && (
                    <ShellSnippetsView
                      db={activeDb}
                      collection={activeCollection}
                      status={status}
                      onMutated={loadDatabases}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="max-w-md text-center space-y-3">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Select or create a collection
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Choose a collection from the database tree, or seed the starter schema into your connected cluster.
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleSeedSchema}
                      disabled={seeding}
                      className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {seeding ? 'Seeding Schema...' : 'Seed Starter Schema'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectModalOpen(true)}
                      className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md cursor-pointer"
                    >
                      Configure Connection
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>Leafline Bistro Delivery</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{status?.hostLabel || 'localhost:27017'}</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSection(section === 'studio' ? 'order' : 'studio')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              {section === 'studio' ? 'Back to Storefront' : 'Open MongoDB Studio'}
            </button>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {dark ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </footer>

      <ConnectModal
        open={connectModalOpen}
        status={status}
        onClose={() => setConnectModalOpen(false)}
        onConnect={handleConnectUri}
        onUseSandbox={handleUseSandbox}
      />
    </div>
  );
}
