import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Database,
  Loader2,
  Plus,
  Trash2,
  X,
  FlaskConical,
  FileText,
  Upload,
} from "lucide-react";
import {
  useDataset,
  useDatasetItems,
  useAddDatasetItem,
  useDeleteDatasetItem,
  useUploadDatasetCsv,
} from "../hooks/useEvaluation";
import { useProjectStore } from "../stores/projectStore";
import { EvalRunCreateModal } from "../components/evaluation/EvalRunCreateModal";

function AddItemForm({
  datasetId,
  projectId,
  onClose,
}: {
  datasetId: string;
  projectId: string;
  onClose: () => void;
}) {
  const [inputText, setInputText] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [notes, setNotes] = useState("");
  const addItem = useAddDatasetItem();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addItem.mutateAsync({
      datasetId,
      body: {
        input: inputText,
        expected_output: expectedOutput || undefined,
        notes: notes || undefined,
      },
      projectId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Add Test Item</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Input
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter the input text for the flow..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Expected Output <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={expectedOutput}
              onChange={(e) => setExpectedOutput(e.target.value)}
              rows={2}
              placeholder="The expected answer or output..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this test case"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              disabled={addItem.isPending || !inputText.trim()}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {addItem.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PAGE_SIZE = 100;

export function DatasetDetailPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const { currentProjectId } = useProjectStore();
  const [page, setPage] = useState(0);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [csvResult, setCsvResult] = useState<{ created: number; skipped: number; truncated: number } | null>(null);
  const { data: dataset, isLoading: datasetLoading } = useDataset(
    currentProjectId ?? undefined,
    datasetId,
  );
  const { data: items = [], isLoading: itemsLoading } = useDatasetItems(
    currentProjectId ?? undefined,
    datasetId,
    PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const deleteItem = useDeleteDatasetItem();
  const uploadCsv = useUploadDatasetCsv();
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProjectId || !datasetId) return;
    setCsvResult(null);
    const result = await uploadCsv.mutateAsync({ datasetId, file, projectId: currentProjectId });
    setCsvResult(result);
    setPage(0);
    e.target.value = "";
  };

  if (!currentProjectId) {
    return <div className="text-center py-12 text-slate-500">No project selected.</div>;
  }

  if (datasetLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!dataset) {
    return <div className="text-center py-12 text-slate-500">Dataset not found.</div>;
  }

  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm("Remove this test item?")) {
      await deleteItem.mutateAsync({ datasetId: dataset.dataset_id, itemId, projectId: currentProjectId });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <button onClick={() => navigate("/datasets")} className="hover:text-slate-700">
          Datasets
        </button>
        <span>/</span>
        <span className="text-slate-900 font-medium">{dataset.name}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/datasets")}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50">
              <Database className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{dataset.name}</h1>
              {dataset.description && (
                <p className="text-sm text-slate-500">{dataset.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvUpload}
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={uploadCsv.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Upload CSV with 'input' and optional 'expected_output' columns"
          >
            {uploadCsv.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload CSV
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
          <button
            onClick={() => setShowCreateRun(true)}
            disabled={items.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors"
          >
            <FlaskConical className="h-4 w-4" />
            Start Eval Run
          </button>
        </div>
      </div>

      {uploadCsv.isError && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
          Upload failed: {(uploadCsv.error as Error)?.message ?? "Unknown error"}
        </div>
      )}
      {csvResult && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-700 flex items-center justify-between">
          <span>
            Imported <strong>{csvResult.created.toLocaleString()}</strong> items
            {csvResult.skipped > 0 && `, ${csvResult.skipped} skipped (empty input)`}
            {csvResult.truncated > 0 && `, ${csvResult.truncated} truncated to 32K chars`}
          </span>
          <button onClick={() => setCsvResult(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-700">
            Test Items
            <span className="ml-2 text-xs font-normal text-slate-400">
              {dataset.item_count.toLocaleString()} item{dataset.item_count !== 1 ? "s" : ""}
            </span>
          </h3>
        </div>

        {itemsLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading items...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 mb-3">No test items yet</p>
            <p className="text-xs text-slate-400">
              Add items manually or import from traces
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div key={item.item_id} className="flex items-start gap-4 p-4 hover:bg-slate-50 group">
                <span className="flex-shrink-0 text-xs text-slate-400 font-mono pt-1">
                  #{page * PAGE_SIZE + idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 line-clamp-2">
                    {item.input}
                  </div>
                  {item.expected_output && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      <span className="font-medium text-slate-600">Expected:</span>{" "}
                      {item.expected_output}
                    </p>
                  )}
                  {item.source_trace_id && (
                    <p className="text-xs text-slate-400 mt-1">
                      From trace:{" "}
                      <button
                        onClick={() => navigate(`/traces/${item.source_trace_id}`)}
                        className="text-blue-500 hover:underline"
                      >
                        {item.source_trace_id.slice(0, 8)}…
                      </button>
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-slate-400 mt-1 italic">{item.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteItem(item.item_id)}
                  className="p-1.5 rounded text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {dataset.item_count > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, dataset.item_count)} of {dataset.item_count.toLocaleString()} items
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= dataset.item_count}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddItem && (
        <AddItemForm
          datasetId={dataset.dataset_id}
          projectId={currentProjectId}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {showCreateRun && (
        <EvalRunCreateModal
          projectId={currentProjectId}
          datasetId={dataset.dataset_id}
          datasetName={dataset.name}
          onClose={() => setShowCreateRun(false)}
        />
      )}
    </div>
  );
}
