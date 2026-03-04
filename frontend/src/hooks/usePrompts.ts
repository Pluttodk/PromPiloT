import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { promptsApi } from "../api/prompts";
import type { PromptCreate, PromptUpdate } from "../types/api";

export const promptKeys = {
  all: (projectId: string) => ["prompts", projectId] as const,
  detail: (projectId: string, promptId: string) => ["prompts", projectId, promptId] as const,
  versions: (projectId: string, promptId: string) =>
    ["prompts", projectId, promptId, "versions"] as const,
};

export function usePrompts(projectId: string | undefined) {
  return useQuery({
    queryKey: promptKeys.all(projectId!),
    queryFn: () => promptsApi.list(projectId!),
    enabled: !!projectId,
  });
}

export function usePrompt(projectId: string | undefined, promptId: string | undefined) {
  return useQuery({
    queryKey: promptKeys.detail(projectId!, promptId!),
    queryFn: () => promptsApi.get(promptId!, projectId!),
    enabled: !!projectId && !!promptId,
  });
}

export function useCreatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: PromptCreate }) =>
      promptsApi.create(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: promptKeys.all(projectId) });
    },
  });
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      promptId,
      projectId,
      data,
    }: {
      promptId: string;
      projectId: string;
      data: PromptUpdate;
    }) => promptsApi.update(promptId, projectId, data),
    onSuccess: (_, { projectId, promptId }) => {
      queryClient.invalidateQueries({ queryKey: promptKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: promptKeys.detail(projectId, promptId) });
    },
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ promptId, projectId }: { promptId: string; projectId: string }) =>
      promptsApi.delete(promptId, projectId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: promptKeys.all(projectId) });
    },
  });
}

export function usePromptVersions(
  projectId: string | undefined,
  promptId: string | undefined,
) {
  return useQuery({
    queryKey: promptKeys.versions(projectId!, promptId!),
    queryFn: () => promptsApi.listVersions(promptId!, projectId!),
    enabled: !!projectId && !!promptId,
  });
}

export function useCreateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ promptId, projectId }: { promptId: string; projectId: string }) =>
      promptsApi.createVersion(promptId, projectId),
    onSuccess: (_, { projectId, promptId }) => {
      queryClient.invalidateQueries({ queryKey: promptKeys.versions(projectId, promptId) });
      queryClient.invalidateQueries({ queryKey: promptKeys.detail(projectId, promptId) });
    },
  });
}

export function useSetVersionTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      promptId,
      projectId,
      versionNumber,
      tags,
    }: {
      promptId: string;
      projectId: string;
      versionNumber: number;
      tags: string[];
    }) => promptsApi.setVersionTags(promptId, projectId, versionNumber, tags),
    onSuccess: (updatedPrompt, { projectId, promptId }) => {
      queryClient.invalidateQueries({ queryKey: promptKeys.versions(projectId, promptId) });
      queryClient.setQueryData(promptKeys.detail(projectId, promptId), updatedPrompt);
      queryClient.invalidateQueries({ queryKey: promptKeys.all(projectId) });
    },
  });
}
