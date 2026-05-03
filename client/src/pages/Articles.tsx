import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ClipboardList, Upload, Plus, Trash2, Pencil, Loader2, CheckCircle2, Info, Search, X
} from "lucide-react";
import type { Article } from "@shared/schema";

const CATEGORY_LABELS: Record<string, string> = {
  entsorgung: "Entsorgung",
  service: "Service",
  lieferung: "Lieferung",
  zuschlag: "Zuschlag",
};

const CATEGORY_COLORS: Record<string, string> = {
  entsorgung: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  service: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  lieferung: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  zuschlag: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export default function Articles() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const [formNumber, setFormNumber] = useState("");
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState("t");
  const [formCategory, setFormCategory] = useState("entsorgung");
  const [formAvv, setFormAvv] = useState("");

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ['/api/articles'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/articles', data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Artikel erstellt" });
      queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Fehler", description: err.message || "Artikelnummer existiert bereits", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/articles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Artikel aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
      setEditDialogOpen(false);
      setEditArticle(null);
    },
    onError: () => toast({ title: "Fehler", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/articles/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Artikel gelöscht" });
      queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
    },
    onError: () => toast({ title: "Fehler", variant: "destructive" }),
  });

  const confirmImportMutation = useMutation({
    mutationFn: async (data: { preview: any[] }) => {
      const res = await apiRequest('POST', '/api/articles/confirm-import', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Import erfolgreich", description: data.message });
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
    },
    onError: () => toast({ title: "Fehler beim Import", variant: "destructive" }),
  });

  const resetForm = () => {
    setFormNumber("");
    setFormName("");
    setFormUnit("t");
    setFormCategory("entsorgung");
    setFormAvv("");
  };

  const openEdit = (article: Article) => {
    setEditArticle(article);
    setFormNumber(article.articleNumber);
    setFormName(article.name);
    setFormUnit(article.unit);
    setFormCategory(article.category);
    setFormAvv(article.avvNumber || "");
    setEditDialogOpen(true);
  };

  const openAdd = () => {
    resetForm();
    setAddDialogOpen(true);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/articles/import-pdf', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Fehler", description: json.message, variant: "destructive" });
        return;
      }

      setPreview(json);
      toast({ title: "Vorschau bereit", description: `${json.preview.length} Artikel erkannt` });
    } catch {
      toast({ title: "Fehler beim Upload", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [toast]);

  const filtered = articles.filter(a => {
    const matchSearch = !searchTerm ||
      a.articleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = filterCategory === "all" || a.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const counts = {
    entsorgung: articles.filter(a => a.category === "entsorgung").length,
    service: articles.filter(a => a.category === "service").length,
    lieferung: articles.filter(a => a.category === "lieferung").length,
    zuschlag: articles.filter(a => a.category === "zuschlag").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-articles">
            <ClipboardList className="h-6 w-6 text-primary" />
            Artikelstamm
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Artikel aus der Auftragssoftware verwalten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-article-file"
          />
          <Button variant="outline" size="sm" onClick={openAdd} data-testid="button-add-article">
            <Plus className="h-4 w-4 mr-1" />
            Neuer Artikel
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-article-import"
          >
            {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            PDF importieren
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(counts).map(([cat, count]) => (
          <Card
            key={cat}
            className={`cursor-pointer transition-all ${filterCategory === cat ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground font-medium">{CATEGORY_LABELS[cat]}</p>
              <p className="text-xl font-bold" data-testid={`text-count-${cat}`}>{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {preview && (
        <Card className="border-2 border-blue-300 dark:border-blue-700" data-testid="card-article-preview">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Vorschau: {preview.fileName} – {preview.preview.length} Artikel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs" data-testid="table-article-preview">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Art.-Nr.</th>
                    <th className="text-left p-2 font-medium">Bezeichnung</th>
                    <th className="text-left p-2 font-medium">Einheit</th>
                    <th className="text-left p-2 font-medium">Kategorie</th>
                    <th className="text-left p-2 font-medium">AVV</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((a: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-secondary/50">
                      <td className="p-2 font-mono text-xs">{a.articleNumber}</td>
                      <td className="p-2">{a.name}</td>
                      <td className="p-2">{a.unit}</td>
                      <td className="p-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[a.category] || ''}`}>
                          {CATEGORY_LABELS[a.category] || a.category}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-xs">{a.avvNumber || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" size="sm" onClick={() => setPreview(null)} data-testid="button-cancel-article-preview">
                Abbrechen
              </Button>
              <Button
                size="sm"
                disabled={confirmImportMutation.isPending}
                onClick={() => confirmImportMutation.mutate({ preview: preview.preview })}
                data-testid="button-confirm-article-import"
              >
                {confirmImportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                {preview.preview.length} Artikel importieren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Nr. oder Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-article-search"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {filterCategory !== "all" && (
          <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterCategory("all")}>
            {CATEGORY_LABELS[filterCategory]} <X className="h-3 w-3 ml-1" />
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{filtered.length} Artikel</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              {articles.length === 0 ? "Noch keine Artikel vorhanden." : "Keine Treffer für diese Suche."}
            </p>
            {articles.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">Importiere eine Artikelliste als PDF oder lege Artikel manuell an.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-articles">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Art.-Nr.</th>
                  <th className="text-left p-2 font-medium">Bezeichnung</th>
                  <th className="text-left p-2 font-medium">Einheit</th>
                  <th className="text-left p-2 font-medium">Kategorie</th>
                  <th className="text-left p-2 font-medium">AVV</th>
                  <th className="text-center p-2 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className={`border-b hover:bg-secondary/50 ${a.isActive === false ? 'opacity-50' : ''}`} data-testid={`article-row-${a.id}`}>
                    <td className="p-2 font-mono text-xs font-medium">{a.articleNumber}</td>
                    <td className="p-2">{a.name}</td>
                    <td className="p-2 text-xs">{a.unit}</td>
                    <td className="p-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[a.category] || ''}`}>
                        {CATEGORY_LABELS[a.category] || a.category}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-xs">{a.avvNumber || '–'}</td>
                    <td className="p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)} data-testid={`button-edit-article-${a.id}`}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(a.id)} data-testid={`button-delete-article-${a.id}`}>
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Artikel</DialogTitle>
            <DialogDescription>Artikel manuell anlegen</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Artikelnummer</Label>
              <Input value={formNumber} onChange={(e) => setFormNumber(e.target.value)} placeholder="z.B. 170904/M³" data-testid="input-add-article-number" />
            </div>
            <div className="space-y-1">
              <Label>Bezeichnung</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="z.B. Baumisch" data-testid="input-add-article-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Einheit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger data-testid="select-add-article-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m³">m³</SelectItem>
                    <SelectItem value="t">Tonne</SelectItem>
                    <SelectItem value="Stück">Stück</SelectItem>
                    <SelectItem value="Std">Stunde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Kategorie</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger data-testid="select-add-article-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entsorgung">Entsorgung</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="lieferung">Lieferung</SelectItem>
                    <SelectItem value="zuschlag">Zuschlag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>AVV-Nummer (optional)</Label>
              <Input value={formAvv} onChange={(e) => setFormAvv(e.target.value)} placeholder="z.B. 170904" data-testid="input-add-article-avv" />
            </div>
            <Button
              className="w-full"
              disabled={!formNumber || !formName || createMutation.isPending}
              onClick={() => createMutation.mutate({
                articleNumber: formNumber,
                name: formName,
                unit: formUnit,
                category: formCategory,
                avvNumber: formAvv || null,
              })}
              data-testid="button-save-article"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Artikel anlegen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Artikel bearbeiten</DialogTitle>
            <DialogDescription>{editArticle?.articleNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Artikelnummer</Label>
              <Input value={formNumber} onChange={(e) => setFormNumber(e.target.value)} data-testid="input-edit-article-number" />
            </div>
            <div className="space-y-1">
              <Label>Bezeichnung</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} data-testid="input-edit-article-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Einheit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger data-testid="select-edit-article-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m³">m³</SelectItem>
                    <SelectItem value="t">Tonne</SelectItem>
                    <SelectItem value="Stück">Stück</SelectItem>
                    <SelectItem value="Std">Stunde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Kategorie</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger data-testid="select-edit-article-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entsorgung">Entsorgung</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="lieferung">Lieferung</SelectItem>
                    <SelectItem value="zuschlag">Zuschlag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>AVV-Nummer (optional)</Label>
              <Input value={formAvv} onChange={(e) => setFormAvv(e.target.value)} data-testid="input-edit-article-avv" />
            </div>
            <Button
              className="w-full"
              disabled={!formNumber || !formName || updateMutation.isPending}
              onClick={() => editArticle && updateMutation.mutate({
                id: editArticle.id,
                data: {
                  articleNumber: formNumber,
                  name: formName,
                  unit: formUnit,
                  category: formCategory,
                  avvNumber: formAvv || null,
                },
              })}
              data-testid="button-update-article"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
