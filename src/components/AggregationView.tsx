import {ArrowDown, ArrowUp, Play, Plus, Trash2} from 'lucide-react';
import {useEffect, useState} from 'react';
import {mongoApi} from '../api/client';
import type {AggregationStage} from '../types/mongo';

interface AggregationViewProps {
  db: string;
  collection: string;
}

const OPERATORS: AggregationStage['operator'][] = [
  '$match',
  '$group',
  '$sort',
  '$project',
  '$limit',
  '$skip',
  '$unwind',
  '$count',
];

const DEFAULT_BODIES: Record<AggregationStage['operator'], string> = {
  $match: '{\n  \n}',
  $group: '{\n  "_id": null,\n  "total": { "$sum": 1 }\n}',
  $sort: '{\n  "_id": 1\n}',
  $project: '{\n  "_id": 1\n}',
  $limit: '20',
  $skip: '0',
  $unwind: '"$items"',
  $count: '"totalCount"',
};

export function AggregationView({db, collection}: AggregationViewProps) {
  const [stages, setStages] = useState<AggregationStage[]>([
    {
      id: 'stage-1',
      operator: '$match',
      body: '{}',
      enabled: true,
    },
    {
      id: 'stage-2',
      operator: '$limit',
      body: '10',
      enabled: true,
    },
  ]);

  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [executionMs, setExecutionMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPipeline = async (customStages = stages) => {
    if (!db || !collection) return;
    setLoading(true);
    setError(null);
    try {
      const res = await mongoApi.runAggregation(db, collection, customStages);
      setResults(res.results);
      setExecutionMs(res.executionMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aggregation failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runPipeline(stages);
  }, [db, collection]);

  const addStage = () => {
    const id = `stage-${Date.now()}`;
    setStages((prev) => [
      ...prev,
      {id, operator: '$sort', body: DEFAULT_BODIES.$sort, enabled: true},
    ]);
  };

  const updateStage = (id: string, patch: Partial<AggregationStage>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? {...s, ...patch} : s)));
  };

  const removeStage = (id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id));
  };

  const moveStage = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= stages.length) return;
    const copy = [...stages];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    setStages(copy);
  };

  const applyPreset = (preset: 'countBy' | 'top10') => {
    let next: AggregationStage[];
    if (preset === 'countBy') {
      const sampleField =
        collection === 'users'
          ? '$plan'
          : collection === 'orders'
            ? '$status'
            : collection === 'products'
              ? '$category'
              : '$level';
      next = [
        {
          id: 'p-1',
          operator: '$group',
          body: `{\n  "_id": "${sampleField}",\n  "count": { "$sum": 1 }\n}`,
          enabled: true,
        },
        {id: 'p-2', operator: '$sort', body: '{\n  "count": -1\n}', enabled: true},
      ];
    } else {
      next = [
        {id: 'p-1', operator: '$sort', body: '{\n  "_id": -1\n}', enabled: true},
        {id: 'p-2', operator: '$limit', body: '10', enabled: true},
      ];
    }
    setStages(next);
    runPipeline(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-100">Pipeline Stages</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => applyPreset('countBy')}
            className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
          >
            Preset: Group & Count
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => applyPreset('top10')}
            className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
          >
            Preset: Latest 10
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addStage}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Stage
          </button>
          <button
            type="button"
            onClick={() => runPipeline(stages)}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <Play className="w-3.5 h-3.5" />
            {loading ? 'Running...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-5 space-y-3">
          {stages.length === 0 ? (
            <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 text-center space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">No stages configured.</p>
              <button
                type="button"
                onClick={addStage}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-md cursor-pointer"
              >
                Add First Stage
              </button>
            </div>
          ) : (
            stages.map((stage, idx) => (
              <div
                key={stage.id}
                className={`border rounded-md bg-white dark:bg-slate-900 overflow-hidden transition-opacity ${
                  stage.enabled
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-slate-200/60 dark:border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 tabular-nums">{idx + 1}.</span>
                    <select
                      value={stage.operator}
                      onChange={(e) => {
                        const op = e.target.value as AggregationStage['operator'];
                        updateStage(stage.id, {operator: op, body: DEFAULT_BODIES[op]});
                      }}
                      className="text-xs font-mono font-semibold bg-transparent text-emerald-700 dark:text-emerald-400 focus:outline-none cursor-pointer"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          {op}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <label className="inline-flex items-center gap-1.5 mr-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stage.enabled}
                        onChange={(e) => updateStage(stage.id, {enabled: e.target.checked})}
                        className="accent-emerald-700"
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => moveStage(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Move stage up"
                      className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStage(idx, 1)}
                      disabled={idx === stages.length - 1}
                      aria-label="Move stage down"
                      className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStage(stage.id)}
                      aria-label="Remove stage"
                      className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={stage.body}
                  onChange={(e) => updateStage(stage.id, {body: e.target.value})}
                  spellCheck={false}
                  className="w-full p-3 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            ))
          )}
        </div>

        <div className="xl:col-span-7 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
            <span className="font-medium text-slate-800 dark:text-slate-200">Pipeline Output</span>
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">
              {results.length} {results.length === 1 ? 'document' : 'documents'}
              {executionMs !== null ? ` · ${executionMs} ms` : ''}
            </span>
          </div>

          {error ? (
            <div className="p-4 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30">
              {error}
            </div>
          ) : results.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              No documents returned by this pipeline.
            </div>
          ) : (
            <pre className="p-4 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed max-h-[600px]">
              {JSON.stringify(results, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
