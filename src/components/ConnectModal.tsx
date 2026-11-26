import {AlertCircle, CheckCircle2, Eye, EyeOff, Server, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import type {ConnectionStatus} from '../types/mongo';

interface ConnectModalProps {
  open: boolean;
  status: ConnectionStatus | null;
  onClose: () => void;
  onConnect: (uri: string, enableCompression: boolean) => Promise<ConnectionStatus>;
  onUseSandbox: () => Promise<void>;
}

const ATLAS_TEMPLATE = 'mongodb+srv://yaswanthsir8_db_user:<db_password>@nosql.l6st1gr.mongodb.net/';
const LOCAL_TEMPLATE = 'mongodb://localhost:27017/';

export function ConnectModal({open, status, onClose, onConnect, onUseSandbox}: ConnectModalProps) {
  const [uri, setUri] = useState(status?.maskedUri || ATLAS_TEMPLATE);
  const [showUri, setShowUri] = useState(false);
  const [enableCompression, setEnableCompression] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUri(status?.maskedUri && status.connected ? status.maskedUri : ATLAS_TEMPLATE);
      setError(null);
      setResultMsg(null);
    }
  }, [open, status?.maskedUri, status?.connected]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResultMsg(null);
    try {
      const next = await onConnect(uri, enableCompression);
      if (next.connected) {
        setResultMsg(`Connected to ${next.hostLabel} (${next.serverVersion}).`);
        setTimeout(() => onClose(), 600);
      } else {
        setError(
          next.lastError
            ? `Could not reach ${next.hostLabel}: ${next.lastError}`
            : `Could not reach ${next.hostLabel}.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h2 id="connect-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              MongoDB Connection
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Presets:</span>
            <button
              type="button"
              onClick={() => setUri(ATLAS_TEMPLATE)}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-600 font-mono cursor-pointer"
            >
              Atlas (nosql.l6st1gr)
            </button>
            <button
              type="button"
              onClick={() => setUri(LOCAL_TEMPLATE)}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-600 font-mono cursor-pointer"
            >
              localhost:27017
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="mongo-uri-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Connection String (URI)
              </label>
              <button
                type="button"
                onClick={() => setShowUri((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                {showUri ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showUri ? 'Hide URI' : 'Show URI'}
              </button>
            </div>
            <input
              id="mongo-uri-input"
              type={showUri ? 'text' : 'password'}
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder={ATLAS_TEMPLATE}
              autoComplete="off"
              className="w-full px-3 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Replace <code className="font-mono">&lt;db_password&gt;</code> with your Atlas user password, or configure{' '}
              <code className="font-mono">MONGODB_URI</code> in Settings &rarr; Secrets for automatic startup connection.
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enableCompression}
              onChange={(e) => setEnableCompression(e.target.checked)}
              className="mt-0.5 accent-emerald-700"
            />
            <span>
              <span className="font-medium block text-slate-900 dark:text-slate-100">
                Enable network compression (zlib)
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Compresses wire protocol messages between this server and your MongoDB Atlas cluster.
              </span>
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-all">{error}</span>
            </div>
          )}

          {resultMsg && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resultMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={async () => {
                await onUseSandbox();
                onClose();
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Use Local Sandbox
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {submitting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
