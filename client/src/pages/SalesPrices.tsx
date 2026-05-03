import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Tag, AlertTriangle, Search, Upload, FileText, Loader2, Euro, Recycle, PackagePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSalesPriceSchema, insertSalesFixedPriceSchema, type InsertSalesPrice, type InsertSalesFixedPrice, type SalesPrice, type SalesFixedPrice, type SalesSurcharge } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";

function useMaterials() {
  return useQuery<any[]>({
    queryKey: ["/api/materials"],
  });
}

function useSalesPrices() {
  return useQuery<SalesPrice[]>({
    queryKey: ["/api/sales-prices"],
  });
}

function useSalesFixedPrices() {
  return useQuery<SalesFixedPrice[]>({
    queryKey: ["/api/sales-fixed-prices"],
  });
}

function useCreateSalesPrice() {
  return useMutation({
    mutationFn: (data: InsertSalesPrice) => apiRequest("POST", "/api/sales-prices", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sales-prices"] }),
  });
}

function useUpdateSalesPrice() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertSalesPrice> }) => 
      apiRequest("PUT", `/api/sales-prices/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sales-prices"] }),
  });
}

function useDeleteSalesPrice() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/sales-prices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sales-prices"] }),
  });
}

function useCreateSalesFixedPrice() {
  return useMutation({
    mutationFn: (data: InsertSalesFixedPrice) => apiRequest("POST", "/api/sales-fixed-prices", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sales-fixed-prices"] }),
  });
}

function useUpdateSalesFixedPrice() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertSalesFixedPrice> }) => 
      apiRequest("PUT", `/api/sales-fixed-prices/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sales-fixed-prices"] }),
  });
}

function useDeleteSalesFixedPrice() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/sales-fixed-prices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sales-fixed-prices"] }),
  });
}

