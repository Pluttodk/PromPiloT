import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  ChevronRight,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  MessageSquare,
  LogIn,
  LogOut,
  User,
  Bot,
  Settings,
  Database,
  X,
} from "lucide-react";
import { useTrace } from "../hooks/useTraces";
import { useProjectStore } from "../stores/projectStore";
import type { TraceNodeResult } from "../types/api";
import { ScorePanel } from "../components/evaluation/ScorePanel";
import { useDatasets, useAddDatasetItemFromTrace } from "../hooks/useEvaluation";

type NodeTab = "input" | "output" | "metadata";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";

  if (isSystem) {
    return (
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
          <Settings className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <div className="max-w-[85%] px-3 py-2 rounded-xl bg-slate-100 border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
            system
          </span>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex items-start gap-2 mb-3 flex-row-reverse">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="max-w-[85%] px-3 py-2 rounded-xl bg-blue-600 text-white">
          <span className="text-xs font-semibold text-blue-200 uppercase tracking-wide block mb-1">
            user
          </span>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <div className="max-w-[85%] px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide block mb-1">
            assistant
          </span>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return null;
}

function parseChatMessages(value: unknown): ChatMessage[] | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const messages = obj.messages ?? (Array.isArray(value) ? value : null);
  if (!Array.isArray(messages)) return null;
  const parsed: ChatMessage[] = [];
  for (const m of messages) {
    if (
      m &&
      typeof m === "object" &&
      "role" in m &&
      "content" in m &&
      typeof (m as Record<string, unknown>).role === "string" &&
      typeof (m as Record<string, unknown>).content === "string"
    ) {
      parsed.push(m as ChatMessage);
    }
  }
  return parsed.length > 0 ? parsed : null;
}

