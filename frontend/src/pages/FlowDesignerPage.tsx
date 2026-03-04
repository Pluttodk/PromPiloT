import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Play,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  LayoutGrid,
} from "lucide-react";
import dagre from "dagre";
import { useFlow, useUpdateFlow, useExecuteFlow } from "../hooks/useFlows";
import { usePrompts } from "../hooks/usePrompts";
import { useModels } from "../hooks/useModels";
import { useProjectStore } from "../stores/projectStore";
import { FlowCanvas, type FlowCanvasHandle } from "../components/flows/FlowCanvas";
import { NodeConfigPanel } from "../components/flows/NodeConfigPanel";
import { extractVariables } from "../utils/promptVariables";
import type {
  FlowDefinition,
  FlowNodeData,
  Prompt,
  ModelConfigResponse,
  FlowExecuteResponse,
} from "../types/api";

interface ExecuteResultState {
  success: boolean;
  data?: FlowExecuteResponse;
  error?: string;
}

type PromptSource = "none" | "prompt" | "connection";

interface PromptNodeConfig {
  systemPromptSource: PromptSource;
  systemPromptId: string;
  userInputSource: PromptSource;
  userInputPromptId: string;
  modelConfigId: string;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;

/**
 * Compute a left-to-right DAG layout using dagre and return updated node positions.
 */
function computeDagreLayout(definition: FlowDefinition): FlowDefinition {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  definition.nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  definition.edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const updatedNodes = definition.nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { ...definition, nodes: updatedNodes };
}

export function FlowDesignerPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();

  const { data: flow, isLoading: flowLoading } = useFlow(
    currentProjectId ?? undefined,
    flowId
  );
  const { data: prompts } = usePrompts(currentProjectId ?? undefined);
  const { data: models } = useModels(currentProjectId ?? undefined);
  const updateFlow = useUpdateFlow();
  const executeFlow = useExecuteFlow();

  const [localDefinition, setLocalDefinition] = useState<FlowDefinition | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [executeInputValues, setExecuteInputValues] = useState<Record<string, string>>({});
  const [executeResult, setExecuteResult] = useState<ExecuteResultState | null>(null);
  const [showTraceDetails, setShowTraceDetails] = useState(false);

  const [nodeConfigValue, setNodeConfigValue] = useState("");

  const [promptNodeConfig, setPromptNodeConfig] = useState<PromptNodeConfig>({
    systemPromptSource: "none",
    systemPromptId: "",
    userInputSource: "connection",
    userInputPromptId: "",
    modelConfigId: "",
  });

  const inputNodes = useMemo(() => {
    if (!localDefinition) return [];
    return localDefinition.nodes
      .filter((node) => node.type === "input")
      .map((node) => ({
        id: node.id,
        name: node.data.name || node.id,
      }));
  }, [localDefinition]);

  const getPromptById = useCallback(
    (promptId: string): Prompt | undefined => {
      return prompts?.find((p) => p.prompt_id === promptId);
    },
    [prompts]
  );

  const lastSavedFlowIdRef = useRef<string | null>(null);
  const canvasRef = useRef<FlowCanvasHandle>(null);

