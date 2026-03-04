import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Editor, { DiffEditor } from "@monaco-editor/react";
import {
  Plus,
  FileText,
  Trash2,
  Loader2,
  Save,
  ArrowLeft,
  ChevronRight,
  Crown,
  GitBranch,
  Eye,
  X,
  AlertTriangle,
  ArrowRight,
  GitCompare,
} from "lucide-react";
import {
  usePrompts,
  usePrompt,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  usePromptVersions,
  useCreateVersion,
  useSetVersionTags,
} from "../hooks/usePrompts";
import { useProject } from "../hooks/useProjects";
import { useProjectStore } from "../stores/projectStore";
import type { Prompt, PromptCreate, PromptVersion } from "../types/api";

const SUGGESTED_TAGS = ["production", "staging", "dev", "archived"];

const TAG_STYLES: Record<string, string> = {
  production: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  staging: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  dev: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  archived: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

function tagStyle(tag: string): string {
  return (
    TAG_STYLES[tag] ?? "bg-secondary text-secondary-foreground"
  );
}

export function PromptsPage() {
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();
  const { data: project } = useProject(currentProjectId ?? undefined);
  const { data: prompts, isLoading } = usePrompts(currentProjectId ?? undefined);
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();
  const createVersion = useCreateVersion();
  const setVersionTags = useSetVersionTags();

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editedTemplate, setEditedTemplate] = useState("");
  const [editedName, setEditedName] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [diffVersion, setDiffVersion] = useState<PromptVersion | null>(null);

  const [addingTagForVersion, setAddingTagForVersion] = useState<number | null>(null);
  const [newTagInput, setNewTagInput] = useState("");

  const [productionWarning, setProductionWarning] = useState<{
    versionNumber: number;
    pendingTags: string[];
  } | null>(null);

  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptDescription, setNewPromptDescription] = useState("");

  const tagInputRef = useRef<HTMLInputElement>(null);

  const { data: versions } = usePromptVersions(
    currentProjectId ?? undefined,
    selectedPrompt?.prompt_id,
  );

  // Live query keeps production_version badge in sync after tag mutations
  const { data: livePrompt } = usePrompt(
    currentProjectId ?? undefined,
    selectedPrompt?.prompt_id,
  );
  const displayPrompt = livePrompt ?? selectedPrompt;

  if (!currentProjectId) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No project selected</h3>
        <p className="text-muted-foreground mb-4">Select a project first to manage prompts</p>
        <button onClick={() => navigate("/")} className="btn-primary">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Projects
        </button>
      </div>
    );
  }

  const handleSelectPrompt = (prompt: Prompt) => {
    if (hasChanges && !window.confirm("You have unsaved changes. Discard them?")) return;
    setSelectedPrompt(prompt);
    setEditedTemplate(prompt.template);
    setEditedName(prompt.name);
    setHasChanges(false);
    setDiffVersion(null);
    setAddingTagForVersion(null);
  };

  const handleSaveDraft = async () => {
    if (!selectedPrompt || !currentProjectId) return;
    try {
      const updated = await updatePrompt.mutateAsync({
        promptId: selectedPrompt.prompt_id,
        projectId: currentProjectId,
        data: { name: editedName, template: editedTemplate },
      });
      setSelectedPrompt(updated);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save draft:", err);
    }
  };

  const handleSaveAsVersion = async () => {
    if (!selectedPrompt || !currentProjectId) return;
    try {
      if (hasChanges) {
        const updated = await updatePrompt.mutateAsync({
          promptId: selectedPrompt.prompt_id,
          projectId: currentProjectId,
          data: { name: editedName, template: editedTemplate },
        });
        setSelectedPrompt(updated);
        setHasChanges(false);
      }
      await createVersion.mutateAsync({
        promptId: selectedPrompt.prompt_id,
        projectId: currentProjectId,
      });
    } catch (err) {
      console.error("Failed to save version:", err);
    }
  };

  const handleAddTagConfirm = (versionNumber: number, tagOverride?: string) => {
    const tag = (tagOverride ?? newTagInput).trim().toLowerCase();
    if (!tag || !selectedPrompt || !currentProjectId) return;

    const version = versions?.find((v) => v.version_number === versionNumber);
    if (!version || version.tags.includes(tag)) {
      setAddingTagForVersion(null);
      setNewTagInput("");
      return;
    }

    const pendingTags = [...version.tags, tag];

    if (tag === "production") {
      setProductionWarning({ versionNumber, pendingTags });
      setAddingTagForVersion(null);
      setNewTagInput("");
      return;
    }

    setVersionTags.mutate({
      promptId: selectedPrompt.prompt_id,
      projectId: currentProjectId,
      versionNumber,
      tags: pendingTags,
    });
    setAddingTagForVersion(null);
    setNewTagInput("");
  };

  const handleRemoveTag = (versionNumber: number, tag: string) => {
    if (!selectedPrompt || !currentProjectId) return;
    const version = versions?.find((v) => v.version_number === versionNumber);
    if (!version) return;
    setVersionTags.mutate({
      promptId: selectedPrompt.prompt_id,
      projectId: currentProjectId,
      versionNumber,
      tags: version.tags.filter((t) => t !== tag),
    });
  };

  const handleConfirmProduction = () => {
    if (!productionWarning || !selectedPrompt || !currentProjectId) return;
    setVersionTags.mutate({
      promptId: selectedPrompt.prompt_id,
      projectId: currentProjectId,
      versionNumber: productionWarning.versionNumber,
      tags: productionWarning.pendingTags,
    });
    setProductionWarning(null);
  };

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptName.trim() || !currentProjectId) return;
    const data: PromptCreate = {
      name: newPromptName,
      description: newPromptDescription,
      template: "You are a helpful assistant.\n\nUser: {{input}}\n\nAssistant:",
    };
    try {
      const created = await createPrompt.mutateAsync({ projectId: currentProjectId, data });
      setNewPromptName("");
      setNewPromptDescription("");
      setShowCreateModal(false);
      handleSelectPrompt(created);
    } catch (err) {
      console.error("Failed to create prompt:", err);
    }
  };

  const handleDeletePrompt = async (e: React.MouseEvent, prompt: Prompt) => {
    e.stopPropagation();
    if (!currentProjectId) return;
    if (window.confirm(`Delete prompt "${prompt.name}"?`)) {
      await deletePrompt.mutateAsync({ promptId: prompt.prompt_id, projectId: currentProjectId });
      if (selectedPrompt?.prompt_id === prompt.prompt_id) setSelectedPrompt(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-shrink-0">
        <button onClick={() => navigate("/")} className="hover:text-foreground">Projects</button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{project?.name || "Loading..."}</span>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── LEFT PANEL: Prompts list + Versions ── */}
        <div className="w-72 flex-shrink-0 border rounded-lg bg-card flex flex-col overflow-hidden">

          {/* Prompts section */}
          <div
            className={`flex flex-col border-b ${selectedPrompt ? "flex-shrink-0" : "flex-1 min-h-0"}`}
          >
            <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="font-medium text-sm">Prompts</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-1 hover:bg-accent rounded"
                title="New Prompt"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div
              className={`p-2 space-y-1 overflow-y-auto ${selectedPrompt ? "max-h-56" : "flex-1"}`}
            >
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : prompts && prompts.length > 0 ? (
                prompts.map((prompt) => (
                  <div
                    key={prompt.prompt_id}
                    onClick={() => handleSelectPrompt(prompt)}
                    className={`p-2 rounded cursor-pointer group flex items-center justify-between ${
                      selectedPrompt?.prompt_id === prompt.prompt_id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate text-sm">{prompt.name}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeletePrompt(e, prompt)}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity flex-shrink-0 ${
                        selectedPrompt?.prompt_id === prompt.prompt_id
                          ? "hover:bg-primary-foreground/10"
                          : "hover:bg-destructive/10"
                      }`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No prompts yet</p>
              )}
            </div>
          </div>

          {/* Versions section — only when a prompt is selected */}
          {selectedPrompt && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-medium text-sm">Versions</h2>
                  {versions && versions.length > 0 && (
                    <span className="text-xs text-muted-foreground">({versions.length})</span>
                  )}
                </div>
                <button
                  onClick={handleSaveAsVersion}
                  disabled={createVersion.isPending || updatePrompt.isPending}
                  className="btn-primary h-7 px-2.5 text-xs"
                  title="Save current draft as a new version"
                >
                  {createVersion.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      New version
                    </>
                  )}
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {!versions || versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 px-2">
                    No versions yet. Click "New version" to snapshot the current draft.
                  </p>
                ) : (
                  versions.map((v) => {
                    const isAddingTag = addingTagForVersion === v.version_number;
                    const available = SUGGESTED_TAGS.filter((s) => !v.tags.includes(s));

                    return (
                      <div
                        key={v.version_number}
                        className="rounded-md border bg-background p-2 space-y-1.5"
                      >
                        {/* Row 1: version badge + date + preview */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-muted">
                              V{v.version_number}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(v.created_at)}
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              setDiffVersion((prev) =>
                                prev?.version_number === v.version_number ? null : v,
                              )
                            }
                            className={`p-1 rounded transition-colors ${
                              diffVersion?.version_number === v.version_number
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-accent text-muted-foreground hover:text-foreground"
                            }`}
                            title={
                              diffVersion?.version_number === v.version_number
                                ? "Close comparison"
                                : "Compare with current draft"
                            }
                          >
                            <GitCompare className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Row 2: tags + add-tag button */}
                        <div className="flex flex-wrap gap-1 items-center">
                          {v.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${tagStyle(tag)}`}
                            >
                              {tag === "production" && <Crown className="h-2.5 w-2.5" />}
                              {tag}
                              <button
                                onClick={() => handleRemoveTag(v.version_number, tag)}
                                className="ml-0.5 hover:opacity-60"
                                title={`Remove tag "${tag}"`}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                          {!isAddingTag && (
                            <button
                              onClick={() => {
                                setAddingTagForVersion(v.version_number);
                                setNewTagInput("");
                                setTimeout(() => tagInputRef.current?.focus(), 50);
                              }}
                              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-accent"
                              title="Add a tag"
                            >
                              <Plus className="h-3 w-3 mr-0.5" />
                              tag
                            </button>
                          )}
                        </div>

                        {/* Inline tag input */}
                        {isAddingTag && (
                          <div className="space-y-1 pt-0.5">
                            <input
                              ref={tagInputRef}
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddTagConfirm(v.version_number);
                                if (e.key === "Escape") {
                                  setAddingTagForVersion(null);
                                  setNewTagInput("");
                                }
                              }}
                              placeholder="Tag name + Enter"
                              className="input h-6 text-xs px-2 w-full"
                            />
                            {available.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {available.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => handleAddTagConfirm(v.version_number, s)}
                                    className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-accent"
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Monaco editor ── */}
        <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col min-h-0">
          {selectedPrompt ? (
            <>
              {/* Header */}
              <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {diffVersion ? (
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="font-mono px-1.5 py-0.5 rounded bg-muted text-xs">
                        V{diffVersion.version_number}
                      </span>
                      {diffVersion.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tagStyle(tag)}`}
                        >
                          {tag}
                        </span>
                      ))}
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Current draft</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => { setEditedName(e.target.value); setHasChanges(true); }}
                        className="font-medium bg-transparent border-none outline-none focus:ring-0 p-0"
                      />
                      {displayPrompt?.production_version != null ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0">
                          <Crown className="h-3 w-3" />
                          Production: V{displayPrompt.production_version}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                          No production version
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {diffVersion ? (
                    <button
                      onClick={() => setDiffVersion(null)}
                      className="btn-secondary h-8 px-3 text-sm"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Close diff
                    </button>
                  ) : (
                    <>
                      {hasChanges && (
                        <span className="text-xs text-muted-foreground">Unsaved changes</span>
                      )}
                      <button
                        onClick={handleSaveDraft}
                        disabled={!hasChanges || updatePrompt.isPending}
                        className="btn-secondary h-8 px-3 text-sm"
                      >
                        {updatePrompt.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            Save draft
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Editor / Diff editor */}
              <div className="flex-1 min-h-0">
                {diffVersion ? (
                  <DiffEditor
                    height="100%"
                    language="handlebars"
                    original={diffVersion.template}
                    modified={editedTemplate}
                    theme="vs-light"
                    options={{
                      renderSideBySide: true,
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: "on",
                      wordWrap: "on",
                      padding: { top: 16 },
                    }}
                  />
                ) : (
                  <Editor
                    height="100%"
                    language="handlebars"
                    value={editedTemplate}
                    onChange={(value) => { setEditedTemplate(value || ""); setHasChanges(true); }}
                    theme="vs-light"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: "on",
                      wordWrap: "on",
                      padding: { top: 16 },
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a prompt to edit or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create prompt modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Create New Prompt</h2>
            <form onSubmit={handleCreatePrompt}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Prompt Name</label>
                  <input
                    type="text"
                    value={newPromptName}
                    onChange={(e) => setNewPromptName(e.target.value)}
                    placeholder="Customer Support Bot"
                    className="input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <textarea
                    value={newPromptDescription}
                    onChange={(e) => setNewPromptDescription(e.target.value)}
                    placeholder="Optional description..."
                    className="input min-h-[80px] resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={!newPromptName.trim() || createPrompt.isPending} className="btn-primary">
                  {createPrompt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Prompt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Production warning modal ── */}
      {productionWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Set V{productionWarning.versionNumber} as Production?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This version will be used by all live flows that reference this prompt.
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-5 text-sm text-amber-800">
              Please ensure you have <strong>evaluated this prompt</strong> before promoting it to
              production. Unverified changes can affect live users.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setProductionWarning(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleConfirmProduction} className="btn-primary bg-amber-600 hover:bg-amber-700">
                <Crown className="h-4 w-4 mr-1.5" />
                Set as Production
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
