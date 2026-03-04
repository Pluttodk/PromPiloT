import { apiClient } from "./client";
import type { Project, ProjectCreate, ProjectUpdate, Message } from "../types/api";

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const response = await apiClient.get<Project[]>("/projects");
    return response.data;
  },

  get: async (projectId: string): Promise<Project> => {
    const response = await apiClient.get<Project>(`/projects/${projectId}`);
    return response.data;
  },

  create: async (data: ProjectCreate): Promise<Project> => {
    const response = await apiClient.post<Project>("/projects", data);
    return response.data;
  },

  update: async (projectId: string, data: ProjectUpdate): Promise<Project> => {
    const response = await apiClient.put<Project>(`/projects/${projectId}`, data);
    return response.data;
  },

  delete: async (projectId: string): Promise<Message> => {
    const response = await apiClient.delete<Message>(`/projects/${projectId}`);
    return response.data;
  },
};
