import { useState } from "react";
import { FlaskConical, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCreateEvalRun } from "../../hooks/useEvaluation";
import { useFlows } from "../../hooks/useFlows";
import { useModels } from "../../hooks/useModels";

interface EvalRunCreateModalProps {
  projectId: string;
  datasetId: string;
  datasetName: string;
  onClose: () => void;
}

export function EvalRunCreateModal({
  projectId,
  datasetId,
  datasetName,
  onClose,
}: EvalRunCreateModalProps) {
  const navigate = useNavigate();
  const [runName, setRunName] = useState("");
  const [flowId, setFlowId] = useState("");
  const [itemLimit, setItemLimit] = useState("");
  const [autoScore, setAutoScore] = useState(false);
  const [judeCriteria, setJudgeCriteria] = useState("");
  const [judgeModelConfigId, setJudgeModelConfigId] = useState("");

  const createRun = useCreateEvalRun();
  const { data: flows = [] } = useFlows(projectId);
  const { data: models = [] } = useModels(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = itemLimit.trim() ? parseInt(itemLimit, 10) : null;
    const run = await createRun.mutateAsync({
      body: {
        name: runName,
        dataset_id: datasetId,
        flow_id: flowId,
        auto_score: autoScore,
        judge_criteria: autoScore ? judeCriteria : undefined,
        judge_model_config_id: autoScore && judgeModelConfigId ? judgeModelConfigId : undefined,
        item_limit: parsedLimit && parsedLimit > 0 ? parsedLimit : null,
      },
      projectId,
    });
    onClose();
    navigate(`/evaluations/${run.run_id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-600" />
            <h2 className="text-base font-semibold text-slate-900">Start Evaluation Run</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Run Name</label>
            <input
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder="e.g. v2 evaluation"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Dataset</label>
            <input
              value={datasetName}
              disabled
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Item Limit <span className="text-slate-400 font-normal">(optional — leave blank to run all)</span>
            </label>
            <input
              type="number"
              min={1}
              value={itemLimit}
              onChange={(e) => setItemLimit(e.target.value)}
              placeholder="e.g. 10"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Flow to Evaluate</label>
            <select
              value={flowId}
              onChange={(e) => setFlowId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="">Select a flow...</option>
              {flows.map((f) => (
                <option key={f.flow_id} value={f.flow_id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <input
              id="auto-score"
              type="checkbox"
              checked={autoScore}
              onChange={(e) => setAutoScore(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="auto-score" className="text-sm font-medium text-slate-700">
              Auto-score with LLM Judge
            </label>
          </div>

          {autoScore && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Judge Model Config
                </label>
                <select
                  value={judgeModelConfigId}
                  onChange={(e) => setJudgeModelConfigId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  value={judeCriteria}
                  onChange={(e) => setJudgeCriteria(e.target.value)}
                  rows={3}
                  placeholder="e.g. Was the response helpful, accurate, and on-topic?"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  required={autoScore}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRun.isPending || !flowId}
              className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {createRun.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Start Run
            </button>
          </div>

          {createRun.isError && (
            <p className="text-xs text-red-600 text-center">
              {(createRun.error as Error).message ?? "Failed to create run"}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
