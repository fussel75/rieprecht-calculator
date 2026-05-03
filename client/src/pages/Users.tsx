import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Pencil, Shield, User, Briefcase, Loader2, Eye, EyeOff, AtSign, Plus } from "lucide-react";
import { Redirect } from "wouter";

interface UserData {
  id: number;
  username: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "mitarbeiter";
  createdAt: string;
}

export default function UsersPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Create user state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("mitarbeiter");
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number; username?: string; name?: string; role?: string; password?: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Benutzer aktualisiert", description: "Die Änderungen wurden gespeichert." });
      setEditingUser(null);
      setNewPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; email: string; name: string; password: string; role: string }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Benutzer erstellt", description: "Der neue Benutzer wurde erfolgreich angelegt." });
      setShowCreateDialog(false);
      resetCreateForm();
    },
    onError: (err: Error) => {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    },
  });

  const resetCreateForm = () => {
    setCreateUsername("");
    setCreateEmail("");
    setCreateName("");
    setCreatePassword("");
    setCreateRole("mitarbeiter");
    setShowCreatePassword(false);
  };

  const handleCreateUser = () => {
    createUserMutation.mutate({
      username: createUsername,
      email: createEmail,
      name: createName,
      password: createPassword,
      role: createRole,
    });
  };

  const isCreateUsernameValid = /^[a-zA-Z0-9_-]+$/.test(createUsername) && createUsername.length >= 3 && createUsername.length <= 30;
  const isCreateEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createEmail);
  const isCreatePasswordValid = createPassword.length >= 6;
  const canCreateUser = createUsername && createEmail && createName && createPassword && 
                        isCreateUsernameValid && isCreateEmailValid && isCreatePasswordValid;

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditName(user.name);
    setEditRole(user.role);
    setNewPassword("");
  };

  const handleSave = () => {
    if (!editingUser) return;

    const updates: { id: number; username?: string; name?: string; role?: string; password?: string } = {
      id: editingUser.id,
    };

    if (editUsername !== editingUser.username) {
      updates.username = editUsername;
    }
    if (editName !== editingUser.name) {
      updates.name = editName;
    }
    if (editRole !== editingUser.role) {
      updates.role = editRole;
    }
    if (newPassword) {
      updates.password = newPassword;
    }

    if (Object.keys(updates).length > 1) {
      updateUserMutation.mutate(updates);
    } else {
      setEditingUser(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-primary"><Shield className="w-3 h-3 mr-1" />Administrator</Badge>;
      case "manager":
        return <Badge className="bg-blue-500"><Briefcase className="w-3 h-3 mr-1" />Manager</Badge>;
      default:
        return <Badge variant="secondary"><User className="w-3 h-3 mr-1" />Mitarbeiter</Badge>;
    }
  };

  const isUsernameValid = /^[a-zA-Z0-9_-]+$/.test(editUsername) && editUsername.length >= 3 && editUsername.length <= 30;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Redirect to="/" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Benutzerverwaltung</h1>
          <p className="text-sm text-muted-foreground">Benutzer verwalten und Rollen zuweisen</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg">Alle Benutzer</CardTitle>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-user">
            <Plus className="w-4 h-4 mr-2" />
            Benutzer anlegen
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : users && users.length > 0 ? (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-secondary/20"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                      <AtSign className="w-3 h-3" />{user.username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <div className="mt-2">{getRoleBadge(user.role)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(user)}
                    data-testid={`button-edit-user-${user.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Keine Benutzer gefunden</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-Mail (nicht änderbar)</Label>
                <Input
                  id="edit-email"
                  value={editingUser.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-username">Benutzername</Label>
                <Input
                  id="edit-username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  data-testid="input-edit-username"
                  placeholder="3-30 Zeichen, nur a-z, 0-9, - und _"
                />
                {editUsername && !isUsernameValid && (
                  <p className="text-xs text-destructive">3-30 Zeichen, nur Buchstaben, Zahlen, - und _</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Vollständiger Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rolle</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue placeholder="Rolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Neues Passwort (optional)</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leer lassen für keine Änderung"
                    data-testid="input-edit-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {newPassword && newPassword.length < 6 && (
                  <p className="text-xs text-destructive">Mindestens 6 Zeichen</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateUserMutation.isPending || (newPassword !== "" && newPassword.length < 6) || !isUsernameValid}
              data-testid="button-save-user"
            >
              {updateUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                "Speichern"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); resetCreateForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-username">Benutzername *</Label>
              <Input
                id="create-username"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                placeholder="3-30 Zeichen, nur a-z, 0-9, - und _"
                data-testid="input-create-username"
              />
              {createUsername && !isCreateUsernameValid && (
                <p className="text-xs text-destructive">3-30 Zeichen, nur Buchstaben, Zahlen, - und _</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">E-Mail *</Label>
              <Input
                id="create-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="benutzer@beispiel.de"
                data-testid="input-create-email"
              />
              {createEmail && !isCreateEmailValid && (
                <p className="text-xs text-destructive">Ungültige E-Mail-Adresse</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">Vollständiger Name *</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Max Mustermann"
                data-testid="input-create-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Passwort *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showCreatePassword ? "text" : "password"}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  data-testid="input-create-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                >
                  {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {createPassword && !isCreatePasswordValid && (
                <p className="text-xs text-destructive">Mindestens 6 Zeichen</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Rolle</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger data-testid="select-create-role">
                  <SelectValue placeholder="Rolle wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending || !canCreateUser}
              data-testid="button-submit-create-user"
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Erstellen...
                </>
              ) : (
                "Benutzer erstellen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
