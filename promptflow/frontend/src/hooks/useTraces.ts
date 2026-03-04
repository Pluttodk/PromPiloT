import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tracesApi } from "../api/traces";

export const traceKeys = {
  all: (projectId: string) => ["traces", projectId] as const,
  filtered: (projectId: string, flowId?: string, dateFrom?: Date, dateTo?: Date) =>
    ["traces", projectId, flowId ?? null, dateFrom?.toISOString() ?? null, dateTo?.toISOString() ?? null] as const,
  detail: (projectId: string, traceId: string) => ["traces", projectId, "detail", traceId] as const,
};

export function useTraces(
  projectId: string | undefined,
  flowId?: string,
  dateFrom?: Date,
  dateTo?: Date,
) {
  return useQuery({
    queryKey: traceKeys.filtered(projectId!, flowId, dateFrom, dateTo),
    queryFn: () => tracesApi.list(projectId!, flowId, dateFrom, dateTo),
    enabled: !!projectId,
  });
}

export function useTrace(projectId: string | undefined, traceId: string | undefined) {
  return useQuery({
    queryKey: traceKeys.detail(projectId!, traceId!),
    queryFn: () => tracesApi.get(traceId!, projectId!),
    enabled: !!projectId && !!traceId,
  });
}

export function useDeleteTrace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ traceId, projectId }: { traceId: string; projectId: string }) =>
      tracesApi.delete(traceId, projectId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: traceKeys.all(projectId) });
    },
  });
}