function JsonBlock({
  value,
  copiedKey,
  copyKey,
  onCopy,
}: {
  value: unknown;
  copiedKey: string;
  copyKey: string;
  onCopy: (text: string, key: string) => void;
}) {
  const text = value === null || value === undefined ? "null" : JSON.stringify(value, null, 2);
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">JSON</span>
        <button
          onClick={() => onCopy(text, copyKey)}
          className="p-1 rounded hover:bg-slate-200 transition-colors"
          title="Copy"
        >
          {copiedKey === copyKey ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>
      </div>
      <pre className="text-sm p-4 overflow-auto max-h-[320px] text-slate-700 font-mono bg-white whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}

function ImportToDatasetModal({
  traceId,
  projectId,
  onClose,
}: {
  traceId: string;
  projectId: string;
  onClose: () => void;
}) {
  const { data: datasets = [] } = useDatasets(projectId);
  const addFromTrace = useAddDatasetItemFromTrace();
  const [datasetId, setDatasetId] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addFromTrace.mutateAsync({
      datasetId,
      body: { trace_id: traceId, expected_output: expectedOutput || undefined },
      projectId,
    });
    setSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Import as Test Case</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-900 mb-1">Imported successfully!</p>
              <p className="text-xs text-slate-500 mb-4">
                This trace's inputs have been added to the dataset.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Target Dataset
                </label>
                <select
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a dataset...</option>
                  {datasets.map((d) => (
                    <option key={d.dataset_id} value={d.dataset_id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {datasets.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    No datasets yet —{" "}
                    <a href="/datasets" className="text-blue-500 hover:underline">
                      create one first
                    </a>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Expected Output{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={expectedOutput}
                  onChange={(e) => setExpectedOutput(e.target.value)}
                  rows={2}
                  placeholder="What should the ideal output be?"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFromTrace.isPending || !datasetId}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {addFromTrace.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();
  const { data: trace, isLoading } = useTrace(currentProjectId ?? undefined, traceId);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NodeTab>("input");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId === selectedNodeId ? null : nodeId);
    setActiveTab("input");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <XCircle className="h-3.5 w-3.5" />
            Failed
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5" />
            {status}
          </span>
        );
    }
  };

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case "input":
        return <LogIn className="h-3.5 w-3.5" />;
      case "prompt":
        return <MessageSquare className="h-3.5 w-3.5" />;
      case "output":
        return <LogOut className="h-3.5 w-3.5" />;
      default:
        return <div className="h-3.5 w-3.5" />;
    }
  };

  const getNodeColors = (nodeType: string) => {
    switch (nodeType) {
      case "input":
        return {
          icon: "bg-sky-100 text-sky-600 border-sky-200",
          bar: "bg-sky-400",
          badge: "bg-sky-50 text-sky-700 border-sky-200",
        };
      case "prompt":
        return {
          icon: "bg-violet-100 text-violet-600 border-violet-200",
          bar: "bg-violet-400",
          badge: "bg-violet-50 text-violet-700 border-violet-200",
        };
      case "output":
        return {
          icon: "bg-emerald-100 text-emerald-600 border-emerald-200",
          bar: "bg-emerald-400",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      default:
        return {
          icon: "bg-slate-100 text-slate-600 border-slate-200",
          bar: "bg-slate-400",
          badge: "bg-slate-50 text-slate-700 border-slate-200",
        };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (!currentProjectId) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No project selected</p>
        <button onClick={() => navigate("/")} className="btn-primary mt-4">
          Go to Projects
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Trace not found</p>
        <button onClick={() => navigate("/traces")} className="btn-primary mt-4">
          Back to Traces
        </button>
      </div>
    );
  }

  const maxDuration = Math.max(
    ...trace.node_traces.map((n) => n.execution_time_ms ?? 0),
    1,
  );

  const selectedNode = trace.node_traces.find((n) => n.node_id === selectedNodeId) ?? null;

  return (
    <div className="flex flex-col px-2 pb-8">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <button onClick={() => navigate("/traces")} className="hover:text-slate-700">
          Traces
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900 font-medium">{trace.flow_name}</span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate("/traces")}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900 truncate">{trace.flow_name}</h1>
            {getStatusBadge(trace.status)}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{formatDate(trace.created_at)}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>{trace.execution_time_ms}ms</span>
          </div>
          {trace.total_tokens !== null && trace.total_tokens !== undefined && (
            <div className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-slate-400" />
              <span>{trace.total_tokens} tokens</span>
            </div>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            title="Import as dataset test case"
          >
            <Database className="h-3.5 w-3.5" />
            Import as test case
          </button>
        </div>
      </div>

      {trace.error_message && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Execution Failed</p>
              <p className="text-xs text-red-600 mt-0.5">{trace.error_message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        <div
          className="w-[35%] flex-shrink-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          data-testid="node-list-panel"
        >
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">Execution Steps</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {trace.node_traces.length} node{trace.node_traces.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="relative p-3">
              {trace.node_traces.map((node: TraceNodeResult, index: number) => {
                const isSelected = node.node_id === selectedNodeId;
                const isLast = index === trace.node_traces.length - 1;
                const colors = getNodeColors(node.node_type);
                const durationMs = node.execution_time_ms ?? 0;
                const barWidth = maxDuration > 0 ? Math.max((durationMs / maxDuration) * 100, 4) : 4;

                return (
                  <div key={node.node_id} className="relative flex gap-3 mb-1">
                    <div className="flex flex-col items-center flex-shrink-0 w-6">
                      <div
                        className={`w-2.5 h-2.5 rounded-full border-2 mt-3 flex-shrink-0 z-10 ${
                          isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"
                        }`}
                      />
                      {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                    </div>

                    <button
                      onClick={() => handleNodeSelect(node.node_id)}
                      className={`flex-1 min-w-0 text-left rounded-lg p-2.5 mb-2 transition-all border ${
                        isSelected
                          ? "bg-blue-50 border-blue-200 shadow-sm"
                          : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className={`flex items-center justify-center w-6 h-6 rounded-md border flex-shrink-0 ${colors.icon}`}
                        >
                          {getNodeIcon(node.node_type)}
                        </div>
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {node.name || node.node_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors.bar}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0 w-14 text-right">
                          {durationMs > 0 ? `${durationMs}ms` : "—"}
                        </span>
                      </div>

                      {node.error && (
                        <p className="text-xs text-red-500 mt-1 truncate">{node.error}</p>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="flex-1 min-w-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          data-testid="detail-panel"
        >
          {selectedNode === null ? (
            <FlowIOPanel
              trace={trace}
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
          ) : (
            <NodeDetailPanel
              node={selectedNode}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              copiedField={copiedField}
              onCopy={copyToClipboard}
              getNodeColors={getNodeColors}
            />
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <ScorePanel traceId={trace.trace_id} projectId={trace.project_id} />
      </div>

      {showImportModal && currentProjectId && (
        <ImportToDatasetModal
          traceId={trace.trace_id}
          projectId={currentProjectId}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}

function FlowIOPanel({
  trace,
  copiedField,
  onCopy,
}: {
  trace: {
    inputs: Record<string, unknown>;
    outputs?: Record<string, unknown> | null;
  };
  copiedField: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col p-5 gap-5 overflow-y-auto">
      <div>
        <p className="text-xs text-slate-400 mb-3 text-center">
          Select a node from the left panel to inspect its details
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Flow Inputs</h3>
          <button
            onClick={() => onCopy(JSON.stringify(trace.inputs, null, 2), "inputs")}
            className="p-1.5 rounded-md hover:bg-slate-200 transition-colors"
            title="Copy"
          >
            {copiedField === "inputs" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>
        <pre className="text-sm p-4 overflow-auto max-h-[220px] text-slate-700 font-mono bg-white whitespace-pre-wrap">
          {JSON.stringify(trace.inputs, null, 2)}
        </pre>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Flow Outputs</h3>
          <button
            onClick={() => onCopy(JSON.stringify(trace.outputs, null, 2), "outputs")}
            className="p-1.5 rounded-md hover:bg-slate-200 transition-colors"
            title="Copy"
          >
            {copiedField === "outputs" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>
        <pre className="text-sm p-4 overflow-auto max-h-[220px] text-slate-700 font-mono bg-white whitespace-pre-wrap">
          {trace.outputs ? JSON.stringify(trace.outputs, null, 2) : "null"}
        </pre>
      </div>
    </div>
  );
}

function NodeDetailPanel({
  node,
  activeTab,
  onTabChange,
  copiedField,
  onCopy,
  getNodeColors,
}: {
  node: TraceNodeResult;
  activeTab: NodeTab;
  onTabChange: (tab: NodeTab) => void;
  copiedField: string | null;
  onCopy: (text: string, key: string) => void;
  getNodeColors: (nodeType: string) => { icon: string; bar: string; badge: string };
}) {
  const colors = getNodeColors(node.node_type);
  const isPromptNode = node.node_type === "prompt";

  const inputMessages = isPromptNode ? parseChatMessages(node.input) : null;

  const outputMessage: ChatMessage | null =
    isPromptNode && node.output !== null && node.output !== undefined
      ? { role: "assistant", content: typeof node.output === "string" ? node.output : JSON.stringify(node.output) }
      : null;

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg border ${colors.icon}`}>
          {node.node_type === "input" ? (
            <LogIn className="h-4 w-4" />
          ) : node.node_type === "prompt" ? (
            <MessageSquare className="h-4 w-4" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{node.name || node.node_id}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-md border ${colors.badge}`}>
              {node.node_type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500 flex-shrink-0">
          {node.execution_time_ms !== null && node.execution_time_ms !== undefined && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>{node.execution_time_ms}ms</span>
            </div>
          )}
          {node.tokens_used !== null && node.tokens_used !== undefined && (
            <div className="flex items-center gap-1">
              <Coins className="h-3.5 w-3.5 text-slate-400" />
              <span>{node.tokens_used}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-100 flex-shrink-0 px-5">
        {(["input", "output", "metadata"] as NodeTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "input" && (
          <div>
            {isPromptNode && inputMessages ? (
              <div>
                <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">
                  Conversation
                </p>
                <div className="space-y-1">
                  {inputMessages.map((msg, i) => (
                    <ChatBubble key={i} message={msg} />
                  ))}
                </div>
              </div>
            ) : (
              <JsonBlock
                value={node.input}
                copiedKey={copiedField ?? ""}
                copyKey={`input-${node.node_id}`}
                onCopy={onCopy}
              />
            )}
          </div>
        )}

        {activeTab === "output" && (
          <div>
            {isPromptNode && outputMessage ? (
              <div>
                <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">
                  Response
                </p>
                <ChatBubble message={outputMessage} />
              </div>
            ) : (
              <JsonBlock
                value={node.output}
                copiedKey={copiedField ?? ""}
                copyKey={`output-${node.node_id}`}
                onCopy={onCopy}
              />
            )}
          </div>
        )}

        {activeTab === "metadata" && (
          <div className="space-y-3">
            <MetadataRow label="Node Type" value={node.node_type} />
            <MetadataRow label="Node ID" value={node.node_id} monospace />
            {node.prompt_id && <MetadataRow label="Prompt ID" value={node.prompt_id} monospace />}
            {node.model_config_id && (
              <MetadataRow label="Model Config ID" value={node.model_config_id} monospace />
            )}
            {node.execution_time_ms !== null && node.execution_time_ms !== undefined && (
              <MetadataRow label="Execution Time" value={`${node.execution_time_ms}ms`} />
            )}
            {node.tokens_used !== null && node.tokens_used !== undefined && (
              <MetadataRow label="Tokens Used" value={String(node.tokens_used)} />
            )}
            {node.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">
                  Error
                </p>
                <p className="text-sm text-red-700">{node.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function MetadataRow({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span
        className={`text-sm text-slate-800 break-all ${monospace ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
