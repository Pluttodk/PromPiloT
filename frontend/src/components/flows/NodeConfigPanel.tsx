import { useMemo } from "react";
import { X, FileText, Plug, Server } from "lucide-react";
import { extractVariables } from "../../utils/promptVariables";
import type { FlowNodeData, Prompt, ModelConfigResponse } from "../../types/api";

type PromptSource = "none" | "prompt" | "connection";

interface PromptNodeConfig {
  systemPromptSource: PromptSource;
  systemPromptId: string;
  userInputSource: PromptSource;
  userInputPromptId: string;
  modelConfigId: string;
}

interface NodeConfigPanelProps {
  /** The selected node's id */
  nodeId: string;
  /** The selected node's type */
  nodeType: string;
  /** Current node data (read from localDefinition) */
  nodeData: FlowNodeData;
  /** Available prompts for the project */
  prompts: Prompt[] | undefined;
  /** Available model configs for the project */
  models: ModelConfigResponse[] | undefined;
  /** Prompt-node config state */
  promptConfig: PromptNodeConfig;
  /** Setter for the prompt-node config state */
  onPromptConfigChange: (config: PromptNodeConfig) => void;
  /** Name value for input/output nodes */
  nameValue: string;
  /** Setter for the name value */
  onNameChange: (name: string) => void;
  /** Save current configuration back to the flow definition */
  onSave: () => void;
  /** Close / deselect the panel */
  onClose: () => void;
}

/**
 * Inline right-side configuration panel for a selected flow node.
 * Replaces the modal-based configuration that blocked the canvas.
 */
export function NodeConfigPanel({
  nodeType,
  prompts,
  models,
  promptConfig,
  onPromptConfigChange,
  nameValue,
  onNameChange,
  onSave,
  onClose,
}: NodeConfigPanelProps) {
  const getPromptById = (promptId: string): Prompt | undefined =>
    prompts?.find((p) => p.prompt_id === promptId);

  const systemPromptVariables = useMemo(() => {
    if (promptConfig.systemPromptSource !== "prompt" || !promptConfig.systemPromptId) return [];
    const prompt = getPromptById(promptConfig.systemPromptId);
    return prompt ? extractVariables(prompt.template) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptConfig.systemPromptSource, promptConfig.systemPromptId, prompts]);

  const userInputVariables = useMemo(() => {
    if (promptConfig.userInputSource !== "prompt" || !promptConfig.userInputPromptId) return [];
    const prompt = getPromptById(promptConfig.userInputPromptId);
    return prompt ? extractVariables(prompt.template) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptConfig.userInputSource, promptConfig.userInputPromptId, prompts]);

  return (
    <div className="w-72 flex-shrink-0 border-l bg-background flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold capitalize">
          {nodeType === "prompt" ? "Prompt Node" : nodeType === "input" ? "Input Node" : "Output Node"}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Input / Output node: just a display name */}
        {nodeType !== "prompt" && (
          <div className="space-y-2">
            <label className="text-sm font-medium block">
              {nodeType === "input" ? "Display Name" : "Output Name"}
            </label>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={nodeType === "input" ? "User Input" : "Result"}
              className="input w-full"
            />
            <p className="text-xs text-muted-foreground">Visual identification only</p>
          </div>
        )}

        {/* Prompt node configuration */}
        {nodeType === "prompt" && (
          <>
            {/* System Prompt */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-violet-700 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                System Prompt
              </label>
              <div className="space-y-1.5 pl-2 border-l-2 border-violet-200">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="systemPromptSource"
                    checked={promptConfig.systemPromptSource === "none"}
                    onChange={() =>
                      onPromptConfigChange({
                        ...promptConfig,
                        systemPromptSource: "none",
                        systemPromptId: "",
                      })
                    }
                  />
                  None
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="systemPromptSource"
                    checked={promptConfig.systemPromptSource === "prompt"}
                    onChange={() =>
                      onPromptConfigChange({ ...promptConfig, systemPromptSource: "prompt" })
                    }
                  />
                  Use stored prompt
                </label>
                {promptConfig.systemPromptSource === "prompt" && (
                  <div className="ml-5 space-y-1">
                    <select
                      value={promptConfig.systemPromptId}
                      onChange={(e) =>
                        onPromptConfigChange({ ...promptConfig, systemPromptId: e.target.value })
                      }
                      className="input text-sm w-full"
                    >
                      <option value="">-- Select prompt --</option>
                      {prompts?.map((p) => (
                        <option key={p.prompt_id} value={p.prompt_id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {systemPromptVariables.length > 0 && (
                      <div className="p-2 rounded bg-violet-50 text-xs">
                        <span className="font-medium text-violet-700">Variables: </span>
                        {systemPromptVariables.map((v, i) => (
                          <span key={v} className="text-violet-600">
                            {v}
                            {i < systemPromptVariables.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="systemPromptSource"
                    checked={promptConfig.systemPromptSource === "connection"}
                    onChange={() =>
                      onPromptConfigChange({
                        ...promptConfig,
                        systemPromptSource: "connection",
                        systemPromptId: "",
                      })
                    }
                  />
                  <Plug className="w-3 h-3" /> From connection
                </label>
              </div>
            </div>

            {/* User Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                User Input
              </label>
              <div className="space-y-1.5 pl-2 border-l-2 border-blue-200">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="userInputSource"
                    checked={promptConfig.userInputSource === "none"}
                    onChange={() =>
                      onPromptConfigChange({
                        ...promptConfig,
                        userInputSource: "none",
                        userInputPromptId: "",
                      })
                    }
                  />
                  None
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="userInputSource"
                    checked={promptConfig.userInputSource === "prompt"}
                    onChange={() =>
                      onPromptConfigChange({ ...promptConfig, userInputSource: "prompt" })
                    }
                  />
                  Use stored prompt
                </label>
                {promptConfig.userInputSource === "prompt" && (
                  <div className="ml-5 space-y-1">
                    <select
                      value={promptConfig.userInputPromptId}
                      onChange={(e) =>
                        onPromptConfigChange({
                          ...promptConfig,
                          userInputPromptId: e.target.value,
                        })
                      }
                      className="input text-sm w-full"
                    >
                      <option value="">-- Select prompt --</option>
                      {prompts?.map((p) => (
                        <option key={p.prompt_id} value={p.prompt_id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {userInputVariables.length > 0 && (
                      <div className="p-2 rounded bg-blue-50 text-xs">
                        <span className="font-medium text-blue-700">Variables: </span>
                        {userInputVariables.map((v, i) => (
                          <span key={v} className="text-blue-600">
                            {v}
                            {i < userInputVariables.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="userInputSource"
                    checked={promptConfig.userInputSource === "connection"}
                    onChange={() =>
                      onPromptConfigChange({
                        ...promptConfig,
                        userInputSource: "connection",
                        userInputPromptId: "",
                      })
                    }
                  />
                  <Plug className="w-3 h-3" /> From connection
                </label>
              </div>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Server className="w-4 h-4" />
                Model
              </label>
              <select
                value={promptConfig.modelConfigId}
                onChange={(e) =>
                  onPromptConfigChange({ ...promptConfig, modelConfigId: e.target.value })
                }
                className="input w-full"
              >
                <option value="">-- Select model --</option>
                {models?.map((m) => (
                  <option key={m.model_config_id} value={m.model_config_id}>
                    {m.name} ({m.deployment_name})
                  </option>
                ))}
              </select>
              {!promptConfig.modelConfigId && (
                <p className="text-xs text-amber-600">Please select a model</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t">
        <button onClick={onSave} className="btn-primary w-full">
          Apply
        </button>
      </div>
    </div>
  );
}
