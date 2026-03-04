import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database,
  Plus,
  Trash2,
  Loader2,
  X,
  ChevronRight,
  FileText,
} from "lucide-react";
import { useDatasets, useCreateDataset, useDeleteDataset } from "../hooks/useEvaluation";
import { useProjectStore } from "../stores/projectStore";
import type { DatasetCreate } from "../types/api";

function CreateDatasetModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createDataset = useCreateDataset();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: DatasetCreate = { name, description };
    await createDataset.mutateAsync({ body, projectId });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">New Dataset</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. QA Test Suite"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createDataset.isPending}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {createDataset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Dataset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DatasetsPage() {
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();
  const { data: datasets = [], isLoading } = useDatasets(currentProjectId ?? undefined);
  const deleteDataset = useDeleteDataset();
  const [showCreate, setShowCreate] = useState(false);

  if (!currentProjectId) {
    return (
      <div className="text-center py-12">
        <Database className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No project selected</h3>
        <p className="text-slate-500 mb-4">Select a project first to manage datasets</p>
      </div>
    );
  }

  const handleDelete = async (e: React.MouseEvent, datasetId: string, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Delete dataset "${name}" and all its items?`)) {
      await deleteDataset.mutateAsync({ datasetId, projectId: currentProjectId });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Datasets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage test datasets for batch evaluation runs
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Dataset
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading datasets...
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Database className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-base font-medium text-slate-900 mb-2">No datasets yet</h3>
          <p className="text-sm text-slate-500 mb-4">
            Create a dataset and populate it with test cases from traces
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="h-4 w-4" />
            Create First Dataset
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {datasets.map((dataset) => (
            <div
              key={dataset.dataset_id}
              onClick={() => navigate(`/datasets/${dataset.dataset_id}`)}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0">
                <Database className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{dataset.name}</h3>
                </div>
                {dataset.description && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{dataset.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500">{dataset.item_count} items</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => handleDelete(e, dataset.dataset_id, dataset.name)}
                  className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDatasetModal
          projectId={currentProjectId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
