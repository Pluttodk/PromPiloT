import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { flowsApi } from "../api/flows";
import type { FlowCreate, FlowUpdate, FlowExecuteRequest } from "../types/api";

export const flowKeys = {
  all: (projectId: string) => ["flows", projectId] as const,
  detail: (projectId: string, flowId: string) => ["flows", projectId, flowId] as const,
};

export function useFlows(projectId: string | undefined) {
  return useQuery({
    queryKey: flowKeys.all(projectId!),
    queryFn: () => flowsApi.list(projectId!),
    enabled: !!projectId,
  });
}

export function useFlow(projectId: string | undefined, flowId: string | undefined) {
  return useQuery({
    queryKey: flowKeys.detail(projectId!, flowId!),
    queryFn: () => flowsApi.get(flowId!, projectId!),
    enabled: !!projectId && !!flowId,
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: FlowCreate }) =>
      flowsApi.create(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.all(projectId) });
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      flowId,
      projectId,
      data,
    }: {
      flowId: string;
      projectId: string;
      data: FlowUpdate;
    }) => flowsApi.update(flowId, projectId, data),
    onSuccess: (_, { projectId, flowId }) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: flowKeys.detail(projectId, flowId) });
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ flowId, projectId }: { flowId: string; projectId: string }) =>
      flowsApi.delete(flowId, projectId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.all(projectId) });
    },
  });
}

export function useExecuteFlow() {
  return useMutation({
    mutationFn: ({
      flowId,
      projectId,
      data,
    }: {
      flowId: string;
      projectId: string;
      data: FlowExecuteRequest;
    }) => flowsApi.execute(flowId, projectId, data),
  });
}
