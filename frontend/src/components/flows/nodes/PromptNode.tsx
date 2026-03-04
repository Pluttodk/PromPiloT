import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import { MessageSquare, Server, FileText, Plug } from "lucide-react";
import { getVariableHandleId } from "../../../utils/promptVariables";

export interface PromptNodeData {
  label?: string;
  model_config_id?: string;
  modelName?: string;

  // System prompt configuration
  system_prompt_source?: "prompt" | "connection" | "none";
  system_prompt_id?: string;
  systemPromptName?: string;
  system_prompt_variables?: string[];

  // User input configuration
  user_input_source?: "prompt" | "connection" | "none";
  user_input_prompt_id?: string;
  userInputPromptName?: string;
  user_input_variables?: string[];

  // Legacy
  prompt_id?: string;
  promptName?: string;
}

function getPromptValidationStatus(data: PromptNodeData): "green" | "amber" | "red" {
  const hasModel = Boolean(data.model_config_id);
  const hasSystem = data.system_prompt_source === "prompt"
    ? Boolean(data.system_prompt_id)
    : data.system_prompt_source === "connection" || data.system_prompt_source === "none";
  const hasUser = data.user_input_source === "prompt"
    ? Boolean(data.user_input_prompt_id)
    : data.user_input_source === "connection" || data.user_input_source === "none";

  const isFullyConfigured =
    hasModel &&
    (data.system_prompt_source === "prompt" ? Boolean(data.system_prompt_id) : true) &&
    (data.user_input_source === "prompt" ? Boolean(data.user_input_prompt_id) : true) &&
    (data.system_prompt_source !== undefined) &&
    (data.user_input_source !== undefined);

  if (!data.system_prompt_source && !data.user_input_source && !data.model_config_id) return "red";
  if (isFullyConfigured && hasSystem && hasUser) return "green";
  return "amber";
}

function PromptNode({ data, selected }: NodeProps<PromptNodeData>) {
  const systemVars = data.system_prompt_variables || [];
  const userVars = data.user_input_variables || [];
  const validationStatus = getPromptValidationStatus(data);
  const hasSystemConnection = data.system_prompt_source === "connection";
  const hasUserConnection = data.user_input_source === "connection";

  const allHandles: { id: string; label: string; type: "system" | "user" | "direct" }[] = [];

  if (hasSystemConnection) {
    allHandles.push({ id: "system_prompt", label: "System Prompt", type: "direct" });
  }

  systemVars.forEach((varName) => {
    allHandles.push({
      id: getVariableHandleId("system", varName),
      label: varName,
      type: "system",
    });
  });

  if (hasUserConnection) {
    allHandles.push({ id: "user_input", label: "User Input", type: "direct" });
  }

  userVars.forEach((varName) => {
    allHandles.push({
      id: getVariableHandleId("user", varName),
      label: varName,
      type: "user",
    });
  });

  const nodeHeight = Math.max(80, 60 + allHandles.length * 22);

  const getHandleColor = (type: "system" | "user" | "direct") => {
    switch (type) {
      case "system":
        return "#8b5cf6";
      case "user":
        return "#3b82f6";
      case "direct":
        return "#10b981";
    }
  };

  const badgeColor =
    validationStatus === "green"
      ? "bg-green-500"
      : validationStatus === "amber"
      ? "bg-amber-400"
      : "bg-red-500";

  return (
    <div
      className={`rounded-xl border-2 bg-white shadow-sm min-w-[200px] ${
        selected ? "border-blue-500 shadow-md" : "border-slate-200"
      }`}
      style={{ minHeight: nodeHeight }}
    >
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-800">Prompt</span>
          </div>
          <span
            className={`w-2.5 h-2.5 rounded-full ${badgeColor} flex-shrink-0`}
            title={`Node is ${validationStatus === "green" ? "fully configured" : validationStatus === "amber" ? "partially configured" : "not configured"}`}
          />
        </div>
      </div>

      <div className="px-4 py-2 space-y-1 relative">
        {allHandles.map((handle, index) => (
          <div key={handle.id} className="relative">
            <Handle
              type="target"
              position={Position.Left}
              id={handle.id}
              style={{
                top: 44 + index * 22 + 11,
                left: -6,
                width: 12,
                height: 12,
                backgroundColor: getHandleColor(handle.type),
                border: "2px solid white",
              }}
            />
            <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-2">
              {handle.type === "direct" ? (
                <Plug className="w-3 h-3 text-emerald-500" />
              ) : handle.type === "system" ? (
                <span className="w-2 h-2 rounded-full bg-violet-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-blue-400" />
              )}
              <span className={handle.type === "direct" ? "font-medium" : ""}>
                {handle.label}
              </span>
            </div>
          </div>
        ))}

        {allHandles.length === 0 && (
          <div className="text-xs text-slate-400 italic py-2">
            Configure prompts to show inputs
          </div>
        )}

        <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
          {data.system_prompt_source === "prompt" && data.systemPromptName && (
            <div className="flex items-center gap-1 text-xs text-violet-600">
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[150px]">Sys: {data.systemPromptName}</span>
            </div>
          )}
          {data.user_input_source === "prompt" && data.userInputPromptName && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[150px]">User: {data.userInputPromptName}</span>
            </div>
          )}
          {data.modelName && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Server className="w-3 h-3" />
              <span className="truncate max-w-[150px]">{data.modelName}</span>
            </div>
          )}
          {!data.system_prompt_source && !data.user_input_source && (
            <div className="text-xs text-amber-600">Not configured</div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          top: "50%",
          right: -6,
          width: 12,
          height: 12,
          backgroundColor: "#3b82f6",
          border: "2px solid white",
        }}
      />
    </div>
  );
}

export default memo(PromptNode);
