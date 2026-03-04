import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Loader2,
  ArrowLeft,
  ChevronRight,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Coins,
  Calendar,
  Star,
} from "lucide-react";
import { useTraces, useDeleteTrace } from "../hooks/useTraces";
import { useFlows } from "../hooks/useFlows";
import { useProject } from "../hooks/useProjects";
import { useProjectStore } from "../stores/projectStore";
import type { TraceListResponse } from "../types/api";

type QuickRange = "today" | "7d" | "30d" | "custom";

function getDateRange(range: QuickRange): { dateFrom: Date; dateTo: Date } | null {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { dateFrom: start, dateTo: end };
  }
  if (range === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { dateFrom: start, dateTo: end };
  }
  if (range === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { dateFrom: start, dateTo: end };
  }
  return null;
}

export function TracesPage() {
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();
  const { data: project } = useProject(currentProjectId ?? undefined);
  const { data: flows } = useFlows(currentProjectId ?? undefined);

  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [quickRange, setQuickRange] = useState<QuickRange>("7d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const dateRange =
    quickRange === "custom"
      ? {
          dateFrom: customFrom ? new Date(customFrom) : undefined,
          dateTo: customTo ? new Date(customTo + "T23:59:59") : undefined,
        }
      : getDateRange(quickRange) ?? { dateFrom: undefined, dateTo: undefined };

  const { data: traces, isLoading } = useTraces(
    currentProjectId ?? undefined,
    selectedFlowId || undefined,
    dateRange.dateFrom,
    dateRange.dateTo,
  );
  const deleteTrace = useDeleteTrace();

  if (!currentProjectId) {
    return (
      <div className="text-center py-12">
        <Activity className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No project selected</h3>
        <p className="text-slate-500 mb-4">Select a project first to view traces</p>
        <button onClick={() => navigate("/")} className="btn-primary">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Projects
        </button>
      </div>
    );
  }

  const handleDeleteTrace = async (e: React.MouseEvent, trace: TraceListResponse) => {
    e.stopPropagation();
    if (!currentProjectId) return;
    if (window.confirm(`Delete trace for "${trace.flow_name}"?`)) {
      await deleteTrace.mutateAsync({
        traceId: trace.trace_id,
        projectId: currentProjectId,
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "failed":
        return "bg-red-50 text-red-700 border-red-200";
      case "running":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const quickRangeButtons: { key: QuickRange; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "Last 7 days" },
    { key: "30d", label: "Last 30 days" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] px-2 flex flex-col">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <button onClick={() => navigate("/")} className="hover:text-slate-700">
          Projects
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900 font-medium">{project?.name || "Loading..."}</span>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Execution Traces</h1>
          <p className="text-sm text-slate-500 mt-1">View and analyze flow executions</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Date range:</span>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Quick date range">
          {quickRangeButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setQuickRange(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                quickRange === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
              aria-pressed={quickRange === key}
            >
              {label}
            </button>
          ))}
        </div>

        {quickRange === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="From date"
            />
            <span className="text-slate-400 text-sm">–</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="To date"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-500">Flow:</span>
          <select
            value={selectedFlowId}
            onChange={(e) => setSelectedFlowId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Filter by flow"
          >
            <option value="">All Flows</option>
            {flows?.map((flow) => (
              <option key={flow.flow_id} value={flow.flow_id}>
                {flow.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : traces && traces.length > 0 ? (
          <div className="space-y-3">
            {traces.map((trace) => (
              <div
                key={trace.trace_id}
                onClick={() => navigate(`/traces/${trace.trace_id}`)}
                className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(trace.status)}
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-slate-900">{trace.flow_name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-md border ${getStatusBadge(
                            trace.status
                          )}`}
                        >
                          {trace.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(trace.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      {trace.execution_time_ms !== null && trace.execution_time_ms !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span>{trace.execution_time_ms}ms</span>
                        </div>
                      )}
                      {trace.total_tokens !== null && trace.total_tokens !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <Coins className="h-4 w-4 text-slate-400" />
                          <span>{trace.total_tokens} tokens</span>
                        </div>
                      )}
                      {trace.score_count > 0 && (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <Star className="h-4 w-4" />
                          <span>{trace.score_count}</span>
                        </div>
                      )}
                      {trace.eval_run_id && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-md border bg-purple-50 text-purple-700 border-purple-200">
                          eval
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteTrace(e, trace)}
                      className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors text-slate-400"
                      title="Delete trace"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {trace.error_message && (
                  <p className="text-sm text-red-600 mt-3 truncate">{trace.error_message}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-xl border border-slate-200 bg-white">
            <Activity className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No traces found</h3>
            <p className="text-slate-500 mb-4">
              {quickRange !== "custom"
                ? "Try a wider date range or execute a flow to generate traces"
                : "No traces match the selected filters"}
            </p>
            <button onClick={() => navigate("/flows")} className="btn-primary">
              Go to Flows
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
