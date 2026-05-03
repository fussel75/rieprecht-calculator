import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertCostVariable } from "@shared/schema";

export function useCostVariables() {
  return useQuery({
    queryKey: [api.costVariables.list.path],
    queryFn: async () => {
      const res = await fetch(api.costVariables.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cost variables");
      return api.costVariables.list.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateCostVariable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertCostVariable>) => {
      const url = buildUrl(api.costVariables.update.path, { id });
      const res = await fetch(url, {
        method: api.costVariables.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update cost variable");
      return api.costVariables.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.costVariables.list.path] }),
  });
}

export function useCreateCostVariable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertCostVariable) => {
      const res = await fetch(api.costVariables.create.path, {
        method: api.costVariables.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create cost variable");
      return api.costVariables.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.costVariables.list.path] }),
  });
}

export function useDeleteCostVariable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.costVariables.delete.path, { id });
      const res = await fetch(url, {
        method: api.costVariables.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete cost variable");
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.costVariables.list.path] }),
  });
}
