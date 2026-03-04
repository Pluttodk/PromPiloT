import { apiClient } from "./client";
import type { TraceResponse, TraceListResponse, Message } from "../types/api";

export const tracesApi = {
  list: async (
    projectId: string,
    flowId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<TraceListResponse[]> => {
    const params: Record<string, string> = { project_id: projectId };
    if (flowId) {
      params.flow_id = flowId;
    }
    if (dateFrom) {
      params.date_from = dateFrom.toISOString();
    }
    if (dateTo) {
      params.date_to = dateTo.toISOString();
    }
    const response = await apiClient.get<TraceListResponse[]>("/traces", { params });
    return response.data;
  },

  get: async (traceId: string, projectId: string): Promise<TraceResponse> => {
    const response = await apiClient.get<TraceResponse>(`/traces/${traceId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  delete: async (traceId: string, projectId: string): Promise<Message> => {
    const response = await apiClient.delete<Message>(`/traces/${traceId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },
};
