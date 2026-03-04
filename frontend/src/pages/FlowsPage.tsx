import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, GitBranch, Trash2, Loader2 } from "lucide-react";
import { useFlows, useCreateFlow, useDeleteFlow } from "../hooks/useFlows";
import { useProjectStore } from "../stores/projectStore";
import type { Flow } from "../types/api";

export function FlowsPage() {
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();
  const { data: flows, isLoading, error } = useFlows(currentProjectId ?? undefined);
  const createFlow = useCreateFlow();
  const deleteFlow = useDeleteFlow();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlowName.trim() || !currentProjectId) return;

    try {
      const newFlow = await createFlow.mutateAsync({
        projectId: currentProjectId,
        data: {
          name: newFlowName,
          description: newFlowDescription,
          definition: { nodes: [], edges: [] },
        },
      });
      setNewFlowName("");
      setNewFlowDescription("");
      setShowCreateModal(false);
      navigate(`/flows/${newFlow.flow_id}`);
    } catch (err) {
      console.error("Failed to create flow:", err);
    }
  };

  const handleSelectFlow = (flow: Flow) => {
    navigate(`/flows/${flow.flow_id}`);
  };

  const handleDeleteFlow = async (e: React.MouseEvent, flowId: string) => {
    e.stopPropagation();
    if (!currentProjectId) return;
    if (window.confirm("Are you sure you want to delete this flow?")) {
      await deleteFlow.mutateAsync({ flowId, projectId: currentProjectId });
    }
  };

  if (!currentProjectId) {
    return (
      <div className="text-center py-12">
        <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No project selected</h3>
        <p className="text-muted-foreground mb-4">
          Select a project from the sidebar to view flows
        </p>
        <button onClick={() => navigate("/projects")} className="btn-primary">
          Go to Projects
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load flows</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Flows</h1>
          <p className="text-muted-foreground">Design and manage prompt flows</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Flow
        </button>
      </div>

      {flows && flows.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No flows yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first flow to chain prompts together
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Create Flow
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows?.map((flow) => (
            <div
              key={flow.flow_id}
              onClick={() => handleSelectFlow(flow)}
              className="card p-4 cursor-pointer hover:border-primary transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{flow.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {flow.description || "No description"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteFlow(e, flow.flow_id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs text-muted-foreground">
                <span>{flow.definition.nodes.length} nodes</span>
                <span>Updated {new Date(flow.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Create New Flow</h2>
            <form onSubmit={handleCreateFlow}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Flow Name</label>
                  <input
                    type="text"
                    value={newFlowName}
                    onChange={(e) => setNewFlowName(e.target.value)}
                    placeholder="My Flow"
                    className="input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <textarea
                    value={newFlowDescription}
                    onChange={(e) => setNewFlowDescription(e.target.value)}
                    placeholder="Optional description..."
                    className="input min-h-[80px] resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFlowName.trim() || createFlow.isPending}
                  className="btn-primary"
                >
                  {createFlow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Flow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
