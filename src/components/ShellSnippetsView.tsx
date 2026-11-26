import {Check, Copy, Play, Terminal} from 'lucide-react';
import {useState} from 'react';
import {mongoApi} from '../api/client';
import type {ConnectionStatus, ShellExecuteResponse} from '../types/mongo';

interface ShellSnippetsViewProps {
  db: string;
  collection: string;
  status: ConnectionStatus | null;
  onMutated: () => void;
}

type DriverTab = 'java' | 'nodejs' | 'python' | 'mongosh';

export function ShellSnippetsView({db, collection, status, onMutated}: ShellSnippetsViewProps) {
  const uri = status?.maskedUri || 'mongodb+srv://yaswanthsir8_db_user:<db_password>@nosql.l6st1gr.mongodb.net/';
  const [command, setCommand] = useState(`db.${collection}.find({})`);
  const [history, setHistory] = useState<ShellExecuteResponse[]>([]);
  const [running, setRunning] = useState(false);

  const [driverTab, setDriverTab] = useState<DriverTab>('java');
  const [copied, setCopied] = useState(false);

  const handleRunCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    setRunning(true);
    try {
      const res = await mongoApi.executeShell(db, command);
      setHistory((prev) => [res, ...prev]);
      if (res.ok && command.includes('insertOne')) {
        onMutated();
      }
    } catch (err) {
      setHistory((prev) => [
        {
          ok: false,
          command,
          output: null,
          executionMs: 0,
          error: err instanceof Error ? err.message : 'Execution failed',
        },
        ...prev,
      ]);
    } finally {
      setRunning(false);
    }
  };

  const snippets: Record<DriverTab, string> = {
    java: `// application.properties\nspring.data.mongodb.uri=${uri}?retryWrites=true&w=majority\nspring.data.mongodb.database=${db}\n\n// Spring Data MongoDB Template\n@Autowired\nprivate MongoTemplate mongoTemplate;\n\nList<Document> docs = mongoTemplate.find(\n  new Query().limit(20), Document.class, "${collection}"\n);`,
    nodejs: `import { MongoClient } from 'mongodb';\n\nconst client = new MongoClient('${uri}');\nawait client.connect();\nconst col = client.db('${db}').collection('${collection}');\nconst docs = await col.find({}).limit(20).toArray();\nconsole.log(docs);\nawait client.close();`,
    python: `from pymongo import MongoClient\n\nclient = MongoClient("${uri}")\ncol = client["${db}"]["${collection}"]\ndocs = list(col.find({}).limit(20))\nprint(docs)\nclient.close()`,
    mongosh: `mongosh "${uri}"\nuse ${db}\ndb.${collection}.find({}).limit(20)`,
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippets[driverTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const quickCommands = [
    'show dbs',
    'show collections',
    'db.stats()',
    `db.${collection}.find({})`,
    `db.${collection}.countDocuments({})`,
  ];

  return (
    <div className="flex-1 overflow-auto p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start max-w-7xl">
      <section className="xl:col-span-7 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Interactive Shell</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Run <code className="font-mono">mongosh</code> queries against <span className="font-mono">{db}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {quickCommands.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => setCommand(cmd)}
              className="px-2.5 py-1 font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded hover:border-emerald-600 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {cmd}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleRunCommand}
          className="flex items-center gap-2 p-2 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900"
        >
          <Terminal className="w-4 h-4 text-emerald-700 dark:text-emerald-400 ml-2 shrink-0" />
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            spellCheck={false}
            placeholder={`db.${collection}.find({})`}
            className="flex-1 px-2 py-1.5 text-xs font-mono bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
          />
          <button
            type="submit"
            disabled={running}
            className="px-4 py-1.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Execute
          </button>
        </form>

        <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-slate-950 text-slate-100 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Output Console</span>
            <span className="font-mono">{db}</span>
          </div>
          <div className="p-4 space-y-4 max-h-[460px] overflow-y-auto font-mono text-xs">
            {history.length === 0 ? (
              <p className="text-slate-500">Run a command above to inspect output.</p>
            ) : (
              history.map((entry, idx) => (
                <div key={idx} className="space-y-1.5 pb-3 border-b last:border-b-0 border-slate-800/80">
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>{entry.command}</span>
                    <span className="text-slate-500 tabular-nums">{entry.executionMs} ms</span>
                  </div>
                  {entry.ok ? (
                    <pre className="text-slate-200 overflow-x-auto leading-relaxed">
                      {JSON.stringify(entry.output, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-red-400">{entry.error}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="xl:col-span-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Connection Snippets</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ready-to-run client code configured for <code className="font-mono">{uri}</code>.
          </p>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-md">
              {(['java', 'nodejs', 'python', 'mongosh'] as DriverTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDriverTab(tab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    driverTab === tab
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tab === 'java'
                    ? 'Java (Spring)'
                    : tab === 'nodejs'
                      ? 'Node.js'
                      : tab === 'python'
                        ? 'Python'
                        : 'mongosh'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed">
            {snippets[driverTab]}
          </pre>
        </div>
      </section>
    </div>
  );
}
