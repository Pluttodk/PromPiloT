import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasetsApi, evalRunsApi, scoresApi } from "../api/evaluation";
import type {
  DatasetCreate,
  DatasetItemCreate,
  DatasetItemFromTrace,
  EvalRunCreate,
  LLMJudgeRequest,
  ScoreCreate,
  DatasetCsvUploadResponse,
} from "../types/api";

// ── Score keys & hooks ───────────────────────────────────────────────

export const scoreKeys = {
  all: (projectId: string, traceId: string) => ["scores", projectId, traceId] as const,
};

export function useScores(projectId: string | undefined, traceId: string | undefined) {
  return useQuery({
    queryKey: scoreKeys.all(projectId!, traceId!),
    queryFn: () => scoresApi.list(projectId!, traceId!),
    enabled: !!projectId && !!traceId,
  });
}

export function useCreateScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, projectId }: { body: ScoreCreate; projectId: string }) =>
      scoresApi.create(body, projectId),
    onSuccess: (_result, { body, projectId }) => {
      queryClient.invalidateQueries({ queryKey: scoreKeys.all(projectId, body.trace_id) });
    },
  });
}

export function useDeleteScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scoreId,
      projectId,
    }: {
      scoreId: string;
      projectId: string;
      traceId: string;
    }) => scoresApi.delete(scoreId, projectId),
    onSuccess: (_, { projectId, traceId }) => {
      queryClient.invalidateQueries({ queryKey: scoreKeys.all(projectId, traceId) });
    },
  });
}

export function useRunLLMJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, projectId }: { body: LLMJudgeRequest; projectId: string }) =>
      scoresApi.runLLMJudge(body, projectId),
    onSuccess: (_result, { body, projectId }) => {
      queryClient.invalidateQueries({ queryKey: scoreKeys.all(projectId, body.trace_id) });
    },
  });
}

// ── Dataset keys & hooks ─────────────────────────────────────────────

export const datasetKeys = {
  all: (projectId: string) => ["datasets", projectId] as const,
  detail: (projectId: string, datasetId: string) =>
    ["datasets", projectId, datasetId] as const,
  items: (projectId: string, datasetId: string) =>
    ["datasets", projectId, datasetId, "items"] as const,
};

export function useDatasets(projectId: string | undefined) {
  return useQuery({
    queryKey: datasetKeys.all(projectId!),
    queryFn: () => datasetsApi.list(projectId!),
    enabled: !!projectId,
  });
}

export function useDataset(projectId: string | undefined, datasetId: string | undefined) {
  return useQuery({
    queryKey: datasetKeys.detail(projectId!, datasetId!),
    queryFn: () => datasetsApi.get(datasetId!, projectId!),
    enabled: !!projectId && !!datasetId,
  });
}

export function useDatasetItems(
  projectId: string | undefined,
  datasetId: string | undefined,
  limit = 100,
  skip = 0,
) {
  return useQuery({
    queryKey: [...datasetKeys.items(projectId!, datasetId!), limit, skip],
    queryFn: () => datasetsApi.listItems(datasetId!, projectId!, limit, skip),
    enabled: !!projectId && !!datasetId,
  });
}

export function useCreateDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, projectId }: { body: DatasetCreate; projectId: string }) =>
      datasetsApi.create(body, projectId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: datasetKeys.all(projectId) });
    },
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, projectId }: { datasetId: string; projectId: string }) =>
      datasetsApi.delete(datasetId, projectId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: datasetKeys.all(projectId) });
    },
  });
}

export function useAddDatasetItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      datasetId,
      body,
      projectId,
    }: {
      datasetId: string;
      body: DatasetItemCreate;
      projectId: string;
    }) => datasetsApi.addItem(datasetId, body, projectId),
    onSuccess: (_, { projectId, datasetId }) => {
      queryClient.invalidateQueries({ queryKey: datasetKeys.items(projectId, datasetId) });
      queryClient.invalidateQueries({ queryKey: datasetKeys.detail(projectId, datasetId) });
    },
  });
}

