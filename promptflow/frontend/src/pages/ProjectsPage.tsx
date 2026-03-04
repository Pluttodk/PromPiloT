import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderKanban, Trash2, Loader2 } from "lucide-react";
import { useProjects, useCreateProject, useDeleteProject } from "../hooks/useProjects";
import { useProjectStore } from "../stores/projectStore";
import type { Project } from "../types/api";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const { setCurrentProject } = useProjectStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await createProject.mutateAsync({
        name: newProjectName,
        description: newProjectDescription,
      });
      setNewProjectName("");
      setNewProjectDescription("");
      setShowCreateModal(false);
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project.project_id);
    navigate("/prompts");
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this project?")) {
      await deleteProject.mutateAsync(projectId);
    }
  };

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
        <p className="text-destructive">Failed to load projects. Is the backend running?</p>
        <p className="text-sm text-muted-foreground mt-2">
          Make sure Azurite and the backend are running on localhost:8000
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your LLMOps projects</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </button>
      </div>

      {projects && projects.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first project to get started
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <div
              key={project.project_id}
              onClick={() => handleSelectProject(project)}
              className="card p-4 cursor-pointer hover:border-primary transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <FolderKanban className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{project.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description || "No description"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteProject(e, project.project_id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
              <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                Created {new Date(project.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="My Project"
                    className="input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
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
                  disabled={!newProjectName.trim() || createProject.isPending}
                  className="btn-primary"
                >
                  {createProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
