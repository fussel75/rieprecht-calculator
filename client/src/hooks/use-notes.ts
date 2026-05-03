import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Note } from "@shared/schema";

export type NoteListItem = Note & {
  attachments: Array<{ id: number; filename: string; mimeType: string; size: number; uploadedById: number; uploadedAt: string | null }>;
};

export interface NoteFilters {
  scope?: "all" | "mine" | "public";
  search?: string;
}

export function useNotes(filters: NoteFilters = {}) {
  return useQuery<NoteListItem[]>({
    queryKey: ["/api/notes", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.scope) params.set("scope", filters.scope);
      if (filters.search) params.set("search", filters.search);
      const qs = params.toString();
      const res = await fetch(`/api/notes${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Notizen konnten nicht geladen werden");
      return res.json();
    },
  });
}

function invalidateNotes() {
  queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
  queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
}

export function useCreateNote() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/notes", data);
      return res.json();
    },
    onSuccess: invalidateNotes,
  });
}

export function useUpdateNote() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/notes/${id}`, data);
      return res.json();
    },
    onSuccess: invalidateNotes,
  });
}

export function useCompleteNote() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/notes/${id}/complete`);
      return res.json();
    },
    onSuccess: invalidateNotes,
  });
}

export function useReopenNote() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/notes/${id}/reopen`);
      return res.json();
    },
    onSuccess: invalidateNotes,
  });
}

export function useDeleteNote() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: invalidateNotes,
  });
}

export function useUploadNoteAttachment() {
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/notes/${id}/attachments`, {
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
    onSuccess: invalidateNotes,
  });
}

export function useDeleteNoteAttachment() {
  return useMutation({
    mutationFn: async (attachmentId: number) => {
      await apiRequest("DELETE", `/api/notes/attachments/${attachmentId}`);
    },
    onSuccess: invalidateNotes,
  });
}

export function useConvertNoteToTask() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/notes/${id}/convert-to-task`);
      return res.json();
    },
    onSuccess: invalidateNotes,
  });
}

export function useNotificationSettings() {
  return useQuery<{ id: number; userId: number; emailRemindersEnabled: boolean }>({
    queryKey: ["/api/notification-settings"],
    queryFn: async () => {
      const res = await fetch("/api/notification-settings", { credentials: "include" });
      if (!res.ok) throw new Error("Einstellungen konnten nicht geladen werden");
      return res.json();
    },
  });
}

export function useUpdateNotificationSettings() {
  return useMutation({
    mutationFn: async (emailRemindersEnabled: boolean) => {
      const res = await apiRequest("PUT", "/api/notification-settings", { emailRemindersEnabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-settings"] });
    },
  });
}
