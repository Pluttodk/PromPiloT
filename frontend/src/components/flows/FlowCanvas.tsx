import { useCallback, useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  MarkerType,
} from "reactflow";
import type { Node, Edge, Connection, ReactFlowInstance, DefaultEdgeOptions } from "reactflow";
import "reactflow/dist/style.css";
import { Layers, GitBranch, Square } from "lucide-react";

import { InputNode, PromptNode, OutputNode } from "./nodes";
import { NodePalette } from "./NodePalette";
import { extractVariables } from "../../utils/promptVariables";
import type { FlowDefinition, FlowNode, FlowNodeData, Prompt, ModelConfigResponse } from "../../types/api";

const defaultEdgeOptions: DefaultEdgeOptions = {
  style: { strokeWidth: 2, stroke: "#64748b" },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "#64748b",
  },
  focusable: true,
  deletable: true,
  selectable: true,
};

const nodeTypes = {
  input: InputNode,
  prompt: PromptNode,
  output: OutputNode,
};

const EMPTY_PROMPTS: Prompt[] = [];
const EMPTY_MODELS: ModelConfigResponse[] = [];

const TEMPLATES: {
  id: string;
  label: string;
  description: string;
  definition: FlowDefinition;
}[] = [
  {
    id: "simple-qa",
    label: "Simple Q&A",
    description: "Input → Prompt → Output",
    definition: {
      nodes: [
        { id: "node_0", type: "input", data: { name: "User Input", label: "Input" }, position: { x: 80, y: 160 } },
        { id: "node_1", type: "prompt", data: { label: "Prompt", system_prompt_source: "none", user_input_source: "connection" }, position: { x: 340, y: 140 } },
        { id: "node_2", type: "output", data: { name: "Result", label: "Output" }, position: { x: 620, y: 160 } },
      ],
      edges: [
        { id: "e_0_1", source: "node_0", target: "node_1", targetHandle: "user_input" },
        { id: "e_1_2", source: "node_1", target: "node_2" },
      ],
    },
  },
  {
    id: "multi-step",
    label: "Multi-step Chain",
    description: "Input → Prompt 1 → Prompt 2 → Output",
    definition: {
      nodes: [
        { id: "node_0", type: "input", data: { name: "User Input", label: "Input" }, position: { x: 60, y: 160 } },
        { id: "node_1", type: "prompt", data: { label: "Prompt 1", system_prompt_source: "none", user_input_source: "connection" }, position: { x: 300, y: 140 } },
        { id: "node_2", type: "prompt", data: { label: "Prompt 2", system_prompt_source: "none", user_input_source: "connection" }, position: { x: 560, y: 140 } },
        { id: "node_3", type: "output", data: { name: "Result", label: "Output" }, position: { x: 820, y: 160 } },
      ],
      edges: [
        { id: "e_0_1", source: "node_0", target: "node_1", targetHandle: "user_input" },
        { id: "e_1_2", source: "node_1", target: "node_2", targetHandle: "user_input" },
        { id: "e_2_3", source: "node_2", target: "node_3" },
      ],
    },
  },
  {
    id: "blank",
    label: "Blank",
    description: "Start from scratch",
    definition: { nodes: [], edges: [] },
  },
];

export interface FlowCanvasHandle {
  updateNodeData: (nodeId: string, data: FlowNodeData) => void;
  deselectAll: () => void;
}

interface FlowCanvasProps {
  initialDefinition?: FlowDefinition;
  prompts?: Prompt[];
  models?: ModelConfigResponse[];
  onDefinitionChange?: (definition: FlowDefinition) => void;
  onNodeSelect?: (nodeId: string | null, nodeType: string | null) => void;
  onSave?: () => void;
}

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY_LENGTH = 50;

function getNextNodeId(existingNodes: { id: string }[]): () => string {
  let maxId = 0;
  existingNodes.forEach((node) => {
    const match = node.id.match(/^node_(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= maxId) {
        maxId = num + 1;
      }
    }
  });
  return () => `node_${maxId++}`;
}

function enrichNodeData(
  node: FlowNode,
  prompts: Prompt[],
  models: ModelConfigResponse[]
): Node {
  const data = { ...node.data };

  if (node.type === "prompt") {
    if (data.model_config_id) {
      const model = models.find((m) => m.model_config_id === data.model_config_id);
      data.modelName = model?.name;
    }

    if (data.system_prompt_source === "prompt" && data.system_prompt_id) {
      const prompt = prompts.find((p) => p.prompt_id === data.system_prompt_id);
      if (prompt) {
        data.systemPromptName = prompt.name;
        data.system_prompt_variables = extractVariables(prompt.template);
      }
    }

    if (data.user_input_source === "prompt" && data.user_input_prompt_id) {
      const prompt = prompts.find((p) => p.prompt_id === data.user_input_prompt_id);
      if (prompt) {
        data.userInputPromptName = prompt.name;
        data.user_input_variables = extractVariables(prompt.template);
      }
    }
  }

  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data,
  };
}

