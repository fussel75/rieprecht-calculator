import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CheckSquare, NotebookPen, Plus, Search, Calendar as CalendarIcon, Paperclip, Trash2, Pencil,
  CheckCircle2, RotateCcw, Users as UsersIcon, MessageSquare, Download, Upload, Bell, ArrowRight, Globe, Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  useTasks, useTask, useTaskComments, useCreateTask, useUpdateTask, useCompleteTask, useReopenTask,
  useDeleteTask, useAddTaskComment, useUploadTaskAttachment, useDeleteTaskAttachment,
  type TaskListItem, type TaskFilters,
} from "@/hooks/use-tasks";
import {
  useNotes, useCreateNote, useUpdateNote, useCompleteNote, useReopenNote, useDeleteNote,
  useUploadNoteAttachment, useDeleteNoteAttachment, useConvertNoteToTask,
  useNotificationSettings, useUpdateNotificationSettings,
  type NoteListItem, type NoteFilters,
} from "@/hooks/use-notes";
import { cn } from "@/lib/utils";

interface AssignableUser { id: number; name: string; email: string; role: string; }

function useAssignableUsers() {
  return useQuery<AssignableUser[]>({
    queryKey: ["/api/users/assignable"],
    queryFn: async () => {
      const res = await fetch("/api/users/assignable", { credentials: "include" });
      if (!res.ok) throw new Error("Benutzer konnten nicht geladen werden");
      return res.json();
    },
  });
}

const PRIORITIES = [
  { value: "niedrig", label: "Niedrig", color: "bg-slate-200 text-slate-700" },
  { value: "mittel", label: "Mittel", color: "bg-blue-100 text-blue-700" },
  { value: "hoch", label: "Hoch", color: "bg-orange-100 text-orange-700" },
  { value: "dringend", label: "Dringend", color: "bg-red-100 text-red-700" },
] as const;

const STATUSES = [
  { value: "offen", label: "Offen" },
  { value: "in_bearbeitung", label: "In Bearbeitung" },
  { value: "erledigt", label: "Erledigt" },
] as const;

function priorityBadge(p: string) {
  const found = PRIORITIES.find(x => x.value === p) ?? PRIORITIES[1];
  return <Badge className={cn("font-medium", found.color)} variant="secondary">{found.label}</Badge>;
}

function statusLabel(s: string): string {
  return STATUSES.find(x => x.value === s)?.label ?? s;
}

function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const hours = Math.round(abs / (60 * 60 * 1000));
  if (hours < 24) return diff < 0 ? `vor ${hours}h` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return diff < 0 ? `vor ${days}d` : `in ${days}d`;
}

function toLocalInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function fromLocalInputValue(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export default function TasksNotes() {
  const [tab, setTab] = useState<"tasks" | "notes">("tasks");
  const [location] = useLocation();

  // Open task automatically if ?taskId= is in URL (e.g. from email link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get("taskId");
    if (tid) {
      setTab("tasks");
      setTimeout(() => setOpenTaskId(Number(tid)), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <PageHeader
        title="Aufgaben & Notizen"
        description="Aufgaben verwalten, Verantwortliche zuweisen, Notizen festhalten"
      />

      <NotificationSettingsCard />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "tasks" | "notes")}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckSquare className="w-4 h-4 mr-2" /> Aufgaben
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <NotebookPen className="w-4 h-4 mr-2" /> Notizen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <TasksPanel openTaskId={openTaskId} setOpenTaskId={setOpenTaskId} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <NotesPanel openNoteId={openNoteId} setOpenNoteId={setOpenNoteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Notification settings (compact)
// ============================================================
function NotificationSettingsCard() {
  const { data: settings } = useNotificationSettings();
  const { mutate: update, isPending } = useUpdateNotificationSettings();
  const { toast } = useToast();
  return (
    <Card className="border-border/50">
      <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">E-Mail-Erinnerungen für Aufgaben</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={settings?.emailRemindersEnabled ?? true}
            disabled={isPending}
            onCheckedChange={(checked) => {
              update(checked, { onSuccess: () => toast({ title: checked ? "E-Mails aktiviert" : "E-Mails deaktiviert" }) });
            }}
            data-testid="switch-email-reminders"
          />
          <span className="text-xs text-muted-foreground w-16">{settings?.emailRemindersEnabled ?? true ? "An" : "Aus"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Tasks Panel
// ============================================================
function TasksPanel({ openTaskId, setOpenTaskId }: { openTaskId: number | null; setOpenTaskId: (n: number | null) => void; }) {
  const [scope, setScope] = useState<"mine" | "created" | "all">("mine");
  const [showCompleted, setShowCompleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filters: TaskFilters = useMemo(() => ({
    scope,
    status: (statusFilter || undefined) as any,
    priority: (priorityFilter || undefined) as any,
    search: search || undefined,
  }), [scope, statusFilter, priorityFilter, search]);

  const { data: tasks, isLoading } = useTasks(filters);

  const visible = useMemo(() => {
    if (!tasks) return [];
    return showCompleted ? tasks : tasks.filter(t => t.status !== "erledigt");
  }, [tasks, showCompleted]);

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Aufgaben</CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-task">
              <Plus className="w-4 h-4 mr-1" /> Neue Aufgabe
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="w-40" data-testid="select-scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Meine Aufgaben</SelectItem>
                <SelectItem value="created">Von mir vergeben</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Priorität" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prioritäten</SelectItem>
                {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                data-testid="input-search-tasks"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={showCompleted} onCheckedChange={(c) => setShowCompleted(c === true)} />
              Erledigte zeigen
            </label>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
          {!isLoading && visible.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Keine Aufgaben gefunden.</p>
          )}

          <div className="space-y-2">
            {visible.map(t => (
              <TaskRow key={t.id} task={t} onOpen={() => setOpenTaskId(t.id)} />
            ))}
          </div>
        </CardContent>
      </Card>

      <TaskFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <TaskDetailDialog taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </div>
  );
}

function TaskRow({ task, onOpen }: { task: TaskListItem; onOpen: () => void }) {
  const { mutate: complete } = useCompleteTask();
  const { mutate: reopen } = useReopenTask();
  const { toast } = useToast();
  const overdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== "erledigt";
  const completed = task.status === "erledigt";

  return (
    <div
      onClick={onOpen}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors",
        completed && "opacity-60",
      )}
      data-testid={`task-row-${task.id}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (completed) reopen(task.id, { onSuccess: () => toast({ title: "Aufgabe reaktiviert" }) });
          else complete(task.id, { onSuccess: () => toast({ title: "Aufgabe erledigt" }) });
        }}
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
          completed ? "bg-green-600 border-green-600" : "border-muted-foreground hover:border-primary",
        )}
        aria-label={completed ? "Reaktivieren" : "Erledigen"}
      >
        {completed && <CheckCircle2 className="w-4 h-4 text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("font-medium", completed && "line-through")}>{task.title}</span>
          {priorityBadge(task.priority)}
          {task.commentCount > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {task.commentCount}
            </span>
          )}
          {task.attachments.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Paperclip className="w-3 h-3" /> {task.attachments.length}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
        {task.dueDate && (
          <span className={cn("flex items-center gap-1", overdue && "text-red-600 font-semibold")}>
            <CalendarIcon className="w-3 h-3" />
            {formatDateTime(task.dueDate)} ({formatRelative(task.dueDate)})
          </span>
        )}
        {task.assigneeIds.length > 0 && (
          <span className="flex items-center gap-1">
            <UsersIcon className="w-3 h-3" /> {task.assigneeIds.length}
          </span>
        )}
        <span>{statusLabel(task.status)}</span>
      </div>
    </div>
  );
}

// ============================================================
// Task Form Dialog (Create/Edit)
// ============================================================
function TaskFormDialog({
  open, onClose, task,
}: { open: boolean; onClose: () => void; task?: TaskListItem | null }) {
  const isEdit = !!task;
  const { data: users } = useAssignableUsers();
  const { mutate: createTask, isPending: creating } = useCreateTask();
  const { mutate: updateTask, isPending: updating } = useUpdateTask();
  const { toast } = useToast();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(toLocalInputValue(task?.dueDate));
  const [priority, setPriority] = useState(task?.priority ?? "mittel");
  const [status, setStatus] = useState(task?.status ?? "offen");
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? "none");
  const [assigneeIds, setAssigneeIds] = useState<number[]>(task?.assigneeIds ?? []);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setDueDate(toLocalInputValue(task?.dueDate));
      setPriority(task?.priority ?? "mittel");
      setStatus(task?.status ?? "offen");
      setRecurrence(task?.recurrence ?? "none");
      setAssigneeIds(task?.assigneeIds ?? []);
    }
  }, [open, task]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ title: "Titel fehlt", variant: "destructive" });
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      dueDate: fromLocalInputValue(dueDate),
      priority,
      status,
      recurrence,
      assigneeIds,
    };
    if (isEdit && task) {
      updateTask({ id: task.id, data: payload }, {
        onSuccess: () => { toast({ title: "Aufgabe aktualisiert" }); onClose(); },
        onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
      });
    } else {
      createTask(payload, {
        onSuccess: () => { toast({ title: "Aufgabe erstellt" }); onClose(); },
        onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
      });
    }
  };

  const toggleAssignee = (id: number) => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titel *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-task-title" />
          </div>
          <div>
            <Label>Beschreibung</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Fälligkeit</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Wiederholung</Label>
              <Select value={recurrence ?? "none"} onValueChange={setRecurrence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  <SelectItem value="daily">Täglich</SelectItem>
                  <SelectItem value="weekly">Wöchentlich</SelectItem>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Zuweisen an</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <UsersIcon className="w-4 h-4 mr-2" />
                  {assigneeIds.length === 0
                    ? "Niemand zugewiesen"
                    : `${assigneeIds.length} ausgewählt`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2 max-h-72 overflow-auto">
                {(users ?? []).map(u => (
                  <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={assigneeIds.includes(u.id)}
                      onCheckedChange={() => toggleAssignee(u.id)}
                    />
                    <span className="text-sm">{u.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{u.role}</span>
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={creating || updating} data-testid="button-save-task">
            {isEdit ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Task Detail Dialog
// ============================================================
function TaskDetailDialog({ taskId, onClose }: { taskId: number | null; onClose: () => void }) {
  const { data: task } = useTask(taskId);
  const { data: comments } = useTaskComments(taskId);
  const { data: users } = useAssignableUsers();
  const { user: currentUser } = useAuth();
  const { mutate: addComment, isPending: addingComment } = useAddTaskComment();
  const { mutate: complete } = useCompleteTask();
  const { mutate: reopen } = useReopenTask();
  const { mutate: deleteTask } = useDeleteTask();
  const { mutate: uploadAttachment, isPending: uploading } = useUploadTaskAttachment();
  const { mutate: deleteAttachment } = useDeleteTaskAttachment();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!taskId) return null;
  if (!task) {
    return (
      <Dialog open={!!taskId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent><p className="text-sm text-muted-foreground">Lade…</p></DialogContent>
      </Dialog>
    );
  }

  const isCreator = currentUser?.id === task.createdById;
  const userById = new Map((users ?? []).map(u => [u.id, u]));
  const completed = task.status === "erledigt";

  const handleFile = (file: File) => {
    uploadAttachment({ id: task.id, file }, {
      onSuccess: () => toast({ title: "Anhang hochgeladen" }),
      onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <>
      <Dialog open={!!taskId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <DialogTitle className={cn("text-xl", completed && "line-through")}>{task.title}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {priorityBadge(task.priority)}
                  <Badge variant="outline">{statusLabel(task.status)}</Badge>
                  {task.dueDate && <Badge variant="outline">Fällig: {formatDateTime(task.dueDate)}</Badge>}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {task.description && (
              <div>
                <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                <p className="text-sm whitespace-pre-wrap mt-1">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Erstellt von</Label>
                <p>{userById.get(task.createdById)?.name ?? `User #${task.createdById}`}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Zugewiesen an</Label>
                <p>{task.assigneeIds.length === 0 ? "—" : task.assigneeIds.map(id => userById.get(id)?.name ?? `#${id}`).join(", ")}</p>
              </div>
              {task.completedAt && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Erledigt</Label>
                  <p>{formatDateTime(task.completedAt)} {task.completedById && userById.get(task.completedById) ? `· ${userById.get(task.completedById)!.name}` : ""}</p>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Anhänge ({task.attachments.length})</Label>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="w-3 h-3 mr-1" /> Datei
                </Button>
                <input
                  ref={fileInputRef} type="file" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                />
              </div>
              <div className="space-y-1">
                {task.attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/50 text-sm">
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <a
                      href={`/api/tasks/attachments/${a.id}/download`}
                      className="flex-1 truncate hover:underline"
                      target="_blank" rel="noreferrer"
                    >{a.filename}</a>
                    <span className="text-xs text-muted-foreground">{Math.round(a.size / 1024)} KB</span>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteAttachment(a.id, { onSuccess: () => toast({ title: "Anhang gelöscht" }) })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {task.attachments.length === 0 && <p className="text-xs text-muted-foreground">Keine Anhänge</p>}
              </div>
            </div>

            {/* Comments */}
            <div>
              <Label className="text-xs text-muted-foreground">Kommentare / Verlauf</Label>
              <div className="space-y-2 mt-2 max-h-64 overflow-auto">
                {(comments ?? []).map(c => (
                  <div key={c.id} className="text-sm p-2 rounded bg-muted/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{userById.get(c.authorId)?.name ?? `User #${c.authorId}`}</span>
                      <span>{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
                {(comments ?? []).length === 0 && <p className="text-xs text-muted-foreground">Noch keine Kommentare</p>}
              </div>
              <div className="flex gap-2 mt-2">
                <Textarea
                  placeholder="Kommentar hinzufügen…"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  disabled={addingComment || !commentInput.trim()}
                  onClick={() => addComment(
                    { id: task.id, content: commentInput.trim() },
                    { onSuccess: () => setCommentInput("") }
                  )}
                >Senden</Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {isCreator && (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-1" /> Löschen
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Bearbeiten
            </Button>
            {completed ? (
              <Button onClick={() => reopen(task.id, { onSuccess: () => toast({ title: "Reaktiviert" }) })}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reaktivieren
              </Button>
            ) : (
              <Button onClick={() => complete(task.id, { onSuccess: () => { toast({ title: "Erledigt" }); onClose(); } })}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Als erledigt markieren
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskFormDialog open={editOpen} task={task} onClose={() => setEditOpen(false)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aufgabe löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTask(task.id, { onSuccess: () => { toast({ title: "Gelöscht" }); setConfirmDelete(false); onClose(); } })}
            >Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================
// Notes Panel
// ============================================================
function NotesPanel({ openNoteId, setOpenNoteId }: { openNoteId: number | null; setOpenNoteId: (n: number | null) => void; }) {
  const [scope, setScope] = useState<"all" | "mine" | "public">("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filters: NoteFilters = useMemo(() => ({ scope, search: search || undefined }), [scope, search]);
  const { data: notes, isLoading } = useNotes(filters);

  const visible = useMemo(() => {
    if (!notes) return [];
    return showCompleted ? notes : notes.filter(n => !n.completedAt);
  }, [notes, showCompleted]);

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Notizen</CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-new-note">
              <Plus className="w-4 h-4 mr-1" /> Neue Notiz
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle sichtbaren</SelectItem>
                <SelectItem value="mine">Meine</SelectItem>
                <SelectItem value="public">Öffentliche</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={showCompleted} onCheckedChange={(c) => setShowCompleted(c === true)} />
              Erledigte zeigen
            </label>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
          {!isLoading && visible.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Keine Notizen.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visible.map(n => (
              <NoteCard key={n.id} note={n} onOpen={() => setOpenNoteId(n.id)} />
            ))}
          </div>
        </CardContent>
      </Card>

      <NoteFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <NoteDetailDialog noteId={openNoteId} onClose={() => setOpenNoteId(null)} />
    </div>
  );
}

function NoteCard({ note, onOpen }: { note: NoteListItem; onOpen: () => void }) {
  const completed = !!note.completedAt;
  return (
    <div
      onClick={onOpen}
      className={cn(
        "p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors",
        completed && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={cn("font-medium text-sm", completed && "line-through")}>{note.title}</h3>
        {note.visibility === "public"
          ? <Badge variant="secondary" className="bg-blue-100 text-blue-700"><Globe className="w-3 h-3 mr-1" />Öffentlich</Badge>
          : <Badge variant="outline"><Lock className="w-3 h-3 mr-1" />Privat</Badge>}
      </div>
      {note.content && <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{note.content}</p>}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
        <span>{formatDateTime(note.updatedAt)}</span>
        {note.attachments.length > 0 && (
          <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {note.attachments.length}</span>
        )}
      </div>
    </div>
  );
}

function NoteFormDialog({
  open, onClose, note,
}: { open: boolean; onClose: () => void; note?: NoteListItem | null }) {
  const isEdit = !!note;
  const { mutate: createNote, isPending: creating } = useCreateNote();
  const { mutate: updateNote, isPending: updating } = useUpdateNote();
  const { toast } = useToast();
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [isPublic, setIsPublic] = useState(note?.visibility === "public");

  useEffect(() => {
    if (open) {
      setTitle(note?.title ?? "");
      setContent(note?.content ?? "");
      setIsPublic(note?.visibility === "public");
    }
  }, [open, note]);

  const handleSubmit = () => {
    if (!title.trim()) { toast({ title: "Titel fehlt", variant: "destructive" }); return; }
    const payload = { title: title.trim(), content: content.trim() || null, visibility: isPublic ? "public" : "private" };
    if (isEdit && note) {
      updateNote({ id: note.id, data: payload }, {
        onSuccess: () => { toast({ title: "Notiz aktualisiert" }); onClose(); },
        onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
      });
    } else {
      createNote(payload, {
        onSuccess: () => { toast({ title: "Notiz erstellt" }); onClose(); },
        onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{isEdit ? "Notiz bearbeiten" : "Neue Notiz"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titel *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Inhalt</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isPublic} onCheckedChange={(c) => setIsPublic(c === true)} />
            Für alle sichtbar
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={creating || updating}>{isEdit ? "Speichern" : "Erstellen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteDetailDialog({ noteId, onClose }: { noteId: number | null; onClose: () => void }) {
  const { data: notes } = useNotes({ scope: "all" });
  const note = notes?.find(n => n.id === noteId) ?? null;
  const { user: currentUser } = useAuth();
  const { data: users } = useAssignableUsers();
  const { mutate: complete } = useCompleteNote();
  const { mutate: reopen } = useReopenNote();
  const { mutate: deleteNote } = useDeleteNote();
  const { mutate: uploadAttachment, isPending: uploading } = useUploadNoteAttachment();
  const { mutate: deleteAttachment } = useDeleteNoteAttachment();
  const { mutate: convertToTask, isPending: converting } = useConvertNoteToTask();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!noteId) return null;
  if (!note) {
    return (
      <Dialog open={!!noteId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent><p className="text-sm text-muted-foreground">Lade…</p></DialogContent>
      </Dialog>
    );
  }

  const isCreator = currentUser?.id === note.createdById;
  const completed = !!note.completedAt;
  const userById = new Map((users ?? []).map(u => [u.id, u]));

  return (
    <>
      <Dialog open={!!noteId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn("text-xl", completed && "line-through")}>{note.title}</DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              {note.visibility === "public"
                ? <Badge className="bg-blue-100 text-blue-700"><Globe className="w-3 h-3 mr-1" />Öffentlich</Badge>
                : <Badge variant="outline"><Lock className="w-3 h-3 mr-1" />Privat</Badge>}
              <span className="text-xs text-muted-foreground">
                Erstellt von {userById.get(note.createdById)?.name ?? `User #${note.createdById}`} · {formatDateTime(note.updatedAt)}
              </span>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {note.content && <p className="text-sm whitespace-pre-wrap">{note.content}</p>}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Anhänge ({note.attachments.length})</Label>
                {isCreator && (
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <Upload className="w-3 h-3 mr-1" /> Datei
                  </Button>
                )}
                <input
                  ref={fileInputRef} type="file" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAttachment({ id: note.id, file: f }, {
                      onSuccess: () => toast({ title: "Anhang hochgeladen" }),
                      onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
                    });
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="space-y-1">
                {note.attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/50 text-sm">
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <a
                      href={`/api/notes/attachments/${a.id}/download`}
                      className="flex-1 truncate hover:underline"
                      target="_blank" rel="noreferrer"
                    >{a.filename}</a>
                    <span className="text-xs text-muted-foreground">{Math.round(a.size / 1024)} KB</span>
                    {isCreator && (
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => deleteAttachment(a.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {note.attachments.length === 0 && <p className="text-xs text-muted-foreground">Keine Anhänge</p>}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {isCreator && (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-1" /> Löschen
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              disabled={converting}
              onClick={() => convertToTask(note.id, {
                onSuccess: () => { toast({ title: "In Aufgabe umgewandelt" }); onClose(); },
                onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
              })}
            >
              <ArrowRight className="w-4 h-4 mr-1" /> In Aufgabe umwandeln
            </Button>
            {isCreator && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-1" /> Bearbeiten
              </Button>
            )}
            {isCreator && (completed ? (
              <Button onClick={() => reopen(note.id, { onSuccess: () => toast({ title: "Reaktiviert" }) })}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reaktivieren
              </Button>
            ) : (
              <Button onClick={() => complete(note.id, { onSuccess: () => { toast({ title: "Erledigt" }); onClose(); } })}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Erledigen
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NoteFormDialog open={editOpen} note={note} onClose={() => setEditOpen(false)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNote(note.id, { onSuccess: () => { toast({ title: "Gelöscht" }); setConfirmDelete(false); onClose(); } })}
            >Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
