import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { modelsApi } from "../api/models";
import type { ModelConfigCreate, ModelConfigUpdate, ModelTestRequest } from "../types/api";

export const modelKeys = {
  all: (projectId: string) => ["models", projectId] as const,
  detail: (projectId: string, modelConfigId: string) => ["models", projectId, modelConfigId] as const,
};

export function useModels(projectId: string | undefined) {
  return useQuery({
    queryKey: modelKeys.all(projectId!),
    queryFn: () => modelsApi.list(projectId!),
    enabled: !!projectId,
  });
}

export function useModel(projectId: string | undefined, modelConfigId: string | undefined) {
  return useQuery({
    queryKey: modelKeys.detail(projectId!, modelConfigId!),
    queryFn: () => modelsApi.get(modelConfigId!, projectId!),
    enabled: !!projectId && !!modelConfigId,
  });
}

export function useCreateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: ModelConfigCreate }) =>
      modelsApi.create(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: modelKeys.all(projectId) });
    },
  });
}

export function useUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      modelConfigId,
      projectId,
      data,
    }: {
      modelConfigId: string;
      projectId: string;
      data: ModelConfigUpdate;
    }) => modelsApi.update(modelConfigId, projectId, data),
    onSuccess: (_, { projectId, modelConfigId }) => {
      queryClient.invalidateQueries({ queryKey: modelKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: modelKeys.detail(projectId, modelConfigId) });
    },
  });
}

export function useDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ modelConfigId, projectId }: { modelConfigId: string; projectId: string }) =>
      modelsApi.delete(modelConfigId, projectId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: modelKeys.all(projectId) });
    },
  });
}

export function useTestModel() {
  return useMutation({
    mutationFn: ({
      modelConfigId,
      projectId,
      data,
    }: {
      modelConfigId: string;
      projectId: string;
      data: ModelTestRequest;
    }) => modelsApi.test(modelConfigId, projectId, data),
  });
}
