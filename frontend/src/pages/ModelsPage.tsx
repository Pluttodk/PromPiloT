import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Server, Trash2, Loader2, ArrowLeft, ChevronRight, Pencil, Play } from "lucide-react";
import { useModels, useCreateModel, useUpdateModel, useDeleteModel, useTestModel } from "../hooks/useModels";
import { useProject } from "../hooks/useProjects";
import { useProjectStore } from "../stores/projectStore";
import type { ModelConfigResponse, ModelConfigCreate, ModelConfigUpdate } from "../types/api";

export function ModelsPage() {
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();
  const { data: project } = useProject(currentProjectId ?? undefined);
  const { data: models, isLoading } = useModels(currentProjectId ?? undefined);
  const createModel = useCreateModel();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const testModel = useTestModel();

  const [selectedModel, setSelectedModel] = useState<ModelConfigResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [showPlayground, setShowPlayground] = useState(false);
  const [playgroundModel, setPlaygroundModel] = useState<ModelConfigResponse | null>(null);
  const [playgroundPrompt, setPlaygroundPrompt] = useState("");
  const [playgroundSystemPrompt, setPlaygroundSystemPrompt] = useState("");
  const [playgroundResponse, setPlaygroundResponse] = useState<string | null>(null);
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ModelConfigCreate>({
    name: "",
    provider: "azure_openai",
    endpoint: "",
    deployment_name: "",
    api_version: "2024-02-01",
    auth_method: "default_credential",
  });

  if (!currentProjectId) {
    return (
      <div className="text-center py-12">
        <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No project selected</h3>
        <p className="text-muted-foreground mb-4">Select a project first to manage models</p>
        <button onClick={() => navigate("/")} className="btn-primary">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Projects
        </button>
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      name: "",
      provider: "azure_openai",
      endpoint: "",
      deployment_name: "",
      api_version: "2024-02-01",
      auth_method: "default_credential",
    });
    setIsEditing(false);
    setSelectedModel(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (model: ModelConfigResponse) => {
    setSelectedModel(model);
    setFormData({
      name: model.name,
      provider: model.provider,
      endpoint: model.endpoint,
      deployment_name: model.deployment_name,
      api_version: model.api_version,
      auth_method: model.auth_method,
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleOpenPlayground = (model: ModelConfigResponse) => {
    setPlaygroundModel(model);
    setPlaygroundPrompt("");
    setPlaygroundSystemPrompt("");
    setPlaygroundResponse(null);
    setPlaygroundError(null);
    setShowPlayground(true);
  };

  const handleTestModel = async () => {
    if (!playgroundModel || !currentProjectId || !playgroundPrompt.trim()) return;

    setPlaygroundResponse(null);
    setPlaygroundError(null);

    try {
      const result = await testModel.mutateAsync({
        modelConfigId: playgroundModel.model_config_id,
        projectId: currentProjectId,
        data: {
          prompt: playgroundPrompt,
          system_prompt: playgroundSystemPrompt || undefined,
        },
      });
      setPlaygroundResponse(result.response);
    } catch (err) {
      setPlaygroundError(err instanceof Error ? err.message : "Test failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectId) return;

    try {
      if (isEditing && selectedModel) {
        const updateData: ModelConfigUpdate = {
          name: formData.name,
          provider: formData.provider,
          endpoint: formData.endpoint,
          deployment_name: formData.deployment_name,
          api_version: formData.api_version,
          auth_method: formData.auth_method,
        };
        await updateModel.mutateAsync({
          modelConfigId: selectedModel.model_config_id,
          projectId: currentProjectId,
          data: updateData,
        });
      } else {
        await createModel.mutateAsync({
          projectId: currentProjectId,
          data: formData,
        });
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Failed to save model:", err);
    }
  };

  const handleDeleteModel = async (e: React.MouseEvent, model: ModelConfigResponse) => {
    e.stopPropagation();
    if (!currentProjectId) return;
    if (window.confirm(`Delete model "${model.name}"?`)) {
      await deleteModel.mutateAsync({
        modelConfigId: model.model_config_id,
        projectId: currentProjectId,
      });
    }
  };

  const isPending = createModel.isPending || updateModel.isPending;

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={() => navigate("/")} className="hover:text-foreground">
          Projects
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{project?.name || "Loading..."}</span>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Model Configurations</h1>
        <button onClick={handleOpenCreate} className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add Model
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : models && models.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <div
              key={model.model_config_id}
              className="border rounded-lg bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">{model.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenPlayground(model)}
                    className="p-1.5 hover:bg-green-100 hover:text-green-600 rounded"
                    title="Test model"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(model)}
                    className="p-1.5 hover:bg-accent rounded"
                    title="Edit model"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteModel(e, model)}
                    className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded"
                    title="Delete model"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium">Provider:</span> {model.provider}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Deployment:</span> {model.deployment_name}
                </p>
                <p className="text-muted-foreground truncate" title={model.endpoint}>
                  <span className="font-medium">Endpoint:</span> {model.endpoint}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Auth:</span>{" "}
                  {model.auth_method === "default_credential" ? "Azure Managed Identity" : "API Key"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg bg-card">
          <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No models configured</h3>
          <p className="text-muted-foreground mb-4">
            Add model configurations to use in your flows
          </p>
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Model
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-4">
              {isEditing ? "Edit Model" : "Add New Model"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="GPT-4o Production"
                    className="input"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Provider</label>
                  <select
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="input"
                  >
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Endpoint</label>
                  <input
                    type="text"
                    value={formData.endpoint}
                    onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    placeholder="https://your-resource.openai.azure.com"
                    className="input"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Deployment Name</label>
                  <input
                    type="text"
                    value={formData.deployment_name}
                    onChange={(e) => setFormData({ ...formData, deployment_name: e.target.value })}
                    placeholder="gpt-4o"
                    className="input"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">API Version</label>
                  <input
                    type="text"
                    value={formData.api_version}
                    onChange={(e) => setFormData({ ...formData, api_version: e.target.value })}
                    placeholder="2024-02-01"
                    className="input"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Authentication Method</label>
                  <select
                    value={formData.auth_method}
                    onChange={(e) => setFormData({ ...formData, auth_method: e.target.value })}
                    className="input"
                  >
                    <option value="default_credential">Azure Managed Identity (DefaultAzureCredential)</option>
                    <option value="api_key">API Key</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.auth_method === "default_credential"
                      ? "Uses Azure Managed Identity for secure, keyless authentication"
                      : "Uses API key from environment variable"}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.name.trim() || !formData.endpoint.trim() || isPending}
                  className="btn-primary"
                >
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isEditing ? "Save Changes" : "Add Model"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlayground && playgroundModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-2xl shadow-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Model Playground</h2>
                <p className="text-sm text-muted-foreground">
                  Testing: {playgroundModel.name} ({playgroundModel.deployment_name})
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">System Prompt (optional)</label>
                <textarea
                  value={playgroundSystemPrompt}
                  onChange={(e) => setPlaygroundSystemPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                  className="input min-h-[60px] resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Prompt</label>
                <textarea
                  value={playgroundPrompt}
                  onChange={(e) => setPlaygroundPrompt(e.target.value)}
                  placeholder="Enter your prompt here..."
                  className="input min-h-[120px]"
                  autoFocus
                />
              </div>

              {playgroundError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {playgroundError}
                </div>
              )}

              {playgroundResponse && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Response</label>
                  <div className="p-4 rounded-lg bg-muted text-sm whitespace-pre-wrap max-h-[300px] overflow-auto">
                    {playgroundResponse}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowPlayground(false);
                  setPlaygroundModel(null);
                }}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                onClick={handleTestModel}
                disabled={!playgroundPrompt.trim() || testModel.isPending}
                className="btn-primary"
              >
                {testModel.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