export default function SalesPrices() {
  const { data: salesPrices, isLoading: loadingPrices } = useSalesPrices();
  const { data: fixedPrices, isLoading: loadingFixed } = useSalesFixedPrices();
  const { data: allMaterials } = useMaterials();

  const getArticleNumber = (price: SalesPrice) => {
    if (!allMaterials) return null;
    const normalizeAvv = (code: string | null) => (code || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const normalizeName = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").trim();
    const nameSimilarity = (a: string, b: string) => {
      const at = new Set(normalizeName(a).split(" ").filter(t => t.length > 2));
      const bt = new Set(normalizeName(b).split(" ").filter(t => t.length > 2));
      if (at.size === 0 || bt.size === 0) return 0;
      let overlap = 0;
      at.forEach(t => { if (bt.has(t)) overlap++; });
      return overlap / Math.min(at.size, bt.size);
    };

    if (price.priceType === 'lieferung') {
      const lieferungMats = allMaterials.filter(m => m.materialType === 'lieferung');
      const priceName = normalizeName(price.materialName);
      let best = lieferungMats.find(m => priceName.includes(normalizeName(m.name)));
      if (!best) {
        const ranked = lieferungMats
          .map(m => ({ m, score: nameSimilarity(price.materialName, m.name) }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score);
        best = ranked[0]?.m;
      }
      return best?.articleNumber || null;
    }

    const priceAvv = normalizeAvv(price.avvCode);
    const candidates = allMaterials.filter(m => {
      const matAvv = normalizeAvv(m.avvNumber);
      if (!matAvv || !priceAvv) return false;
      return matAvv === priceAvv || priceAvv.startsWith(matAvv) || matAvv.startsWith(priceAvv);
    });
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].articleNumber || null;
    const ranked = candidates
      .map(m => ({ m, score: nameSimilarity(price.materialName, m.name) }))
      .sort((a, b) => b.score - a.score);
    return ranked[0].m.articleNumber || null;
  };
  const { mutate: deleteSalesPrice } = useDeleteSalesPrice();
  const { mutate: deleteFixedPrice } = useDeleteSalesFixedPrice();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFixedCreateOpen, setIsFixedCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id: number; data: InsertSalesPrice } | null>(null);
  const [editFixedItem, setEditFixedItem] = useState<{ id: number; data: InsertSalesFixedPrice } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [surchargeDialogOpen, setSurchargeDialogOpen] = useState(false);
  const [editSurcharge, setEditSurcharge] = useState<SalesSurcharge | null>(null);

  const { data: salesSurcharges } = useQuery<SalesSurcharge[]>({ queryKey: ["/api/sales-surcharges"] });

  const createSurchargeMut = useMutation({
    mutationFn: async (data: { name: string; amount: string; unit: string }) => {
      const res = await apiRequest('POST', '/api/sales-surcharges', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-surcharges"] });
      toast({ title: "Zuschlag erstellt" });
      setSurchargeDialogOpen(false);
    },
  });

  const updateSurchargeMut = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; amount: string; unit: string }) => {
      const res = await apiRequest('PUT', `/api/sales-surcharges/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-surcharges"] });
      toast({ title: "Zuschlag aktualisiert" });
      setEditSurcharge(null);
    },
  });

  const deleteSurchargeMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/sales-surcharges/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-surcharges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-prices"] });
      toast({ title: "Zuschlag gelöscht" });
    },
  });

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: "Fehler", description: "Bitte eine PDF-Datei auswählen", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      
      const response = await fetch('/api/sales-prices/import-pdf', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({ 
          title: "Import erfolgreich", 
          description: `${result.imported} Preise importiert, ${result.updated} aktualisiert` 
        });
        queryClient.invalidateQueries({ queryKey: ["/api/sales-prices"] });
      } else {
        toast({ title: "Fehler", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Fehler", description: "Import fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredPrices = salesPrices?.filter(p => 
    p.avvCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.materialName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeletePrice = (id: number) => {
    if (confirm("Verkaufspreis wirklich löschen?")) {
      deleteSalesPrice(id, {
        onSuccess: () => toast({ title: "Gelöscht" })
      });
    }
  };

  const handleDeleteFixed = (id: number) => {
    if (confirm("Fixpreis wirklich löschen?")) {
      deleteFixedPrice(id, {
        onSuccess: () => toast({ title: "Gelöscht" })
      });
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <PageHeader
        title="Verkaufspreise"
        description="Eigene Preisliste nach AVV-Nummern"
      />

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="materials" data-testid="tab-materials">Materialpreise</TabsTrigger>
          <TabsTrigger value="surcharges" data-testid="tab-sales-surcharges">Zuschläge</TabsTrigger>
          <TabsTrigger value="fixed" data-testid="tab-fixed">Pauschalen</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-4 mt-4">
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="p-4">
              <input
                type="file"
                accept=".pdf"
                ref={fileInputRef}
                onChange={handlePdfUpload}
                className="hidden"
                data-testid="input-pdf-upload"
              />
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-medium">Preisliste aus PDF importieren</h3>
                  <p className="text-sm text-muted-foreground">Rieprecht-Preisliste hochladen – Preise werden automatisch erkannt</p>
                </div>
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  variant="outline"
                  className="shrink-0"
                  data-testid="button-upload-pdf"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importiere...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" /> PDF hochladen
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="AVV-Nr. oder Material suchen..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-price"
              />
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary font-semibold" data-testid="button-add-price">
              <Plus className="mr-2 h-4 w-4" /> Preis hinzufügen
            </Button>
          </div>

          {loadingPrices ? (
            <p className="text-center py-8 text-muted-foreground">Laden...</p>
          ) : (
            <>
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-2 pb-1">
              <Recycle className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-primary">Abfallarten ({filteredPrices?.filter(p => p.priceType !== 'lieferung').length || 0})</h3>
            </div>
          </div>
          <div className="space-y-2">
            {filteredPrices?.filter(p => p.priceType !== 'lieferung').map((price) => (
              <Card key={price.id} className="border-border/50 shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm">{price.materialName}</h3>
                        {price.isDangerous && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Gefährlich
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getArticleNumber(price) && <span className="font-mono text-primary/70">{getArticleNumber(price)} · </span>}
                        <span className="font-mono">AVV {price.avvCode}</span>
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                        {price.pricePerTonne && (
                          <span><strong>{formatCurrency(Number(price.pricePerTonne))}</strong>/t</span>
                        )}
                        {price.pricePerCubicMeter && (
                          <span><strong>{formatCurrency(Number(price.pricePerCubicMeter))}</strong>/m³</span>
                        )}
                      </div>
                      {price.salesSurchargeIds && price.salesSurchargeIds.length > 0 && salesSurcharges && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {salesSurcharges.filter(s => price.salesSurchargeIds!.includes(s.id)).map(s => (
                            <Badge key={s.id} variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
                              +{formatCurrency(Number(s.amount))}/{s.unit === "m3" ? "m³" : s.unit === "stueck" ? "Stk" : "t"} {s.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setEditItem({ 
                          id: price.id, 
                          data: { 
                            avvCode: price.avvCode,
                            materialName: price.materialName,
                            pricePerTonne: price.pricePerTonne,
                            pricePerCubicMeter: price.pricePerCubicMeter,
                            behgSurcharge: price.behgSurcharge,
                            salesSurchargeIds: price.salesSurchargeIds || [],
                            isDangerous: price.isDangerous,
                            validFrom: price.validFrom,
                            notes: price.notes,
                            isActive: price.isActive
                          }
                        })}
                        data-testid={`button-edit-price-${price.id}`}
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleDeletePrice(price.id)} 
                        data-testid={`button-delete-price-${price.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-2 mt-6">
            <div className="flex items-center gap-2 pt-2 pb-1">
              <PackagePlus className="w-4 h-4 text-orange-600" />
              <h3 className="font-semibold text-sm text-orange-600">Schüttgüter & Baustoffe ({filteredPrices?.filter(p => p.priceType === 'lieferung').length || 0})</h3>
            </div>
          </div>
          <div className="space-y-2">
            {filteredPrices?.filter(p => p.priceType === 'lieferung').map((price) => (
              <Card key={price.id} className="border-border/50 shadow-sm border-l-2 border-l-orange-400">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
                      <PackagePlus className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{price.materialName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getArticleNumber(price) && <span className="font-mono text-primary/70">{getArticleNumber(price)} · </span>}
                        {price.avvCode && <span className="font-mono">AVV {price.avvCode} · </span>}
                        Lieferung
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                        {price.pricePerTonne && (
                          <span><strong>{formatCurrency(Number(price.pricePerTonne))}</strong>/t</span>
                        )}
                        {price.pricePerCubicMeter && (
                          <span><strong>{formatCurrency(Number(price.pricePerCubicMeter))}</strong>/m³</span>
                        )}
                      </div>
                      {price.salesSurchargeIds && price.salesSurchargeIds.length > 0 && salesSurcharges && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {salesSurcharges.filter(s => price.salesSurchargeIds!.includes(s.id)).map(s => (
                            <Badge key={s.id} variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
                              +{formatCurrency(Number(s.amount))}/{s.unit === "m3" ? "m³" : s.unit === "stueck" ? "Stk" : "t"} {s.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setEditItem({ 
                          id: price.id, 
                          data: { 
                            avvCode: price.avvCode,
                            materialName: price.materialName,
                            pricePerTonne: price.pricePerTonne,
                            pricePerCubicMeter: price.pricePerCubicMeter,
                            behgSurcharge: price.behgSurcharge,
                            salesSurchargeIds: price.salesSurchargeIds || [],
                            isDangerous: price.isDangerous,
                            validFrom: price.validFrom,
                            notes: price.notes,
                            isActive: price.isActive
                          }
                        })}
                        data-testid={`button-edit-price-${price.id}`}
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleDeletePrice(price.id)} 
                        data-testid={`button-delete-price-${price.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredPrices?.filter(p => p.priceType === 'lieferung').length === 0 && (
              <p className="text-center py-6 text-muted-foreground text-sm">Noch keine Schüttgut-Verkaufspreise angelegt</p>
            )}
          </div>

          {filteredPrices?.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Keine Verkaufspreise vorhanden</p>
          )}
            </>
          )}
        </TabsContent>

        <TabsContent value="surcharges" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Zuschläge die pro Material auf den Verkaufspreis aufgeschlagen werden
            </p>
            <Button onClick={() => setSurchargeDialogOpen(true)} className="bg-primary font-semibold" data-testid="button-add-sales-surcharge">
              <Plus className="mr-2 h-4 w-4" /> Zuschlag hinzufügen
            </Button>
          </div>

          {!salesSurcharges || salesSurcharges.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Euro className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">Keine Zuschläge angelegt</p>
              <p className="text-xs text-muted-foreground">Erstellen Sie Zuschläge und weisen Sie diese dann den Materialpreisen zu</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {salesSurcharges.map((s) => {
                const assignedPrices = salesPrices?.filter(p => p.salesSurchargeIds?.includes(s.id)) || [];
                return (
                  <Card key={s.id} className="border-border/50 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                            <Euro className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-medium text-sm">{s.name}</h3>
                              {s.appliesToDangerous && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Gefährlich</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {assignedPrices.length > 0
                                ? `${assignedPrices.length} Material${assignedPrices.length > 1 ? 'ien' : ''} zugeordnet`
                                : 'Keinem Material zugeordnet'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-bold text-sm text-amber-600">
                              {formatCurrency(Number(s.amount))}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              pro {s.unit === "m3" ? "m³" : s.unit === "stueck" ? "Stück" : "Tonne"}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditSurcharge(s)} data-testid={`button-edit-sales-surcharge-${s.id}`}>
                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => {
                            if (confirm("Zuschlag wirklich löschen?")) deleteSurchargeMut.mutate(s.id);
                          }} data-testid={`button-delete-sales-surcharge-${s.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {assignedPrices.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {assignedPrices.map(p => (
                            <Badge key={p.id} variant="secondary" className="text-[10px]">{p.materialName}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fixed" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsFixedCreateOpen(true)} className="bg-primary font-semibold" data-testid="button-add-fixed">
              <Plus className="mr-2 h-4 w-4" /> Pauschale hinzufügen
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {loadingFixed ? (
              <p className="text-center py-8 text-muted-foreground col-span-full">Laden...</p>
            ) : fixedPrices?.map((price) => (
              <Card key={price.id} className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{price.name}</h3>
                      <p className="text-lg font-bold text-primary mt-1">
                        {formatCurrency(Number(price.price))} / {price.unit}
                      </p>
                      {price.appliesToDangerous && (
                        <Badge variant="outline" className="mt-2 text-xs">Nur gefährliche Abfälle</Badge>
                      )}
                    </div>
                    <div className="flex">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setEditFixedItem({ 
                          id: price.id, 
                          data: { 
                            name: price.name,
                            price: price.price,
                            unit: price.unit,
                            appliesToDangerous: price.appliesToDangerous,
                            notes: price.notes,
                            isActive: price.isActive
                          }
                        })}
                        data-testid={`button-edit-fixed-${price.id}`}
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteFixed(price.id)} 
                        data-testid={`button-delete-fixed-${price.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {fixedPrices?.length === 0 && (
              <p className="text-center py-8 text-muted-foreground col-span-full">Keine Pauschalen vorhanden</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <SalesPriceDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        title="Neuer Verkaufspreis"
        surcharges={salesSurcharges || []}
      />
      
      {editItem && (
        <SalesPriceDialog
          open={!!editItem}
          onOpenChange={(open: boolean) => !open && setEditItem(null)}
          title="Verkaufspreis bearbeiten"
          initialData={editItem.data}
          id={editItem.id}
          surcharges={salesSurcharges || []}
        />
      )}

      <FixedPriceDialog 
        open={isFixedCreateOpen} 
        onOpenChange={setIsFixedCreateOpen} 
        title="Neue Pauschale"
      />
      
      {editFixedItem && (
        <FixedPriceDialog
          open={!!editFixedItem}
          onOpenChange={(open: boolean) => !open && setEditFixedItem(null)}
          title="Pauschale bearbeiten"
          initialData={editFixedItem.data}
          id={editFixedItem.id}
        />
      )}

      <SalesSurchargeDialog
        open={surchargeDialogOpen}
        onOpenChange={setSurchargeDialogOpen}
        onSave={(data) => createSurchargeMut.mutate(data)}
        isPending={createSurchargeMut.isPending}
      />

      {editSurcharge && (
        <SalesSurchargeDialog
          open={!!editSurcharge}
          onOpenChange={(open) => !open && setEditSurcharge(null)}
          initialData={editSurcharge}
          onSave={(data) => updateSurchargeMut.mutate({ id: editSurcharge.id, ...data })}
          isPending={updateSurchargeMut.isPending}
        />
      )}
    </div>
  );
}

function SalesPriceDialog({ 
  open, 
  onOpenChange, 
  title, 
  initialData, 
  id,
  surcharges 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  title: string; 
  initialData?: InsertSalesPrice;
  id?: number;
  surcharges: SalesSurcharge[];
}) {
  const { toast } = useToast();
  const { mutate: createPrice, isPending: isCreating } = useCreateSalesPrice();
  const [priceWarning, setPriceWarning] = useState<{ warnings: string[]; materialName: string; pendingData: InsertSalesPrice } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSurchargeIds, setSelectedSurchargeIds] = useState<number[]>(
    (initialData?.salesSurchargeIds as number[]) || []
  );

  const toggleSurcharge = (surchargeId: number) => {
    setSelectedSurchargeIds(prev =>
      prev.includes(surchargeId)
        ? prev.filter(id => id !== surchargeId)
        : [...prev, surchargeId]
    );
  };

  const form = useForm<InsertSalesPrice>({
    resolver: zodResolver(insertSalesPriceSchema),
    defaultValues: initialData || {
      avvCode: "",
      materialName: "",
      pricePerTonne: null,
      pricePerCubicMeter: null,
      behgSurcharge: "0",
      isDangerous: false,
      validFrom: null,
      notes: null,
      isActive: true,
    },
  });

  const savePrice = async (data: InsertSalesPrice, confirm: boolean = false) => {
    const payload = { ...data, salesSurchargeIds: selectedSurchargeIds };
    if (!id) {
      createPrice(payload, {
        onSuccess: () => {
          toast({ title: "Verkaufspreis erstellt" });
          queryClient.invalidateQueries({ queryKey: ["/api/sales-surcharges"] });
          onOpenChange(false);
          form.reset();
          setSelectedSurchargeIds([]);
        },
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const body = confirm ? { ...payload, confirmLargeChange: true } : payload;
      const res = await fetch(`/api/sales-prices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (res.status === 409 && json.requireConfirmation) {
        setPriceWarning({ warnings: json.warnings, materialName: json.materialName, pendingData: data });
        return;
      }

      if (!res.ok) {
        toast({ title: "Fehler", description: json.message, variant: "destructive" });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/sales-prices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-surcharges"] });
      toast({ title: "Verkaufspreis aktualisiert" });
      onOpenChange(false);
      setPriceWarning(null);
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = (data: InsertSalesPrice) => {
    savePrice(data);
  };

  const isUpdating = isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="avvCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AVV-Nummer</FormLabel>
                    <FormControl>
                      <Input placeholder="170201" {...field} data-testid="input-avv-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isDangerous"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 pt-8">
                    <FormControl>
                      <Checkbox 
                        checked={field.value || false} 
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-dangerous"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 text-sm">Gefährlich (*)</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="materialName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bezeichnung</FormLabel>
                  <FormControl>
                    <Input placeholder="Bau und Abbruchholz (A1-A3)" {...field} data-testid="input-material-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pricePerTonne"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preis/Tonne (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="71.50"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        data-testid="input-price-tonne"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pricePerCubicMeter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preis/m³ (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="43.30"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        data-testid="input-price-m3"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {surcharges.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Zuschläge zuordnen</label>
                <div className="grid gap-1.5">
                  {surcharges.map(s => {
                    const isSelected = selectedSurchargeIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSurcharge(s.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${
                          isSelected
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                            : 'border-border/50 hover:bg-muted/50'
                        }`}
                        data-testid={`toggle-sales-surcharge-${s.id}`}
                      >
                        <span className={isSelected ? 'font-medium' : 'text-muted-foreground'}>{s.name}</span>
                        <span className={`text-xs ${isSelected ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                          +{formatCurrency(Number(s.amount))}/{s.unit === "m3" ? "m³" : s.unit === "stueck" ? "Stk" : "t"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isCreating || isUpdating} data-testid="button-save-price">
                {isCreating || isUpdating ? "Speichern..." : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {priceWarning && (
          <div className="mt-4 border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-4" data-testid="price-warning-dialog">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">Große Preisänderung erkannt!</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Material: {priceWarning.materialName}</p>
              </div>
            </div>
            <ul className="space-y-1 mb-4">
              {priceWarning.warnings.map((w, i) => (
                <li key={i} className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">⚠</span> {w}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPriceWarning(null)} data-testid="button-cancel-warning">
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                onClick={() => savePrice(priceWarning.pendingData, true)}
                data-testid="button-confirm-warning"
              >
                {isSubmitting ? "Speichern..." : "Trotzdem speichern"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FixedPriceDialog({ 
  open, 
  onOpenChange, 
  title, 
  initialData, 
  id 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  title: string; 
  initialData?: InsertSalesFixedPrice;
  id?: number;
}) {
  const { toast } = useToast();
  const { mutate: createPrice, isPending: isCreating } = useCreateSalesFixedPrice();
  const { mutate: updatePrice, isPending: isUpdating } = useUpdateSalesFixedPrice();

  const form = useForm<InsertSalesFixedPrice>({
    resolver: zodResolver(insertSalesFixedPriceSchema),
    defaultValues: initialData || {
      name: "",
      price: "",
      unit: "Stück",
      appliesToDangerous: false,
      notes: null,
      isActive: true,
    },
  });

  const onSubmit = (data: InsertSalesFixedPrice) => {
    if (id) {
      updatePrice({ id, data }, {
        onSuccess: () => {
          toast({ title: "Pauschale aktualisiert" });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      });
    } else {
      createPrice(data, {
        onSuccess: () => {
          toast({ title: "Pauschale erstellt" });
          onOpenChange(false);
          form.reset();
        },
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bezeichnung</FormLabel>
                  <FormControl>
                    <Input placeholder="Container Abholung/Tausch" {...field} data-testid="input-fixed-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preis (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="135.00"
                        {...field}
                        data-testid="input-fixed-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einheit</FormLabel>
                    <FormControl>
                      <Input placeholder="Stück" {...field} data-testid="input-fixed-unit" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="appliesToDangerous"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox 
                      checked={field.value || false} 
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-fixed-dangerous"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0 text-sm">Nur für gefährliche Abfälle</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isCreating || isUpdating} data-testid="button-save-fixed">
                {isCreating || isUpdating ? "Speichern..." : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SalesSurchargeDialog({ open, onOpenChange, initialData, onSave, isPending }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: { name: string; amount: string; unit: string; appliesToDangerous?: boolean | null };
  onSave: (data: { name: string; amount: string; unit: string; appliesToDangerous: boolean }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [amount, setAmount] = useState(initialData?.amount || "0");
  const [unit, setUnit] = useState(initialData?.unit || "tonne");
  const [appliesToDangerous, setAppliesToDangerous] = useState(initialData?.appliesToDangerous || false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initialData ? "Zuschlag bearbeiten" : "Neuer Zuschlag"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Bezeichnung</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. BEHG Zuschlag" data-testid="input-sales-surcharge-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Betrag (€)</label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-sales-surcharge-amount" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Pro</label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger data-testid="select-sales-surcharge-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tonne">pro Tonne</SelectItem>
                  <SelectItem value="m3">pro m³</SelectItem>
                  <SelectItem value="stueck">pro Stück</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={appliesToDangerous}
              onCheckedChange={(v) => setAppliesToDangerous(!!v)}
              data-testid="checkbox-sales-surcharge-dangerous"
            />
            <label className="text-sm">Nur für gefährliche Abfälle</label>
          </div>
          <Button
            className="w-full"
            disabled={!name.trim() || isPending}
            onClick={() => onSave({ name: name.trim(), amount, unit, appliesToDangerous })}
            data-testid="button-save-sales-surcharge"
          >
            Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
