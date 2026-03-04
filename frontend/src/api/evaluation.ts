import { apiClient } from "./client";
import type {
  DatasetCreate,
  DatasetCsvUploadResponse,
  DatasetItemCreate,
  DatasetItemFromTrace,
  DatasetItemResponse,
  DatasetResponse,
  EvalResultResponse,
  EvalRunCreate,
  EvalRunResponse,
  LLMJudgeRequest,
  LLMJudgeResponse,
  Message,
  ScoreCreate,
  ScoreResponse,
} from "../types/api";

export const scoresApi = {
  create: async (body: ScoreCreate, projectId: string): Promise<ScoreResponse> => {
    const response = await apiClient.post<ScoreResponse>("/scores/", body, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  list: async (projectId: string, traceId: string): Promise<ScoreResponse[]> => {
    const response = await apiClient.get<ScoreResponse[]>("/scores/", {
      params: { project_id: projectId, trace_id: traceId },
    });
    return response.data;
  },

  delete: async (scoreId: string, projectId: string): Promise<Message> => {
    const response = await apiClient.delete<Message>(`/scores/${scoreId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  runLLMJudge: async (body: LLMJudgeRequest, projectId: string): Promise<LLMJudgeResponse> => {
    const response = await apiClient.post<LLMJudgeResponse>("/scores/llm-judge", body, {
      params: { project_id: projectId },
    });
    return response.data;
  },
};

export const datasetsApi = {
  list: async (projectId: string): Promise<DatasetResponse[]> => {
    const response = await apiClient.get<DatasetResponse[]>("/datasets/", {
      params: { project_id: projectId },
    });
    return response.data;
  },

  create: async (body: DatasetCreate, projectId: string): Promise<DatasetResponse> => {
    const response = await apiClient.post<DatasetResponse>("/datasets/", body, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  get: async (datasetId: string, projectId: string): Promise<DatasetResponse> => {
    const response = await apiClient.get<DatasetResponse>(`/datasets/${datasetId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  delete: async (datasetId: string, projectId: string): Promise<Message> => {
    const response = await apiClient.delete<Message>(`/datasets/${datasetId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  listItems: async (
    datasetId: string,
    projectId: string,
    limit = 100,
    skip = 0,
  ): Promise<DatasetItemResponse[]> => {
    const response = await apiClient.get<DatasetItemResponse[]>(`/datasets/${datasetId}/items`, {
      params: { project_id: projectId, limit, skip },
    });
    return response.data;
  },

  addItem: async (
    datasetId: string,
    body: DatasetItemCreate,
    projectId: string,
  ): Promise<DatasetItemResponse> => {
    const response = await apiClient.post<DatasetItemResponse>(
      `/datasets/${datasetId}/items`,
      body,
      { params: { project_id: projectId } },
    );
    return response.data;
  },

  addItemFromTrace: async (
    datasetId: string,
    body: DatasetItemFromTrace,
    projectId: string,
  ): Promise<DatasetItemResponse> => {
    const response = await apiClient.post<DatasetItemResponse>(
      `/datasets/${datasetId}/items/from-trace`,
      body,
      { params: { project_id: projectId } },
    );
    return response.data;
  },

  deleteItem: async (
    datasetId: string,
    itemId: string,
    projectId: string,
  ): Promise<Message> => {
    const response = await apiClient.delete<Message>(
      `/datasets/${datasetId}/items/${itemId}`,
      { params: { project_id: projectId } },
    );
    return response.data;
  },

  uploadCsv: async (
    datasetId: string,
    file: File,
    projectId: string,
  ): Promise<DatasetCsvUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<DatasetCsvUploadResponse>(
      `/datasets/${datasetId}/items/upload-csv`,
      formData,
      {
        params: { project_id: projectId },
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  },
};

export const evalRunsApi = {
  create: async (body: EvalRunCreate, projectId: string): Promise<EvalRunResponse> => {
    const response = await apiClient.post<EvalRunResponse>("/evaluations/", body, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  list: async (projectId: string, datasetId?: string): Promise<EvalRunResponse[]> => {
    const params: Record<string, string> = { project_id: projectId };
    if (datasetId) params.dataset_id = datasetId;
    const response = await apiClient.get<EvalRunResponse[]>("/evaluations/", { params });
    return response.data;
  },

  get: async (runId: string, projectId: string): Promise<EvalRunResponse> => {
    const response = await apiClient.get<EvalRunResponse>(`/evaluations/${runId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  listResults: async (runId: string, projectId: string): Promise<EvalResultResponse[]> => {
    const response = await apiClient.get<EvalResultResponse[]>(
      `/evaluations/${runId}/results`,
      { params: { project_id: projectId } },
    );
    return response.data;
  },
};