export function useAddDatasetItemFromTrace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      datasetId,
      body,
      projectId,
    }: {
      datasetId: string;
      body: DatasetItemFromTrace;
      projectId: string;
    }) => datasetsApi.addItemFromTrace(datasetId, body, projectId),
    onSuccess: (_, { projectId, datasetId }) => {
      queryClient.invalidateQueries({ queryKey: datasetKeys.items(projectId, datasetId) });
      queryClient.invalidateQueries({ queryKey: datasetKeys.detail(projectId, datasetId) });
    },
  });
}

export function useDeleteDatasetItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      datasetId,
      itemId,
      projectId,
    }: {
      datasetId: string;
      itemId: string;
      projectId: string;
    }) => datasetsApi.deleteItem(datasetId, itemId, projectId),
    onSuccess: (_, { projectId, datasetId }) => {
      queryClient.invalidateQueries({ queryKey: datasetKeys.items(projectId, datasetId) });
      queryClient.invalidateQueries({ queryKey: datasetKeys.detail(projectId, datasetId) });
    },
  });
}

export function useUploadDatasetCsv() {
  const queryClient = useQueryClient();
  return useMutation<
    DatasetCsvUploadResponse,
    Error,
    { datasetId: string; file: File; projectId: string }
  >({
    mutationFn: ({ datasetId, file, projectId }) =>
      datasetsApi.uploadCsv(datasetId, file, projectId),
    onSuccess: (_result, { projectId, datasetId }) => {
      queryClient.invalidateQueries({ queryKey: datasetKeys.items(projectId, datasetId) });
      queryClient.invalidateQueries({ queryKey: datasetKeys.detail(projectId, datasetId) });
    },
  });
}

// ── Eval run keys & hooks ────────────────────────────────────────────

export const evalRunKeys = {
  all: (projectId: string) => ["evalruns", projectId] as const,
  filtered: (projectId: string, datasetId?: string) =>
    ["evalruns", projectId, datasetId ?? null] as const,
  detail: (projectId: string, runId: string) =>
    ["evalruns", projectId, runId] as const,
  results: (projectId: string, runId: string) =>
    ["evalruns", projectId, runId, "results"] as const,
};

export function useEvalRuns(projectId: string | undefined, datasetId?: string) {
  return useQuery({
    queryKey: evalRunKeys.filtered(projectId!, datasetId),
    queryFn: () => evalRunsApi.list(projectId!, datasetId),
    enabled: !!projectId,
  });
}

export function useEvalRun(projectId: string | undefined, runId: string | undefined) {
  return useQuery({
    queryKey: evalRunKeys.detail(projectId!, runId!),
    queryFn: () => evalRunsApi.get(runId!, projectId!),
    enabled: !!projectId && !!runId,
  });
}

export function useEvalRunPolling(projectId: string | undefined, runId: string | undefined) {
  return useQuery({
    queryKey: evalRunKeys.detail(projectId!, runId!),
    queryFn: () => evalRunsApi.get(runId!, projectId!),
    enabled: !!projectId && !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 3000 : false;
    },
  });
}

export function useEvalResults(projectId: string | undefined, runId: string | undefined) {
  return useQuery({
    queryKey: evalRunKeys.results(projectId!, runId!),
    queryFn: () => evalRunsApi.listResults(runId!, projectId!),
    enabled: !!projectId && !!runId,
  });
}

export function useEvalResultsPolling(
  projectId: string | undefined,
  runId: string | undefined,
  isRunning: boolean,
) {
  return useQuery({
    queryKey: evalRunKeys.results(projectId!, runId!),
    queryFn: () => evalRunsApi.listResults(runId!, projectId!),
    enabled: !!projectId && !!runId,
    refetchInterval: isRunning ? 3000 : false,
  });
}

export function useCreateEvalRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, projectId }: { body: EvalRunCreate; projectId: string }) =>
      evalRunsApi.create(body, projectId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: evalRunKeys.all(projectId) });
    },
  });
}
