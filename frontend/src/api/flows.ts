import { apiClient } from "./client";
import type {
  Flow,
  FlowCreate,
  FlowUpdate,
  FlowExecuteRequest,
  FlowExecuteResponse,
  Message,
} from "../types/api";

export const flowsApi = {
  list: async (projectId: string): Promise<Flow[]> => {
    const response = await apiClient.get<Flow[]>("/flows", {
      params: { project_id: projectId },
    });
    return response.data;
  },

  get: async (flowId: string, projectId: string): Promise<Flow> => {
    const response = await apiClient.get<Flow>(`/flows/${flowId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  create: async (projectId: string, data: FlowCreate): Promise<Flow> => {
    const response = await apiClient.post<Flow>("/flows", data, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  update: async (flowId: string, projectId: string, data: FlowUpdate): Promise<Flow> => {
    const response = await apiClient.put<Flow>(`/flows/${flowId}`, data, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  delete: async (flowId: string, projectId: string): Promise<Message> => {
    const response = await apiClient.delete<Message>(`/flows/${flowId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  execute: async (
    flowId: string,
    projectId: string,
    data: FlowExecuteRequest
  ): Promise<FlowExecuteResponse> => {
    const response = await apiClient.post<FlowExecuteResponse>(
      `/flows/${flowId}/execute`,
      data,
      { params: { project_id: projectId } }
    );
    return response.data;
  },
};
