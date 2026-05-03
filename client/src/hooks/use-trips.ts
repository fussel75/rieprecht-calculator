import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Trip, InsertTrip } from "@shared/schema";

export function useTrips() {
  return useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });
}

export function useCreateTrip() {
  return useMutation({
    mutationFn: async (data: InsertTrip) => {
      const res = await apiRequest("POST", "/api/trips", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
  });
}

export function useUpdateTrip() {
  return useMutation({
    mutationFn: async (data: { id: number } & Partial<InsertTrip>) => {
      const { id, ...rest } = data;
      const res = await apiRequest("PUT", `/api/trips/${id}`, rest);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
  });
}

export function useDeleteTrip() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/trips/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
  });
}
