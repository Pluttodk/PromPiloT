import { apiClient } from "./client";
import type { Prompt, PromptCreate, PromptUpdate, PromptVersion, Message } from "../types/api";

export const promptsApi = {
  list: async (projectId: string): Promise<Prompt[]> => {
    const response = await apiClient.get<Prompt[]>("/prompts", {
      params: { project_id: projectId },
    });
    return response.data;
  },

  get: async (promptId: string, projectId: string): Promise<Prompt> => {
    const response = await apiClient.get<Prompt>(`/prompts/${promptId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  create: async (projectId: string, data: PromptCreate): Promise<Prompt> => {
    const response = await apiClient.post<Prompt>("/prompts", data, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  update: async (promptId: string, projectId: string, data: PromptUpdate): Promise<Prompt> => {
    const response = await apiClient.put<Prompt>(`/prompts/${promptId}`, data, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  delete: async (promptId: string, projectId: string): Promise<Message> => {
    const response = await apiClient.delete<Message>(`/prompts/${promptId}`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  listVersions: async (promptId: string, projectId: string): Promise<PromptVersion[]> => {
    const response = await apiClient.get<PromptVersion[]>(`/prompts/${promptId}/versions`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  createVersion: async (promptId: string, projectId: string): Promise<PromptVersion> => {
    const response = await apiClient.post<PromptVersion>(
      `/prompts/${promptId}/versions`,
      {},
      { params: { project_id: projectId } },
    );
    return response.data;
  },

  setVersionTags: async (
    promptId: string,
    projectId: string,
    versionNumber: number,
    tags: string[],
  ): Promise<Prompt> => {
    const response = await apiClient.put<Prompt>(
      `/prompts/${promptId}/versions/${versionNumber}/tags`,
      { tags },
      { params: { project_id: projectId } },
    );
    return response.data;
  },
};
