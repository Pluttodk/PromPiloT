import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Database,
  GitBranch,
  FlaskConical,
  Bot,
  Star,
  ExternalLink,
} from "lucide-react";
import { useEvalRunPolling, useEvalResultsPolling } from "../hooks/useEvaluation";
import { useProjectStore } from "../stores/projectStore";
import type { EvalResultResponse, EvalRunResponse } from "../types/api";

function StatusBadge({ status }: { status: EvalRunResponse["status"] }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    running: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const icons: Record<string, React.ReactNode> = {
    completed: <CheckCircle2 className="h-3.5 w-3.5" />,
    failed: <XCircle className="h-3.5 w-3.5" />,
    running: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    pending: <AlertCircle className="h-3.5 w-3.5" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] ?? styles.pending}`}
    >
      {icons[status]}
      {status}
    </span>
  );
}

function ResultStatusDot({ status }: { status: EvalResultResponse["status"] }) {
  return status === "completed" ? (
    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
  ) : (
    <span className="inline-flex h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
  );
}

function MatchBadge({ result }: { result: EvalResultResponse }) {
  if (!result.expected_output || !result.actual_output) return null;

  const actualValues = Object.values(result.actual_output);
  const actualText =
    actualValues.length === 1 ? String(actualValues[0]) : JSON.stringify(result.actual_output);
  const isMatch = actualText.trim().toLowerCase() === result.expected_output.trim().toLowerCase();

  return isMatch ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      match
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      <XCircle className="h-3 w-3" />
      no match
    </span>
  );
}

function ScoreDisplay({ result }: { result: EvalResultResponse }) {
  if (result.score_numeric !== null && result.score_numeric !== undefined) {
    return (
      <div className="flex items-center gap-1 text-amber-600">
        <Star className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">{result.score_numeric.toFixed(1)}/5</span>
      </div>
    );
  }
  if (result.score_label) {
    const isPass = result.score_label.toLowerCase() === "pass";
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${isPass ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}
      >
        {result.score_label}
      </span>
    );
  }
  return null;
}

export function EvalRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();

  const { data: run, isLoading: runLoading } = useEvalRunPolling(
    currentProjectId ?? undefined,
    runId,
  );

  const isActive = run?.status === "running" || run?.status === "pending";

  const { data: results = [], isLoading: resultsLoading } = useEvalResultsPolling(
    currentProjectId ?? undefined,
    runId,
    isActive,
  );

  if (!currentProjectId) {
    return <div className="text-center py-12 text-slate-500">No project selected.</div>;
  }

  if (runLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading run...
      </div>
    );
  }

  if (!run) {
    return <div className="text-center py-12 text-slate-500">Evaluation run not found.</div>;
  }

  const formatDate = (dateStr: string | null | undefined) =>
    dateStr ? new Date(dateStr).toLocaleString() : "–";

  const pct =
    run.total_items > 0 ? Math.round((run.completed_items / run.total_items) * 100) : 0;

  const avgScore =
    results.length > 0
      ? (() => {
          const scored = results.filter((r) => r.score_numeric !== null && r.score_numeric !== undefined);
          if (scored.length === 0) return null;
          const avg = scored.reduce((s, r) => s + (r.score_numeric ?? 0), 0) / scored.length;
          return avg.toFixed(2);
        })()
      : null;

  const exactMatchPct = (() => {
    const withExpected = results.filter((r) => r.expected_output && r.actual_output);
    if (withExpected.length === 0) return null;
    const matched = withExpected.filter((r) => {
      const actualValues = Object.values(r.actual_output!);
      const actualText =
        actualValues.length === 1 ? String(actualValues[0]) : JSON.stringify(r.actual_output);
      return actualText.trim().toLowerCase() === r.expected_output!.trim().toLowerCase();
    });
    return Math.round((matched.length / withExpected.length) * 100);
  })();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <button onClick={() => navigate("/evaluations")} className="hover:text-slate-700">
          Evaluations
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900 font-medium">{run.name}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/evaluations")}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-xl bg-purple-50">
            <FlaskConical className="h-5 w-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-900">{run.name}</h1>
              <StatusBadge status={run.status} />
            </div>
            <div className="flex items-center gap-4 mt-0.5 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-slate-400" />
                {run.dataset_name}
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                {run.flow_name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {formatDate(run.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Items</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{run.total_items}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{run.completed_items}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Failed</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{run.failed_items}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Avg LLM Score</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {avgScore !== null ? `${avgScore}` : "–"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Exact Match</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {exactMatchPct !== null ? `${exactMatchPct}%` : "–"}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {isActive && run.total_items > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Running evaluation…</span>
            <span className="text-sm text-blue-600">{pct}%</span>
          </div>
          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {run.error_message && (
        <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-100">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{run.error_message}</p>
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Results
            {isActive && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600 font-normal">
                <Loader2 className="h-3 w-3 animate-spin" />
                Live
              </span>
            )}
          </h3>
          {run.auto_score && (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <Bot className="h-3.5 w-3.5" />
              Auto-scored
            </span>
          )}
        </div>

        {resultsLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading results...
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            {isActive ? "Waiting for results…" : "No results yet"}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {results.map((result, idx) => (
              <div key={result.result_id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 group">
                <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                  <span className="text-xs text-slate-400 font-mono w-6 text-right">
                    {idx + 1}
                  </span>
                  <ResultStatusDot status={result.status} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-1">
                    {result.actual_output && (
                      <span className="text-xs text-slate-600 font-mono truncate">
                        <span className="text-slate-400 mr-1">actual:</span>
                        {JSON.stringify(result.actual_output)}
                      </span>
                    )}
                    {result.expected_output && (
                      <span className="text-xs text-slate-400 font-mono truncate">
                        <span className="mr-1">expected:</span>
                        <span className="text-slate-600">{result.expected_output}</span>
                      </span>
                    )}
                    {result.error_message && (
                      <span className="text-xs text-red-500">{result.error_message}</span>
                    )}
                  </div>

                  {result.judge_reasoning && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {result.judge_reasoning.slice(0, 400)}
                      {result.judge_reasoning.length > 400 ? "…" : ""}
                    </p>
                  )}

                  {result.execution_time_ms !== null && result.execution_time_ms !== undefined && (
                    <p className="text-xs text-slate-400 mt-0.5">{result.execution_time_ms}ms</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <MatchBadge result={result} />
                  {run.auto_score && <ScoreDisplay result={result} />}
                  {result.trace_id && (
                    <button
                      onClick={() => navigate(`/traces/${result.trace_id}`)}
                      className="p-1.5 rounded text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="View trace"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
