import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Task, TaskComment } from "@shared/schema";

export type TaskListItem = Task & {
  assigneeIds: number[];
  attachments: Array<{ id: number; filename: string; mimeType: string; size: number; uploadedById: number; uploadedAt: string | null }>;
  commentCount: number;
};

export interface TaskFilters {
  scope?: "mine" | "created" | "all";
  status?: "offen" | "in_bearbeitung" | "erledigt";
  priority?: "niedrig" | "mittel" | "hoch" | "dringend";
  search?: string;
}

function buildQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useTasks(filters: TaskFilters = {}) {
  return useQuery<TaskListItem[]>({
    queryKey: ["/api/tasks", filters],
    queryFn: async () => {
      const res = await fetch(`/api/tasks${buildQuery(filters)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Aufgaben konnten nicht geladen werden");
      return res.json();
    },
  });
}

export function useTask(id: number | null) {
  return useQuery<TaskListItem>({
    queryKey: ["/api/tasks", id],
    enabled: id != null,
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Aufgabe nicht gefunden");
      return res.json();
    },
  });
}

export function useTaskComments(id: number | null) {
  return useQuery<TaskComment[]>({
    queryKey: ["/api/tasks", id, "comments"],
    enabled: id != null,
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Kommentare konnten nicht geladen werden");
      return res.json();
    },
  });
}

function invalidateTasks() {
  queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
}

export function useCreateTask() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      return res.json();
    },
    onSuccess: invalidateTasks,
  });
}

export function useUpdateTask() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/tasks/${id}`, data);
      return res.json();
    },
    onSuccess: invalidateTasks,
  });
}

export function useCompleteTask() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/complete`);
      return res.json();
    },
    onSuccess: invalidateTasks,
  });
}

export function useReopenTask() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/reopen`);
      return res.json();
    },
    onSuccess: invalidateTasks,
  });
}

export function useDeleteTask() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: invalidateTasks,
  });
}

export function useAddTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/comments`, { content });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/tasks", variables.id, "comments"] });
      invalidateTasks();
    },
  });
}

export function useUploadTaskAttachment() {
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tasks/${id}/attachments`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Upload fehlgeschlagen");
      }
      return res.json();
    },
    onSuccess: invalidateTasks,
  });
}

export function useDeleteTaskAttachment() {
  return useMutation({
    mutationFn: async (attachmentId: number) => {
      await apiRequest("DELETE", `/api/tasks/attachments/${attachmentId}`);
    },
    onSuccess: invalidateTasks,
  });
}