const FlowCanvasInner = forwardRef<FlowCanvasHandle, FlowCanvasProps>(function FlowCanvasInner({
  initialDefinition,
  prompts = EMPTY_PROMPTS,
  models = EMPTY_MODELS,
  onDefinitionChange,
  onNodeSelect,
  onSave,
}, ref) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const isInitialized = useRef(false);
  const isSyncingFromProps = useRef(false);
  const [selectedNode, setSelectedNode] = useState<{ id: string; type: string | null } | null>(
    null
  );
  const getIdRef = useRef(getNextNodeId(initialDefinition?.nodes || []));

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const hasInitialized = useRef(false);

  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef(-1);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const saveToHistory = useCallback(() => {
    if (skipNextSaveCountRef.current > 0) {
      skipNextSaveCountRef.current--;
      return;
    }
    if (isSyncingFromProps.current) return;

    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    if (currentNodes.length === 0) return;

    const stripSelectionState = (nodes: Node[], edges: Edge[]) => ({
      nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
    });

    const currentStripped = stripSelectionState(currentNodes, currentEdges);
    const lastState = historyRef.current[historyIndexRef.current];

    if (lastState) {
      const lastStripped = stripSelectionState(lastState.nodes, lastState.edges);
      if (JSON.stringify(lastStripped) === JSON.stringify(currentStripped)) {
        return;
      }
    }

    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges)),
    };

    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }

    historyRef.current.push(currentState);
    if (historyRef.current.length > MAX_HISTORY_LENGTH) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
  }, []);

  const skipNextSaveCountRef = useRef(0);

  const undo = useCallback(() => {
    if (historyIndexRef.current < 1) return;

    skipNextSaveCountRef.current = 2;
    historyIndexRef.current--;
    const previousState = historyRef.current[historyIndexRef.current];

    if (previousState) {
      setNodes(previousState.nodes);
      setEdges(previousState.edges);
    }
  }, [setNodes, setEdges]);

  useImperativeHandle(ref, () => ({
    updateNodeData: (nodeId: string, data: FlowNodeData) => {
      isSyncingFromProps.current = true;
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data } : n)));
    },
    deselectAll: () => {
      isSyncingFromProps.current = true;
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    },
  }), [setNodes]);

  useEffect(() => {
    if (!initialDefinition) return;

    const enrichedNodes = initialDefinition.nodes.map((node) =>
      enrichNodeData(node, prompts, models)
    );

    const newEdges: Edge[] = initialDefinition.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      focusable: true,
      deletable: true,
      selectable: true,
      style: { strokeWidth: 2, stroke: "#64748b" },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#64748b",
      },
    }));

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      isSyncingFromProps.current = true;
      setNodes(enrichedNodes);
      setEdges(newEdges);
      return;
    }

    setNodes((currentNodes) => {
      const currentNodeIds = new Set(currentNodes.map((n) => n.id));
      const newNodeIds = new Set(enrichedNodes.map((n) => n.id));

      const nodesAdded = enrichedNodes.filter((n) => !currentNodeIds.has(n.id));
      const nodesRemoved = currentNodes.filter((n) => !newNodeIds.has(n.id));

      if (nodesAdded.length > 0 || nodesRemoved.length > 0) {
        isSyncingFromProps.current = true;
        return enrichedNodes.map((n) => {
          const existing = currentNodes.find((c) => c.id === n.id);
          return existing ? { ...n, selected: existing.selected, dragging: existing.dragging } : n;
        });
      }

      let hasAnyChange = false;
      const updatedNodes = currentNodes.map((node) => {
        const enrichedNode = enrichedNodes.find((n) => n.id === node.id);
        if (!enrichedNode) return node;

        const hasDataChanged =
          JSON.stringify(node.data) !== JSON.stringify(enrichedNode.data) ||
          node.position.x !== enrichedNode.position.x ||
          node.position.y !== enrichedNode.position.y;

        if (hasDataChanged) {
          hasAnyChange = true;
          return { ...enrichedNode, selected: node.selected, dragging: node.dragging };
        }
        return node;
      });

      if (hasAnyChange) {
        isSyncingFromProps.current = true;
        return updatedNodes;
      }
      return currentNodes;
    });

    setEdges((currentEdges) => {
      if (JSON.stringify(currentEdges) !== JSON.stringify(newEdges)) {
        isSyncingFromProps.current = true;
        return newEdges;
      }
      return currentEdges;
    });
  }, [initialDefinition, prompts, models, setNodes, setEdges]);

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }

    if (isSyncingFromProps.current) {
      isSyncingFromProps.current = false;
      return;
    }

    if (onDefinitionChange) {
      const definition: FlowDefinition = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type || "unknown",
          data: {
            name: n.data?.name,
            label: n.data?.label,
            model_config_id: n.data?.model_config_id,
            system_prompt_source: n.data?.system_prompt_source,
            system_prompt_id: n.data?.system_prompt_id,
            systemPromptName: n.data?.systemPromptName,
            system_prompt_variables: n.data?.system_prompt_variables,
            user_input_source: n.data?.user_input_source,
            user_input_prompt_id: n.data?.user_input_prompt_id,
            userInputPromptName: n.data?.userInputPromptName,
            user_input_variables: n.data?.user_input_variables,
            prompt_id: n.data?.prompt_id,
          },
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || undefined,
          targetHandle: e.targetHandle || undefined,
        })),
      };
      onDefinitionChange(definition);
    }
  }, [nodes, edges, onDefinitionChange]);

  useEffect(() => {
    if (onNodeSelect) {
      if (selectedNode) {
        onNodeSelect(selectedNode.id, selectedNode.type);
      } else {
        onNodeSelect(null, null);
      }
    }
  }, [selectedNode, onNodeSelect]);

  useEffect(() => {
    if (isSyncingFromProps.current) return;

    if (nodes.length > 0) {
      saveToHistory();
    }
  }, [nodes, edges, saveToHistory]);

  useEffect(() => {
    if (nodes.length > 0 && historyRef.current.length === 0) {
      saveToHistory();
    }
  }, [nodes.length, saveToHistory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        onSave?.();
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedEdgeRef.current) {
        event.preventDefault();
        saveToHistory();
        setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeRef.current));
        selectedEdgeRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, onSave, setEdges, saveToHistory]);

  const onConnect = useCallback(
    (params: Connection) => {
      saveToHistory();
      const handleSuffix = params.targetHandle ? `_${params.targetHandle}` : "";
      const edgeId = `e_${params.source}_${params.target}${handleSuffix}`;
      setEdges((eds) => addEdge({ ...params, id: edgeId }, eds));
    },
    [setEdges, saveToHistory]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      saveToHistory();

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getIdRef.current(),
        type,
        position,
        data: {
          name: type === "input" ? "Input" : type === "output" ? "Output" : undefined,
          label: type.charAt(0).toUpperCase() + type.slice(1),
          system_prompt_source: type === "prompt" ? "none" : undefined,
          user_input_source: type === "prompt" ? "connection" : undefined,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, saveToHistory]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (selectedNodes.length > 0) {
      const node = selectedNodes[0];
      setSelectedNode({ id: node.id, type: node.type || null });
    } else {
      setSelectedNode(null);
    }
  }, []);

  const selectedEdgeRef = useRef<string | null>(null);

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      selectedEdgeRef.current = edge.id;
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: e.id === edge.id,
        }))
      );
    },
    [setEdges]
  );

  const handlePaneClick = useCallback(() => {
    selectedEdgeRef.current = null;
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: false,
      }))
    );
  }, [setEdges]);

  const handleSelectTemplate = useCallback(
    (definition: FlowDefinition) => {
      if (definition.nodes.length === 0) return;

      const enrichedNodes = definition.nodes.map((node) =>
        enrichNodeData(node, prompts, models)
      );

      const newEdges: Edge[] = definition.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        focusable: true,
        deletable: true,
        selectable: true,
        style: { strokeWidth: 2, stroke: "#64748b" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
      }));

      isSyncingFromProps.current = false;
      setNodes(enrichedNodes);
      setEdges(newEdges);
    },
    [prompts, models, setNodes, setEdges]
  );

  return (
    <div className="flex h-full">
      <NodePalette onDragStart={onDragStart} />
      <div ref={reactFlowWrapper} className="flex-1 h-full relative">
        {nodes.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto bg-background/95 border rounded-2xl shadow-lg p-8 max-w-md w-full mx-4">
              <h3 className="text-base font-semibold text-center mb-1">Start building your flow</h3>
              <p className="text-xs text-muted-foreground text-center mb-6">
                Pick a template to get started or drag nodes from the palette
              </p>
              <div className="grid grid-cols-3 gap-3">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl.definition)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors text-center"
                  >
                    {tpl.id === "simple-qa" && <Layers className="h-6 w-6 text-blue-500" />}
                    {tpl.id === "multi-step" && <GitBranch className="h-6 w-6 text-violet-500" />}
                    {tpl.id === "blank" && <Square className="h-6 w-6 text-slate-400" />}
                    <span className="text-xs font-medium leading-tight">{tpl.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{tpl.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onSelectionChange={handleSelectionChange}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          selectionKeyCode={null}
          multiSelectionKeyCode={["Shift"]}
          edgesFocusable={true}
          edgesUpdatable={true}
          elementsSelectable={true}
          selectNodesOnDrag={false}
          className="bg-gray-50"
        >
          <Controls />
          <MiniMap />
          <Background gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
});

export const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(function FlowCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