  useEffect(() => {
    if (!flow) return;

    const flowIdChanged = lastSavedFlowIdRef.current !== flow.flow_id;

    if (!localDefinition || flowIdChanged) {
      setLocalDefinition(flow.definition);
      lastSavedFlowIdRef.current = flow.flow_id;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow]);

  useEffect(() => {
    const initialValues: Record<string, string> = {};
    inputNodes.forEach((node) => {
      if (!(node.id in executeInputValues)) {
        initialValues[node.id] = "";
      }
    });
    if (Object.keys(initialValues).length > 0) {
      setExecuteInputValues((prev) => ({ ...prev, ...initialValues }));
    }
  }, [inputNodes, executeInputValues]);

  /**
   * Sync panel fields ONLY when the selected node changes (different node ID).
   * Using a ref so we avoid re-running when localDefinition mutates from canvas
   * interactions (node moves, edge changes) while the user is mid-edit in the panel.
   */
  const localDefinitionRef = useRef(localDefinition);
  useEffect(() => {
    localDefinitionRef.current = localDefinition;
  }, [localDefinition]);

  useEffect(() => {
    if (!selectedNodeId) return;

    const definition = localDefinitionRef.current;
    if (!definition) return;

    const node = definition.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;

    setNodeConfigValue(node.data.name || "");

    if (node.type === "prompt") {
      setPromptNodeConfig({
        systemPromptSource: (node.data.system_prompt_source as PromptSource) || "none",
        systemPromptId: node.data.system_prompt_id || "",
        userInputSource: (node.data.user_input_source as PromptSource) || "connection",
        userInputPromptId: node.data.user_input_prompt_id || "",
        modelConfigId: node.data.model_config_id || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  const handleDefinitionChange = useCallback((definition: FlowDefinition) => {
    setLocalDefinition(definition);
    setHasChanges(true);
  }, []);

  const handleNodeSelect = useCallback(
    (nodeId: string | null, nodeType: string | null) => {
      setSelectedNodeId(nodeId);
      setSelectedNodeType(nodeType);
    },
    []
  );

  const handleSave = async () => {
    if (!currentProjectId || !flowId || !localDefinition) return;

    try {
      await updateFlow.mutateAsync({
        flowId,
        projectId: currentProjectId,
        data: { definition: localDefinition },
      });
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save flow:", err);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const handleNavigateBack = useCallback(() => {
    if (hasChanges) {
      if (!window.confirm("You have unsaved changes. Leave without saving?")) return;
    }
    navigate("/flows");
  }, [hasChanges, navigate]);

  const handleExecute = async () => {
    if (!currentProjectId || !flowId) return;

    if (hasChanges && localDefinition) {
      try {
        await updateFlow.mutateAsync({
          flowId,
          projectId: currentProjectId,
          data: { definition: localDefinition },
        });
        setHasChanges(false);
      } catch (err) {
        console.error("Failed to auto-save before execute:", err);
      }
    }

    setExecuteResult(null);
    setShowTraceDetails(false);

    try {
      const result = await executeFlow.mutateAsync({
        flowId,
        projectId: currentProjectId,
        data: { inputs: executeInputValues },
      });
      setExecuteResult({ success: true, data: result });
    } catch (err) {
      setExecuteResult({ success: false, error: String(err) });
    }
  };

  const handleSaveNodeConfig = useCallback(() => {
    if (!selectedNodeId || !localDefinition) return;

    const updatedNodes = localDefinition.nodes.map((node) => {
      if (node.id !== selectedNodeId) return node;

      if (node.type === "prompt") {
        const systemPrompt =
          promptNodeConfig.systemPromptSource === "prompt"
            ? getPromptById(promptNodeConfig.systemPromptId)
            : undefined;
        const userPrompt =
          promptNodeConfig.userInputSource === "prompt"
            ? getPromptById(promptNodeConfig.userInputPromptId)
            : undefined;

        const newData: FlowNodeData = {
          ...node.data,
          system_prompt_source: promptNodeConfig.systemPromptSource,
          system_prompt_id:
            promptNodeConfig.systemPromptSource === "prompt"
              ? promptNodeConfig.systemPromptId
              : undefined,
          systemPromptName: systemPrompt?.name,
          system_prompt_variables: systemPrompt
            ? extractVariables(systemPrompt.template)
            : undefined,
          user_input_source: promptNodeConfig.userInputSource,
          user_input_prompt_id:
            promptNodeConfig.userInputSource === "prompt"
              ? promptNodeConfig.userInputPromptId
              : undefined,
          userInputPromptName: userPrompt?.name,
          user_input_variables: userPrompt
            ? extractVariables(userPrompt.template)
            : undefined,
          model_config_id: promptNodeConfig.modelConfigId || undefined,
          modelName: promptNodeConfig.modelConfigId
            ? models?.find((m: ModelConfigResponse) => m.model_config_id === promptNodeConfig.modelConfigId)?.name
            : undefined,
        };

        return { ...node, data: newData };
      } else {
        return {
          ...node,
          data: { ...node.data, name: nodeConfigValue || undefined },
        };
      }
    });

    const updatedNode = updatedNodes.find((n) => n.id === selectedNodeId);
    if (updatedNode) {
      canvasRef.current?.updateNodeData(selectedNodeId, updatedNode.data);
    }

    setLocalDefinition({ ...localDefinition, nodes: updatedNodes });
    setHasChanges(true);
  }, [
    selectedNodeId,
    localDefinition,
    promptNodeConfig,
    nodeConfigValue,
    getPromptById,
    models,
  ]);

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(null);
    canvasRef.current?.deselectAll();
  }, []);

  const handleAutoLayout = useCallback(() => {
    if (!localDefinition || localDefinition.nodes.length === 0) return;
    const laid = computeDagreLayout(localDefinition);
    setLocalDefinition(laid);
    setHasChanges(true);
  }, [localDefinition]);

  const getOutputDisplay = () => {
    if (!executeResult?.data?.outputs) return null;
    const outputs = executeResult.data.outputs;
    const outputKeys = Object.keys(outputs);
    if (outputKeys.length === 0) return null;

    if (outputKeys.length === 1) {
      return String(outputs[outputKeys[0]] ?? "");
    }

    return outputKeys.map((key) => `**${key}:** ${outputs[key]}`).join("\n\n");
  };

  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId || !localDefinition) return null;
    return localDefinition.nodes.find((n) => n.id === selectedNodeId)?.data ?? null;
  }, [selectedNodeId, localDefinition]);

  if (!currentProjectId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No project selected</p>
        <button onClick={() => navigate("/projects")} className="btn-primary mt-4">
          Go to Projects
        </button>
      </div>
    );
  }

