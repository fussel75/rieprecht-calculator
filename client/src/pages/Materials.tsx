import { useMaterials, useCreateMaterial, useDeleteMaterial, useUpdateMaterial } from "@/hooks/use-materials";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Package, Euro, Recycle, PackagePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMaterialSchema, type InsertMaterial, type PurchaseSurcharge } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

export default function Materials() {
  const { data: materials, isLoading } = useMaterials();
  const { mutate: deleteMaterial } = useDeleteMaterial();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id: number; data: InsertMaterial } | null>(null);
  const [surchargeDialogOpen, setSurchargeDialogOpen] = useState(false);
  const [editSurcharge, setEditSurcharge] = useState<PurchaseSurcharge | null>(null);

  const { data: surcharges } = useQuery<PurchaseSurcharge[]>({ queryKey: ["/api/purchase-surcharges"] });

  const createSurchargeMut = useMutation({
    mutationFn: async (data: { name: string; amount: string; unit: string }) => {
      const res = await apiRequest('POST', '/api/purchase-surcharges', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-surcharges"] });
      toast({ title: "Zuschlag erstellt" });
      setSurchargeDialogOpen(false);
    },
  });

  const updateSurchargeMut = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; amount: string; unit: string }) => {
      const res = await apiRequest('PUT', `/api/purchase-surcharges/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-surcharges"] });
      toast({ title: "Zuschlag aktualisiert" });
      setEditSurcharge(null);
    },
  });

  const deleteSurchargeMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/purchase-surcharges/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-surcharges"] });
      toast({ title: "Zuschlag gelöscht" });
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("Material wirklich löschen?")) {
      deleteMaterial(id, {
        onSuccess: () => toast({ title: "Gelöscht" })
      });
    }
  };

  const getSurchargesForMaterial = (mat: { purchaseSurchargeIds?: number[] | null }) => {
    if (!mat.purchaseSurchargeIds || !surcharges) return [];
    return surcharges.filter(s => mat.purchaseSurchargeIds!.includes(s.id));
  };

  const calcTotalSurcharge = (mat: { purchaseSurchargeIds?: number[] | null; density: string }, size: number = 1) => {
    const assigned = getSurchargesForMaterial(mat);
    const density = Number(mat.density || 1);
    return assigned.reduce((sum, s) => {
      if (s.unit === "m3") return sum + Number(s.amount) * size;
      return sum + Number(s.amount);
    }, 0);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <PageHeader
        title="Einkaufspreise"
        description="Entsorgungskosten, Schüttgut-Einkauf und Zuschläge (was wir bezahlen)"
      />

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="w-full max-w-md" data-testid="tabs-purchase-prices">
          <TabsTrigger value="materials" className="flex-1" data-testid="tab-purchase-materials">Materialpreise</TabsTrigger>
          <TabsTrigger value="surcharges" className="flex-1" data-testid="tab-purchase-surcharges">Zuschläge</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90 font-semibold" data-testid="button-add-material">
              <Plus className="mr-2 h-4 w-4" /> Hinzufügen
            </Button>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Laden...</p>
          ) : (
            <>
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-2 pb-1">
              <Recycle className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-primary">Abfallarten ({materials?.filter(m => (m as any).materialType !== 'lieferung').length || 0})</h3>
            </div>
          </div>
          <div className="space-y-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
            {materials?.filter(m => (m as any).materialType !== 'lieferung').map((material) => {
              const assignedSurcharges = getSurchargesForMaterial(material);
              return (
                <Card key={material.id} className="border-border/50 shadow-sm">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        (material as any).materialType === 'lieferung' 
                          ? 'bg-orange-500/10 text-orange-600' 
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {(material as any).materialType === 'lieferung' ? <PackagePlus className="w-4 h-4" /> : <Recycle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-medium text-sm truncate">{material.name}</h3>
                          {(material as any).materialType === 'lieferung' && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">Lieferung</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {(material as any).articleNumber && <span className="font-mono text-primary/70">{(material as any).articleNumber} · </span>}
                          {material.avvNumber && <span className="font-mono">{material.avvNumber} · </span>}
                          {(material as any).grainSize && <span>{(material as any).grainSize} · </span>}
                          {Number(material.density).toFixed(2)} t/m³ · {(material as any).materialType === 'lieferung' 
                            ? `EK ${formatCurrency(Number((material as any).purchaseCostPerTonne || 0), 0)}/t`
                            : `${formatCurrency(Number(material.disposalCostPerTonne), 0)}/t`
                          }
                        </p>
                        {assignedSurcharges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {assignedSurcharges.map(s => (
                              <Badge key={s.id} variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
                                +{formatCurrency(Number(s.amount))}/{s.unit === "m3" ? "m³" : s.unit === "stueck" ? "Stk" : "t"}  {s.name}
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
                            id: material.id,
                            data: {
                              name: material.name,
                              articleNumber: (material as any).articleNumber || "",
                              avvNumber: material.avvNumber || "",
                              density: material.density,
                              disposalCostPerTonne: material.disposalCostPerTonne,
                              surchargeAmount: material.surchargeAmount || "0",
                              surchargeUnit: material.surchargeUnit || "tonne",
                              purchaseSurchargeIds: material.purchaseSurchargeIds || [],
                              isActive: material.isActive,
                              materialType: (material as any).materialType || "entsorgung",
                              purchaseCostPerTonne: (material as any).purchaseCostPerTonne || "0",
                              grainSize: (material as any).grainSize || "",
                            } as any
                          })}
                          data-testid={`button-edit-material-${material.id}`}
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => handleDelete(material.id)}
                          data-testid={`button-delete-material-${material.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-2 mt-6">
            <div className="flex items-center gap-2 pt-2 pb-1">
              <PackagePlus className="w-4 h-4 text-orange-600" />
              <h3 className="font-semibold text-sm text-orange-600">Schüttgüter & Baustoffe ({materials?.filter(m => (m as any).materialType === 'lieferung').length || 0})</h3>
            </div>
          </div>
          <div className="space-y-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
            {materials?.filter(m => (m as any).materialType === 'lieferung').map((material) => {
              const assignedSurcharges = getSurchargesForMaterial(material);
              return (
                <Card key={material.id} className="border-border/50 shadow-sm border-l-2 border-l-orange-400">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                        <PackagePlus className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="font-medium text-sm truncate">{material.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {(material as any).articleNumber && <span className="font-mono text-primary/70" data-testid={`text-article-number-${material.id}`}>{(material as any).articleNumber} · </span>}
                          {(material as any).grainSize && <span>{(material as any).grainSize} · </span>}
                          {Number(material.density).toFixed(2)} t/m³ · EK {formatCurrency(Number((material as any).purchaseCostPerTonne || 0), 0)}/t
                        </p>
                        {assignedSurcharges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {assignedSurcharges.map(s => (
                              <Badge key={s.id} variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
                                +{formatCurrency(Number(s.amount))}/{s.unit === "m3" ? "m³" : s.unit === "stueck" ? "Stk" : "t"}  {s.name}
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
                            id: material.id,
                            data: {
                              name: material.name,
                              articleNumber: (material as any).articleNumber || "",
                              avvNumber: material.avvNumber || "",
                              density: material.density,
                              disposalCostPerTonne: material.disposalCostPerTonne,
                              surchargeAmount: material.surchargeAmount || "0",
                              surchargeUnit: material.surchargeUnit || "tonne",
                              purchaseSurchargeIds: material.purchaseSurchargeIds || [],
                              isActive: material.isActive,
                              materialType: (material as any).materialType || "entsorgung",
                              purchaseCostPerTonne: (material as any).purchaseCostPerTonne || "0",
                              grainSize: (material as any).grainSize || "",
                            } as any
                          })}
                          data-testid={`button-edit-material-${material.id}`}
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => handleDelete(material.id)}
                          data-testid={`button-delete-material-${material.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {materials?.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Keine Materialien vorhanden</p>
          )}
            </>
          )}
        </TabsContent>

        <TabsContent value="surcharges" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Zuschläge die pro Material auf den Entsorgungspreis aufgeschlagen werden
            </p>
            <Button onClick={() => setSurchargeDialogOpen(true)} className="bg-primary hover:bg-primary/90 font-semibold" data-testid="button-add-surcharge">
              <Plus className="mr-2 h-4 w-4" /> Zuschlag hinzufügen
            </Button>
          </div>

          {!surcharges || surcharges.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Euro className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">Keine Zuschläge angelegt</p>
              <p className="text-xs text-muted-foreground">Erstellen Sie Zuschläge und weisen Sie diese dann den Materialien zu</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {surcharges.map((s) => {
                const assignedMats = materials?.filter(m => m.purchaseSurchargeIds?.includes(s.id)) || [];
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
                              {assignedMats.length > 0
                                ? `${assignedMats.length} Material${assignedMats.length > 1 ? 'ien' : ''} zugeordnet`
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
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditSurcharge(s)} data-testid={`button-edit-surcharge-${s.id}`}>
                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => {
                            if (confirm("Zuschlag wirklich löschen?")) deleteSurchargeMut.mutate(s.id);
                          }} data-testid={`button-delete-surcharge-${s.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {assignedMats.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {assignedMats.map(m => (
                            <Badge key={m.id} variant="secondary" className="text-[10px]">{m.name}</Badge>
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
      </Tabs>

      <MaterialDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Neues Material"
        surcharges={surcharges || []}
      />

      {editItem && (
        <MaterialDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          title="Material bearbeiten"
          initialData={editItem.data}
          id={editItem.id}
          surcharges={surcharges || []}
        />
      )}

      <SurchargeDialog
        open={surchargeDialogOpen}
        onOpenChange={setSurchargeDialogOpen}
        onSave={(data) => createSurchargeMut.mutate(data)}
        isPending={createSurchargeMut.isPending}
      />

      {editSurcharge && (
        <SurchargeDialog
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

function SurchargeDialog({ open, onOpenChange, initialData, onSave, isPending }: {
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
          <DialogDescription>Zuschlag der auf den Entsorgungspreis aufgeschlagen wird</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Bezeichnung</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. BEHG Zuschlag" data-testid="input-surcharge-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Betrag (€)</label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-surcharge-amount" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Pro</label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger data-testid="select-surcharge-unit">
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
              data-testid="checkbox-surcharge-dangerous"
            />
            <label className="text-sm">Nur für gefährliche Abfälle</label>
          </div>
          <Button
            className="w-full"
            disabled={!name.trim() || isPending}
            onClick={() => onSave({ name: name.trim(), amount, unit, appliesToDangerous })}
            data-testid="button-save-surcharge"
          >
            Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MaterialDialog({ open, onOpenChange, title, initialData, id, surcharges }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialData?: InsertMaterial;
  id?: number;
  surcharges: PurchaseSurcharge[];
}) {
  const { mutate: create } = useCreateMaterial();
  const { mutate: update } = useUpdateMaterial();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSurchargeIds, setSelectedSurchargeIds] = useState<number[]>(
    (initialData?.purchaseSurchargeIds as number[]) || []
  );

  const [matType, setMatType] = useState<string>((initialData as any)?.materialType || "entsorgung");

  const form = useForm<any>({
    resolver: zodResolver(insertMaterialSchema),
    defaultValues: initialData || {
      name: "",
      articleNumber: "",
      avvNumber: "",
      density: "1.0",
      disposalCostPerTonne: "0",
      surchargeAmount: "0",
      surchargeUnit: "tonne",
      isActive: true,
      materialType: "entsorgung",
      purchaseCostPerTonne: "0",
      grainSize: "",
    },
  });

  const toggleSurcharge = (surchargeId: number) => {
    setSelectedSurchargeIds(prev =>
      prev.includes(surchargeId)
        ? prev.filter(id => id !== surchargeId)
        : [...prev, surchargeId]
    );
  };

  const onSubmit = (data: any) => {
    const payload = { ...data, purchaseSurchargeIds: selectedSurchargeIds, materialType: matType };
    if (id) {
      update({ id, ...payload }, {
        onSuccess: () => {
          toast({ title: "Aktualisiert" });
          queryClient.invalidateQueries({ queryKey: ["/api/purchase-surcharges"] });
          onOpenChange(false);
        }
      });
    } else {
      create(payload, {
        onSuccess: () => {
          toast({ title: "Erstellt" });
          queryClient.invalidateQueries({ queryKey: ["/api/purchase-surcharges"] });
          onOpenChange(false);
          form.reset();
          setSelectedSurchargeIds([]);
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription>Materialtyp mit Einkaufspreis und Zuschlägen</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Typ</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={matType === "entsorgung" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMatType("entsorgung")}
                  data-testid="button-mattype-entsorgung"
                >
                  <Recycle className="h-4 w-4 mr-1" /> Entsorgung
                </Button>
                <Button
                  type="button"
                  variant={matType === "lieferung" ? "default" : "outline"}
                  size="sm"
                  className={matType === "lieferung" ? "bg-[#eb7636] hover:bg-[#d4682f] text-white" : ""}
                  onClick={() => setMatType("lieferung")}
                  data-testid="button-mattype-lieferung"
                >
                  <PackagePlus className="h-4 w-4 mr-1" /> Lieferung
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className={matType === "lieferung" ? "col-span-3" : "col-span-1"}>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="border-border/50" data-testid="input-material-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="articleNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Art.-Nr.</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="z.B. P-001" className="border-border/50 font-mono text-sm" data-testid="input-material-article-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {matType === "entsorgung" && (
                <FormField
                  control={form.control}
                  name="avvNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AVV-Nr.</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="17 01 01" className="border-border/50 font-mono text-sm" data-testid="input-material-avv" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {matType === "lieferung" && (
              <FormField
                control={form.control}
                name="grainSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Körnung</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="z.B. 0-2 mm, 8-32 mm" className="border-border/50" data-testid="input-material-grain-size" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="density"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dichte (t/m³)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" className="border-border/50" data-testid="input-material-density" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {matType === "entsorgung" ? (
                <FormField
                  control={form.control}
                  name="disposalCostPerTonne"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entsorgungskosten (€/t)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" className="border-border/50" data-testid="input-material-disposal-cost" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="purchaseCostPerTonne"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Einkaufspreis (€/t)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || "0"} type="number" step="0.01" className="border-border/50" data-testid="input-material-purchase-cost" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
                        data-testid={`toggle-surcharge-${s.id}`}
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

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-semibold" data-testid="button-save-material">
              Speichern
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
