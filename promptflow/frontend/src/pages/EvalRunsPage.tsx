import { useNavigate } from "react-router-dom";
import {
  FlaskConical,
  Loader2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Database,
  GitBranch,
} from "lucide-react";
import { useEvalRuns } from "../hooks/useEvaluation";
import { useProjectStore } from "../stores/projectStore";
import type { EvalRunResponse } from "../types/api";

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
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] ?? styles.pending}`}
    >
      {icons[status]}
      {status}
    </span>
  );
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 flex-shrink-0">
        {completed}/{total}
      </span>
    </div>
  );
}

export function EvalRunsPage() {
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();
  const { data: runs = [], isLoading } = useEvalRuns(currentProjectId ?? undefined);

  if (!currentProjectId) {
    return (
      <div className="text-center py-12">
        <FlaskConical className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No project selected</h3>
        <p className="text-slate-500">Select a project first to view evaluation runs</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Evaluations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Batch evaluation runs across datasets and flows
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading runs...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <FlaskConical className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-base font-medium text-slate-900 mb-2">No evaluation runs yet</h3>
          <p className="text-sm text-slate-500">
            Go to a dataset and click "Start Eval Run" to begin
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.run_id}
              onClick={() => navigate(`/evaluations/${run.run_id}`)}
              className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 flex-shrink-0">
                <FlaskConical className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-slate-900">{run.name}</h3>
                  <StatusBadge status={run.status} />
                </div>

                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
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

                {run.total_items > 0 && (
                  <ProgressBar completed={run.completed_items} total={run.total_items} />
                )}
              </div>

              <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 self-center" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
