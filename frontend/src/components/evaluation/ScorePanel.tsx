import { useState } from "react";
import { ThumbsUp, ThumbsDown, Star, Trash2, Loader2, Bot, User, Plus } from "lucide-react";
import { useScores, useCreateScore, useDeleteScore } from "../../hooks/useEvaluation";
import type { ScoreCreate, ScoreResponse } from "../../types/api";
import { LLMJudgeModal } from "./LLMJudgeModal";

interface ScorePanelProps {
  traceId: string;
  projectId: string;
}

function ScoreBadge({ score }: { score: ScoreResponse }) {
  const value =
    score.score_type === "numeric"
      ? score.value_numeric?.toFixed(1) ?? "–"
      : score.score_type === "boolean"
        ? score.value_boolean === true
          ? "Yes"
          : score.value_boolean === false
            ? "No"
            : "–"
        : score.value_label ?? "–";

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      {score.scorer_type === "llm" ? (
        <Bot className="h-3 w-3" />
      ) : (
        <User className="h-3 w-3" />
      )}
      {score.name}: {value}
    </span>
  );
}

function CustomScoreForm({
  traceId,
  projectId,
  onClose,
}: {
  traceId: string;
  projectId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("quality");
  const [scoreType, setScoreType] = useState<"numeric" | "boolean" | "categorical">("numeric");
  const [valueNumeric, setValueNumeric] = useState("3");
  const [valueBoolean, setValueBoolean] = useState<"true" | "false">("true");
  const [valueLabel, setValueLabel] = useState("pass");
  const [comment, setComment] = useState("");

  const createScore = useCreateScore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: ScoreCreate = {
      trace_id: traceId,
      name,
      score_type: scoreType,
      value_numeric: scoreType === "numeric" ? parseFloat(valueNumeric) : undefined,
      value_boolean: scoreType === "boolean" ? valueBoolean === "true" : undefined,
      value_label: scoreType === "categorical" ? valueLabel : undefined,
      comment: comment || undefined,
    };
    await createScore.mutateAsync({ body, projectId });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Score name"
          className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <select
          value={scoreType}
          onChange={(e) => setScoreType(e.target.value as "numeric" | "boolean" | "categorical")}
          className="px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="numeric">Numeric</option>
          <option value="boolean">Boolean</option>
          <option value="categorical">Categorical</option>
        </select>
      </div>

      {scoreType === "numeric" && (
        <input
          type="number"
          step="0.1"
          min="0"
          max="5"
          value={valueNumeric}
          onChange={(e) => setValueNumeric(e.target.value)}
          placeholder="Value (0-5)"
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      {scoreType === "boolean" && (
        <select
          value={valueBoolean}
          onChange={(e) => setValueBoolean(e.target.value as "true" | "false")}
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="true">True / Yes</option>
          <option value="false">False / No</option>
        </select>
      )}
      {scoreType === "categorical" && (
        <input
          value={valueLabel}
          onChange={(e) => setValueLabel(e.target.value)}
          placeholder="Label (e.g. pass / fail)"
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (optional)"
        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createScore.isPending}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {createScore.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Save Score
        </button>
      </div>
    </form>
  );
}

export function ScorePanel({ traceId, projectId }: ScorePanelProps) {
  const { data: scores = [], isLoading } = useScores(projectId, traceId);
  const createScore = useCreateScore();
  const deleteScore = useDeleteScore();
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showJudgeModal, setShowJudgeModal] = useState(false);

  const handleQuickScore = async (
    type: "thumbs_up" | "thumbs_down" | "star",
    starValue?: number,
  ) => {
    const body: ScoreCreate =
      type === "thumbs_up"
        ? {
            trace_id: traceId,
            name: "thumbs",
            score_type: "boolean",
            value_boolean: true,
          }
        : type === "thumbs_down"
          ? {
              trace_id: traceId,
              name: "thumbs",
              score_type: "boolean",
              value_boolean: false,
            }
          : {
              trace_id: traceId,
              name: "stars",
              score_type: "numeric",
              value_numeric: starValue ?? 3,
            };

    await createScore.mutateAsync({ body, projectId });
  };

  return (
    <div className="border-t border-slate-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Scores</h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleQuickScore("thumbs_up")}
            disabled={createScore.isPending}
            className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
            title="Thumbs up"
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleQuickScore("thumbs_down")}
            disabled={createScore.isPending}
            className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
            title="Thumbs down"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleQuickScore("star", star)}
              disabled={createScore.isPending}
              className="p-1 rounded-md hover:bg-amber-50 text-slate-300 hover:text-amber-500 transition-colors disabled:opacity-50"
              title={`${star} stars`}
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Custom
          </button>
          <button
            onClick={() => setShowJudgeModal(true)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
          >
            <Bot className="h-3 w-3" />
            LLM Judge
          </button>
        </div>
      </div>

      {showCustomForm && (
        <CustomScoreForm
          traceId={traceId}
          projectId={projectId}
          onClose={() => setShowCustomForm(false)}
        />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading scores...
        </div>
      ) : scores.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">No scores yet. Use the buttons above to add one.</p>
      ) : (
        <div className="space-y-2">
          {scores.map((score) => (
            <div
              key={score.score_id}
              className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <ScoreBadge score={score} />
                  <span className="text-xs text-slate-400">
                    {score.scorer_type === "llm" ? "LLM Judge" : "Human"}
                  </span>
                </div>
                {score.comment && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{score.comment}</p>
                )}
              </div>
              <button
                onClick={() =>
                  deleteScore.mutateAsync({
                    scoreId: score.score_id,
                    projectId,
                    traceId,
                  })
                }
                className="p-1 rounded text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                title="Delete score"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showJudgeModal && (
        <LLMJudgeModal
          traceId={traceId}
          projectId={projectId}
          onClose={() => setShowJudgeModal(false)}
        />
      )}
    </div>
  );
}
