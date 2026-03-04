import { apiClient } from "./client";
import type { ModelConfigResponse, ModelConfigCreate, ModelConfigUpdate, ModelTestRequest, ModelTestResponse, Message } from "../types/api";

export const modelsApi = {
  list: async (projectId: string): Promise<ModelConfigResponse[]> => {
    const response = await apiClient.get<ModelConfigResponse[]>("/models", {
      params: { project_id: projectId },
    });
    return response.data;
  },

  get: async (modelConfigId: string, projectId: string): Promise<ModelConfigResponse> => {
    const response = await apiClient.get<ModelConfigResponse>(`/models/${modelConfigId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  create: async (projectId: string, data: ModelConfigCreate): Promise<ModelConfigResponse> => {
    const response = await apiClient.post<ModelConfigResponse>("/models", data, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  update: async (modelConfigId: string, projectId: string, data: ModelConfigUpdate): Promise<ModelConfigResponse> => {
    const response = await apiClient.put<ModelConfigResponse>(`/models/${modelConfigId}`, data, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  delete: async (modelConfigId: string, projectId: string): Promise<Message> => {
    const response = await apiClient.delete<Message>(`/models/${modelConfigId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  test: async (modelConfigId: string, projectId: string, data: ModelTestRequest): Promise<ModelTestResponse> => {
    const response = await apiClient.post<ModelTestResponse>(`/models/${modelConfigId}/test`, data, {
      params: { project_id: projectId },
    });
    return response.data;
  },
};