  if (flowLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Flow not found</p>
        <button onClick={() => navigate("/flows")} className="btn-primary mt-4">
          Back to Flows
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={handleNavigateBack} className="btn-secondary p-2">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{flow.name}</h1>
            <p className="text-sm text-muted-foreground">
              {flow.description || "No description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoLayout}
            className="btn-secondary"
            disabled={!localDefinition || localDefinition.nodes.length === 0}
            title="Auto-arrange nodes"
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Auto-arrange
          </button>
          <button
            onClick={() => setShowExecuteModal(true)}
            className="btn-secondary"
            disabled={!localDefinition || localDefinition.nodes.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Execute
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateFlow.isPending}
            className="btn-primary"
          >
            {updateFlow.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* Canvas + Config Panel */}
      <div className="flex-1 border rounded-lg overflow-hidden flex min-h-0">
        <div className="flex-1 min-w-0 h-full">
          {localDefinition && (
            <FlowCanvas
              ref={canvasRef}
              initialDefinition={localDefinition}
              prompts={prompts}
              models={models}
              onDefinitionChange={handleDefinitionChange}
              onNodeSelect={handleNodeSelect}
              onSave={handleSave}
            />
          )}
        </div>

        {selectedNodeId && selectedNodeType && selectedNodeData && (
          <NodeConfigPanel
            nodeId={selectedNodeId}
            nodeType={selectedNodeType}
            nodeData={selectedNodeData}
            prompts={prompts}
            models={models}
            promptConfig={promptNodeConfig}
            onPromptConfigChange={setPromptNodeConfig}
            nameValue={nodeConfigValue}
            onNameChange={setNodeConfigValue}
            onSave={handleSaveNodeConfig}
            onClose={handleClosePanel}
          />
        )}
      </div>

      {/* Execute Modal */}
      {showExecuteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-2xl shadow-lg max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-semibold mb-4">Execute Flow</h2>
            <div className="space-y-4">
              {inputNodes.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
                  No input nodes found in this flow. Add an input node to provide data.
                </div>
              ) : (
                inputNodes.map((node) => (
                  <div key={node.id}>
                    <label className="text-sm font-medium mb-1 block">{node.name}</label>
                    <textarea
                      value={executeInputValues[node.id] || ""}
                      onChange={(e) =>
                        setExecuteInputValues((prev) => ({
                          ...prev,
                          [node.id]: e.target.value,
                        }))
                      }
                      placeholder={`Enter value for ${node.name}...`}
                      className="input min-h-[80px]"
                    />
                  </div>
                ))
              )}

              {executeResult && (
                <div className="space-y-3">
                  {executeResult.success && executeResult.data ? (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Response</label>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {executeResult.data.execution_time_ms}ms
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                        <p className="text-sm text-green-900 whitespace-pre-wrap">
                          {getOutputDisplay() || "No output"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowTraceDetails(!showTraceDetails)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {showTraceDetails ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          {showTraceDetails ? "Hide" : "Show"} execution trace
                        </button>

                        {executeResult.data.trace_id && (
                          <button
                            type="button"
                            onClick={() => navigate(`/traces/${executeResult.data!.trace_id}`)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View full trace
                          </button>
                        )}
                      </div>

                      {showTraceDetails && (
                        <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-[200px]">
                          {JSON.stringify(executeResult.data, null, 2)}
                        </pre>
                      )}
                    </>
                  ) : (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">Execution Failed</p>
                          <p className="text-sm text-red-700 mt-1">{executeResult.error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowExecuteModal(false);
                  setExecuteResult(null);
                  setShowTraceDetails(false);
                }}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                onClick={handleExecute}
                disabled={executeFlow.isPending || inputNodes.length === 0}
                className="btn-primary"
              >
                {executeFlow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
