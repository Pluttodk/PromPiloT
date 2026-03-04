import { useState } from "react";
import { Bot, Loader2, X } from "lucide-react";
import { useRunLLMJudge } from "../../hooks/useEvaluation";
import { useModels } from "../../hooks/useModels";

interface LLMJudgeModalProps {
  traceId: string;
  projectId: string;
  onClose: () => void;
}

export function LLMJudgeModal({ traceId, projectId, onClose }: LLMJudgeModalProps) {
  const [criteria, setCriteria] = useState("");
  const [scoreName, setScoreName] = useState("llm_judge");
  const [scoreType, setScoreType] = useState<"numeric" | "boolean" | "categorical">("numeric");
  const [modelConfigId, setModelConfigId] = useState<string>("");
  const [result, setResult] = useState<{ score: string; reasoning: string } | null>(null);

  const runJudge = useRunLLMJudge();
  const { data: models = [] } = useModels(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await runJudge.mutateAsync({
      body: {
        trace_id: traceId,
        criteria,
        score_name: scoreName,
        score_type: scoreType,
        model_config_id: modelConfigId || undefined,
      },
      projectId,
    });

    const scoreValue =
      response.score.score_type === "numeric"
        ? response.score.value_numeric?.toFixed(1) ?? "–"
        : response.score.score_type === "boolean"
          ? response.score.value_boolean === true
            ? "Yes"
            : "No"
          : response.score.value_label ?? "–";

    setResult({ score: scoreValue, reasoning: response.reasoning });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">LLM Judge</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {result ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-blue-900">Score: {result.score}</span>
                </div>
                <p className="text-sm text-blue-700 leading-relaxed">{result.reasoning}</p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Score Name
                </label>
                <input
                  value={scoreName}
                  onChange={(e) => setScoreName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Score Type
                </label>
                <select
                  value={scoreType}
                  onChange={(e) =>
                    setScoreType(e.target.value as "numeric" | "boolean" | "categorical")
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="numeric">Numeric (0–5)</option>
                  <option value="boolean">Boolean (true/false)</option>
                  <option value="categorical">Categorical (pass/fail)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Model Config
                </label>
                <select
                  value={modelConfigId}
                  onChange={(e) => setModelConfigId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Default</option>
                  {models.map((m) => (
                    <option key={m.model_config_id} value={m.model_config_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Evaluation Criteria
                </label>
                <textarea
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  rows={4}
                  placeholder="e.g. Was the response helpful and accurate? Did it answer the question directly?"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
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
                  disabled={runJudge.isPending || !criteria.trim()}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {runJudge.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Run Judge
                </button>
              </div>

              {runJudge.isError && (
                <p className="text-xs text-red-600 text-center">
                  {(runJudge.error as Error).message ?? "Judge failed"}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
