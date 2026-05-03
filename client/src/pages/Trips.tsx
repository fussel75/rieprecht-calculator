import { useState, useRef, useMemo } from "react";
import { useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip } from "@/hooks/use-trips";
import { useMaterials } from "@/hooks/use-materials";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Truck, Plus, Trash2, Pencil, Calendar, Box, MapPin, Euro, FileText, Upload, FileSpreadsheet, Loader2, Building2, HardHat, ClipboardList, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { downloadPdf } from "@/lib/pdf-export";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, isWithinInterval, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import type { Trip, Vehicle, Customer, Article } from "@shared/schema";

const ORDER_TYPES = [
  { value: "Abholen", label: "Behälter Abholen", category: "container" },
  { value: "Leeren", label: "Behälter Leeren", category: "container" },
  { value: "Wechsel", label: "Behälter Wechsel", category: "container" },
  { value: "Aufstellen", label: "Behälter Aufstellen", category: "gestellung" },
  { value: "Beladen", label: "Behälter Beladen", category: "container" },
  { value: "Transport", label: "Transport", category: "transport" },
  { value: "Lieferung", label: "Materiallieferung", category: "transport" },
  { value: "Subi", label: "Subi-Fahrt", category: "subi" },
];

type PeriodType = "week" | "month" | "halfyear" | "year" | "custom";

function getCategory(ot: string | null | undefined): string {
  const v = (ot || '').toLowerCase();
  if (['abholen','leeren','wechsel','beladen'].includes(v)) return 'container';
  if (v === 'aufstellen') return 'gestellung';
  if (['transport','lieferung','ausführen'].includes(v)) return 'transport';
  if (['subi','subunternehmer'].includes(v)) return 'subi';
  return 'other';
}

function getPeriodRange(period: PeriodType, customFrom?: string, customTo?: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (period) {
    case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: "Diese Woche" };
    case "month": return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, "MMMM yyyy", { locale: de }) };
    case "halfyear": return { start: subMonths(startOfMonth(now), 5), end: endOfMonth(now), label: "Letztes Halbjahr" };
    case "year": return { start: startOfYear(now), end: endOfYear(now), label: String(now.getFullYear()) };
    case "custom": {
      const from = customFrom ? parseISO(customFrom) : startOfMonth(now);
      const to = customTo ? parseISO(customTo) : endOfMonth(now);
      return { start: from, end: to, label: `${format(from, "dd.MM.yy")} – ${format(to, "dd.MM.yy")}` };
    }
  }
}

export default function Trips() {
  const { data: trips, isLoading } = useTrips();
  const { data: materials } = useMaterials();
  const { data: vehicles } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: customers } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: articles } = useQuery<Article[]>({ queryKey: ["/api/articles"] });
  const { mutate: createTrip, isPending: isCreating } = useCreateTrip();
  const { mutate: updateTrip } = useUpdateTrip();
  const { mutate: deleteTrip } = useDeleteTrip();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pdfLoading, setPdfLoading] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"csv" | "pdf">("csv");

  const [tripDate, setTripDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vehicleId, setVehicleId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [constructionSite, setConstructionSite] = useState("");
  const [orderType, setOrderType] = useState<string>("");
  const [articleId, setArticleId] = useState<string>("");
  const [materialId, setMaterialId] = useState<string>("");
  const [containerSize, setContainerSize] = useState<string>("7");
  const [quantity, setQuantity] = useState("");
  const [distanceKm, setDistanceKm] = useState("15");
  const [actualPrice, setActualPrice] = useState("");

  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; date: string } | null>(null);

  const [editDate, setEditDate] = useState("");
  const [editVehicleId, setEditVehicleId] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editConstructionSite, setEditConstructionSite] = useState("");
  const [editOrderType, setEditOrderType] = useState("");
  const [editArticleId, setEditArticleId] = useState("");
  const [editMaterialId, setEditMaterialId] = useState("");
  const [editContainerSize, setEditContainerSize] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editDistanceKm, setEditDistanceKm] = useState("");
  const [editActualPrice, setEditActualPrice] = useState("");

  const [period, setPeriod] = useState<PeriodType>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  type SortField = "tripDate" | "vehiclePlate" | "customerNumber" | "customerName" | "constructionSite" | "quantity" | "unit" | "actualPrice" | "aTyp" | "aArt" | "avvNumber" | "articleNumber" | "articleName" | "orderType";
  const [sortField, setSortField] = useState<SortField>("tripDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const [filterText, setFilterText] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [filterVehicle, setFilterVehicle] = useState<string>("all");
  const [filterOrderType, setFilterOrderType] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"all" | "period">("period");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const selectedArticle = articles?.find(a => a.id === Number(articleId));
  const selectedEditArticle = articles?.find(a => a.id === Number(editArticleId));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualPrice) {
      toast({ title: "Fehler", description: "Bitte Preis angeben", variant: "destructive" });
      return;
    }

    const selectedCustomer = customers?.find(c => c.id === Number(customerId));
    const selectedVehicle = vehicles?.find(v => v.id === Number(vehicleId));

    createTrip({
      tripDate,
      materialId: materialId ? parseInt(materialId) : null,
      containerSize: parseInt(containerSize) || 7,
      distanceKm: distanceKm || "0",
      actualPrice,
      vehicleId: vehicleId ? parseInt(vehicleId) : null,
      customerId: customerId ? parseInt(customerId) : null,
      customerName: selectedCustomer ? (selectedCustomer.companyName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`) : null,
      constructionSite: constructionSite || null,
      orderType: orderType || null,
      articleId: articleId ? parseInt(articleId) : null,
      articleNumber: selectedArticle?.articleNumber || null,
      quantity: quantity || null,
      unit: selectedArticle?.unit || null,
    } as any, {
      onSuccess: () => {
        toast({ title: "Gespeichert", description: "Fahrt wurde erfasst" });
        setActualPrice("");
        setQuantity("");
        setConstructionSite("");
      },
      onError: () => {
        toast({ title: "Fehler", description: "Fahrt konnte nicht gespeichert werden", variant: "destructive" });
      }
    });
  };

  const openEdit = (trip: Trip) => {
    setEditTrip(trip);
    setEditDate(trip.tripDate);
    setEditVehicleId((trip.vehicleId || "").toString());
    setEditCustomerId((trip.customerId || "").toString());
    setEditConstructionSite(trip.constructionSite || "");
    setEditOrderType(trip.orderType || "");
    setEditArticleId((trip.articleId || "").toString());
    setEditMaterialId((trip.materialId || 0).toString());
    setEditContainerSize(trip.containerSize.toString());
    setEditQuantity(trip.quantity || "");
    setEditDistanceKm(trip.distanceKm);
    setEditActualPrice(trip.actualPrice);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!editTrip) return;
    const selectedCustomer = customers?.find(c => c.id === Number(editCustomerId));

    updateTrip({
      id: editTrip.id,
      tripDate: editDate,
      materialId: editMaterialId ? parseInt(editMaterialId) : null,
      containerSize: parseInt(editContainerSize) || 7,
      distanceKm: editDistanceKm,
      actualPrice: editActualPrice,
      vehicleId: editVehicleId ? parseInt(editVehicleId) : null,
      customerId: editCustomerId ? parseInt(editCustomerId) : null,
      customerName: selectedCustomer ? (selectedCustomer.companyName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`) : null,
      constructionSite: editConstructionSite || null,
      orderType: editOrderType || null,
      articleId: editArticleId ? parseInt(editArticleId) : null,
      articleNumber: selectedEditArticle?.articleNumber || null,
      quantity: editQuantity || null,
      unit: selectedEditArticle?.unit || null,
    } as any, {
      onSuccess: () => {
        toast({ title: "Gespeichert", description: "Fahrt wurde aktualisiert" });
        setEditDialogOpen(false);
        setEditTrip(null);
      },
      onError: () => {
        toast({ title: "Fehler", description: "Fahrt konnte nicht aktualisiert werden", variant: "destructive" });
      }
    });
  };

  const handleFileSelect = async (file: File, type: "csv" | "pdf") => {
    setImportFile(file);
    setImportType(type);
    setImportPreview(null);
    setImportErrors([]);
    setImportLoading(true);
    setImportDialogOpen(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const endpoint = type === "csv" ? "/api/trips/import-csv" : "/api/trips/import-pdf";
      const response = await fetch(`${endpoint}?preview=true`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast({ title: "Fehler", description: data.message || "Import fehlgeschlagen", variant: "destructive" });
        setImportDialogOpen(false);
        return;
      }

      setImportPreview(data.trips || []);
      setImportErrors(data.errors || []);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Datei konnte nicht verarbeitet werden", variant: "destructive" });
      setImportDialogOpen(false);
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!importFile) return;
    setImportLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      
      const endpoint = importType === "csv" ? "/api/trips/import-csv" : "/api/trips/import-pdf";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast({ title: "Fehler", description: data.message || "Import fehlgeschlagen", variant: "destructive" });
        return;
      }

      toast({ title: "Importiert", description: data.message || `${data.count} Fahrten importiert` });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      setImportDialogOpen(false);
      setImportPreview(null);
      setImportFile(null);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Import fehlgeschlagen", variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteTrip(deleteConfirm.id, {
      onSuccess: () => {
        toast({ title: "Gelöscht", description: "Fahrt wurde entfernt" });
        setDeleteConfirm(null);
      }
    });
  };

  const { start: periodStart, end: periodEnd, label: periodLabel } = getPeriodRange(period, customFrom, customTo);

  const tripsInPeriodRaw = useMemo(() => {
    return trips?.filter(t => {
      try {
        const date = parseISO(t.tripDate);
        return isWithinInterval(date, { start: periodStart, end: periodEnd });
      } catch { return false; }
    }) || [];
  }, [trips, periodStart, periodEnd]);

  const uniqueCustomers = useMemo(() => {
    const names = new Set(tripsInPeriodRaw.map(t => t.customerName).filter(Boolean));
    return Array.from(names).sort((a, b) => (a || '').localeCompare(b || ''));
  }, [tripsInPeriodRaw]);

  const uniqueVehicles = useMemo(() => {
    const plates = new Set(tripsInPeriodRaw.map(t => t.vehiclePlate).filter(Boolean));
    return Array.from(plates).sort((a, b) => (a || '').localeCompare(b || ''));
  }, [tripsInPeriodRaw]);

  const uniqueOrderTypes = useMemo(() => {
    const types = new Set(tripsInPeriodRaw.map(t => t.orderType).filter(Boolean));
    return Array.from(types).sort((a, b) => (a || '').localeCompare(b || ''));
  }, [tripsInPeriodRaw]);

  const tripsInPeriodUnsorted = useMemo(() => {
    return tripsInPeriodRaw.filter(t => {
      if (filterCategory !== "all" && getCategory(t.orderType) !== filterCategory) return false;
      if (filterCustomer !== "all" && t.customerName !== filterCustomer) return false;
      if (filterVehicle !== "all" && t.vehiclePlate !== filterVehicle) return false;
      if (filterOrderType !== "all" && t.orderType !== filterOrderType) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        const searchable = [
          t.customerName, t.constructionSite, t.vehiclePlate, t.customerNumber,
          t.articleNumber, t.articleName, t.avvNumber, t.aTyp, t.aArt, t.orderType, t.notes
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [tripsInPeriodRaw, filterCategory, filterCustomer, filterVehicle, filterOrderType, filterText]);

  const tripsInPeriod = useMemo(() => {
    const list = [...tripsInPeriodUnsorted];
    list.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';
      if (sortField === 'actualPrice' || sortField === 'quantity') {
        valA = Number(a[sortField] || 0);
        valB = Number(b[sortField] || 0);
      } else {
        valA = (a[sortField] || '').toString().toLowerCase();
        valB = (b[sortField] || '').toString().toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [tripsInPeriodUnsorted, sortField, sortDir]);

  const containerTrips = tripsInPeriod.filter(t => getCategory(t.orderType) === 'container');
  const gestellungTrips = tripsInPeriod.filter(t => getCategory(t.orderType) === 'gestellung');
  const transportTrips = tripsInPeriod.filter(t => getCategory(t.orderType) === 'transport');
  const subiTrips = tripsInPeriod.filter(t => getCategory(t.orderType) === 'subi');
  const uncategorized = tripsInPeriod.filter(t => getCategory(t.orderType) === 'other');

  const containerRevenue = containerTrips.reduce((s, t) => s + Number(t.actualPrice || 0), 0);
  const gestellungRevenue = gestellungTrips.reduce((s, t) => s + Number(t.actualPrice || 0), 0);
  const transportRevenue = transportTrips.reduce((s, t) => s + Number(t.actualPrice || 0), 0);
  const subiRevenue = subiTrips.reduce((s, t) => s + Number(t.actualPrice || 0), 0);
  const uncategorizedRevenue = uncategorized.reduce((s, t) => s + Number(t.actualPrice || 0), 0);

  const totalRevenue = containerRevenue + gestellungRevenue + transportRevenue + subiRevenue + uncategorizedRevenue;
  const tripCount = tripsInPeriod.length;
  const avgRevenue = tripCount > 0 ? totalRevenue / tripCount : 0;

  const activeArticles = articles?.filter(a => a.isActive !== false) || [];
  const entsorgungArticles = activeArticles.filter(a => a.category === 'entsorgung');
  const serviceArticles = activeArticles.filter(a => a.category === 'service');
  const lieferungArticles = activeArticles.filter(a => a.category === 'lieferung');

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="space-y-3">
        <PageHeader 
          title="Fahrten-Protokoll" 
          description="Erfasse tatsächlich gefahrene Container"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" data-testid="input-csv-upload" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file, "csv"); e.target.value = ""; }} />
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" data-testid="input-pdf-upload" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file, "pdf"); e.target.value = ""; }} />
          <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => csvInputRef.current?.click()} data-testid="button-csv-import">
            <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />CSV Import
          </Button>
          <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => pdfInputRef.current?.click()} data-testid="button-pdf-import">
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />PDF Import
          </Button>
          <Button variant="outline" size="sm" className="text-xs sm:text-sm" disabled={pdfLoading} data-testid="button-pdf-export" onClick={async () => { setPdfLoading(true); try { await downloadPdf('/api/trips/pdf', 'Fahrten.pdf', {}); } catch (err: any) { toast({ title: "Fehler", description: err.message || "PDF-Export fehlgeschlagen", variant: "destructive" }); } finally { setPdfLoading(false); } }}>
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />{pdfLoading ? 'Exportiere...' : 'PDF Export'}
          </Button>
          <Button variant="destructive" size="sm" className="text-xs sm:text-sm" onClick={() => setDeleteDialogOpen(true)} data-testid="button-delete-trips">
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />Fahrten löschen
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["week", "month", "halfyear", "year", "custom"] as PeriodType[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setPeriod(p)}
              data-testid={`button-period-${p}`}
            >
              {p === "week" ? "Woche" : p === "month" ? "Monat" : p === "halfyear" ? "Halbjahr" : p === "year" ? "Jahr" : "Zeitraum"}
            </Button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36 h-8 text-xs" data-testid="input-custom-from" />
              <span className="text-xs text-muted-foreground">bis</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36 h-8 text-xs" data-testid="input-custom-to" />
            </div>
          )}
        </div>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Euro className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold text-emerald-600" data-testid="text-total-revenue">{formatCurrency(totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Einnahmen netto gesamt</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium" data-testid="text-trip-count">{tripCount} Aufträge</p>
                <p className="text-xs text-muted-foreground">{periodLabel}: {format(periodStart, "dd.MM.", { locale: de })} – {format(periodEnd, "dd.MM.yy", { locale: de })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-500/30">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-medium text-blue-600">Container-Fahrten</p>
              </div>
              <p className="text-lg font-bold" data-testid="text-container-revenue">{formatCurrency(containerRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{containerTrips.length} Fahrten · Abholen / Leeren / Wechsel / Beladen</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <Box className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-medium text-amber-600">Gestellungen</p>
              </div>
              <p className="text-lg font-bold" data-testid="text-gestellung-revenue">{formatCurrency(gestellungRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{gestellungTrips.length} Aufträge · Aufstellen</p>
            </CardContent>
          </Card>
          <Card className="border-violet-500/30">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-violet-600" />
                <p className="text-xs font-medium text-violet-600">Transporte & Lieferungen</p>
              </div>
              <p className="text-lg font-bold" data-testid="text-transport-revenue">{formatCurrency(transportRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{transportTrips.length} Aufträge · Transport / Material</p>
            </CardContent>
          </Card>
          <Card className="border-orange-500/30">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <HardHat className="w-4 h-4 text-orange-600" />
                <p className="text-xs font-medium text-orange-600">Subi-Fahrten</p>
              </div>
              <p className="text-lg font-bold" data-testid="text-subi-revenue">{formatCurrency(subiRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{subiTrips.length} Fahrten · Subunternehmer</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4" />
            Neue Fahrt erfassen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} data-testid="input-trip-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fahrzeug</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger data-testid="select-vehicle"><SelectValue placeholder="Kennzeichen..." /></SelectTrigger>
                  <SelectContent>
                    {vehicles?.filter(v => v.isActive && v.type !== 'anhaenger').map((v) => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.licensePlate || v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kunde</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger data-testid="select-customer"><SelectValue placeholder="Kunde..." /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.customerNumber ? `${c.customerNumber} – ` : ''}{c.companyName || `${c.firstName} ${c.lastName}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Baustelle</Label>
                <Input value={constructionSite} onChange={(e) => setConstructionSite(e.target.value)} placeholder="Adresse..." data-testid="input-construction-site" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Auftragsart</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger data-testid="select-order-type"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {ORDER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-xs">Art.-Nr.</Label>
                <Select value={articleId} onValueChange={setArticleId}>
                  <SelectTrigger data-testid="select-article"><SelectValue placeholder="Artikel..." /></SelectTrigger>
                  <SelectContent>
                    {entsorgungArticles.length > 0 && (
                      <>
                        <SelectItem value="__header_entsorgung" disabled>── Entsorgung ──</SelectItem>
                        {entsorgungArticles.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>{a.articleNumber} – {a.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {serviceArticles.length > 0 && (
                      <>
                        <SelectItem value="__header_service" disabled>── Service ──</SelectItem>
                        {serviceArticles.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>{a.articleNumber} – {a.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {lieferungArticles.length > 0 && (
                      <>
                        <SelectItem value="__header_lieferung" disabled>── Lieferung ──</SelectItem>
                        {lieferungArticles.map(a => (
                          <SelectItem key={a.id} value={a.id.toString()}>{a.articleNumber} – {a.name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Container</Label>
                <Select value={containerSize} onValueChange={setContainerSize}>
                  <SelectTrigger data-testid="select-container-size"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 m³</SelectItem>
                    <SelectItem value="7">7 m³</SelectItem>
                    <SelectItem value="10">10 m³</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Menge</Label>
                <div className="flex gap-1">
                  <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" data-testid="input-quantity" />
                  <span className="flex items-center text-xs text-muted-foreground px-1 shrink-0">{selectedArticle?.unit || 't'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entfernung (km)</Label>
                <Input type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} data-testid="input-distance" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preis netto (€)</Label>
                <Input type="number" step="0.01" value={actualPrice} onChange={(e) => setActualPrice(e.target.value)} placeholder="z.B. 450" data-testid="input-price" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">&nbsp;</Label>
                <Button type="submit" disabled={isCreating} className="w-full" data-testid="button-add-trip">
                  <Plus className="w-4 h-4 mr-1" />Erfassen
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Fahrten ({periodLabel})</CardTitle>
            {(filterText || filterCategory !== "all" || filterCustomer !== "all" || filterVehicle !== "all" || filterOrderType !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterText(""); setFilterCategory("all"); setFilterCustomer("all"); setFilterVehicle("all"); setFilterOrderType("all"); }} data-testid="button-clear-filters">
                <X className="w-3 h-3 mr-1" />Filter zurücksetzen
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suche (Kunde, Baustelle, Kennzeichen, Artikel...)"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="pl-9 h-9"
                data-testid="input-filter-text"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[150px] h-9" data-testid="select-filter-category">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                <SelectItem value="container">Container</SelectItem>
                <SelectItem value="gestellung">Gestellung</SelectItem>
                <SelectItem value="transport">Transport</SelectItem>
                <SelectItem value="subi">Subi</SelectItem>
                <SelectItem value="other">Sonstige</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterVehicle} onValueChange={setFilterVehicle}>
              <SelectTrigger className="w-[160px] h-9" data-testid="select-filter-vehicle">
                <SelectValue placeholder="Kennzeichen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fahrzeuge</SelectItem>
                {uniqueVehicles.map(plate => (
                  <SelectItem key={plate} value={plate!}>{plate}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="w-[180px] h-9" data-testid="select-filter-customer">
                <SelectValue placeholder="Kunde" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kunden</SelectItem>
                {uniqueCustomers.map(name => (
                  <SelectItem key={name} value={name!}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterOrderType} onValueChange={setFilterOrderType}>
              <SelectTrigger className="w-[160px] h-9" data-testid="select-filter-ordertype">
                <SelectValue placeholder="Auftragsart" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Auftragsarten</SelectItem>
                {uniqueOrderTypes.map(ot => (
                  <SelectItem key={ot} value={ot!}>{ot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tripsInPeriod.length !== tripsInPeriodRaw.length && (
            <p className="text-xs text-muted-foreground mt-1">{tripsInPeriod.length} von {tripsInPeriodRaw.length} Fahrten angezeigt</p>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Laden...</p>
          ) : tripsInPeriod.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Keine Fahrten im gewählten Zeitraum</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap" data-testid="table-trips">
                <thead>
                  <tr className="border-b text-xs">
                    {([
                      ["tripDate", "Termin", false],
                      ["vehiclePlate", "Kennzeichen", false],
                      ["customerNumber", "Ku.-Nr.", false],
                      ["customerName", "Kundenname", false],
                      ["constructionSite", "Baustelle", false],
                      ["quantity", "Menge", true],
                      ["unit", "Einh.", false],
                      ["actualPrice", "Summe", true],
                      ["aTyp", "ATyp", false],
                      ["aArt", "AArt", false],
                      ["avvNumber", "AVVNr.", false],
                      ["articleNumber", "Art.-Nr.", false],
                      ["articleName", "Art.-Name", false],
                    ] as [SortField, string, boolean][]).map(([field, label, isRight]) => (
                      <th key={field} className={`${isRight ? 'text-right' : 'text-left'} px-2 py-2 font-medium cursor-pointer hover:bg-muted/50 select-none`} onClick={() => handleSort(field)} data-testid={`sort-${field}`}>
                        <span className={`inline-flex items-center gap-1 ${isRight ? 'justify-end' : ''}`}>
                          {label}
                          {sortField === field ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </span>
                      </th>
                    ))}
                    <th className="text-left px-2 py-2 font-medium border-l-2 border-primary/30 cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort("orderType")} data-testid="sort-orderType">
                      <span className="inline-flex items-center gap-1">
                        Kategorie
                        {sortField === "orderType" ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                      </span>
                    </th>
                    <th className="text-center px-2 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {tripsInPeriod.map((trip) => {
                    const material = materials?.find(m => m.id === trip.materialId);
                    const vehicle = vehicles?.find(v => v.id === trip.vehicleId);
                    const orderLabel = ORDER_TYPES.find(o => o.value.toLowerCase() === (trip.orderType || '').toLowerCase())?.label || trip.orderType;
                    const isSubi = trip.orderType === 'Subi';
                    return (
                      <tr key={trip.id} className={`border-b hover:bg-secondary/30 ${isSubi ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`} data-testid={`trip-row-${trip.id}`}>
                        <td className="px-2 py-1.5 text-xs font-medium">
                          {format(parseISO(trip.tripDate), "dd.MM.yy", { locale: de })}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{trip.vehiclePlate || (vehicle ? vehicle.licensePlate : '–')}</td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{trip.customerNumber || '–'}</td>
                        <td className="px-2 py-1.5 text-xs max-w-[120px] truncate">{trip.customerName || '–'}</td>
                        <td className="px-2 py-1.5 text-xs max-w-[120px] truncate text-muted-foreground">{trip.constructionSite || '–'}</td>
                        <td className="px-2 py-1.5 text-xs text-right">{trip.quantity ? Number(trip.quantity).toLocaleString('de-DE') : '–'}</td>
                        <td className="px-2 py-1.5 text-xs">{trip.unit || '–'}</td>
                        <td className="px-2 py-1.5 text-xs text-right font-medium">{formatCurrency(Number(trip.actualPrice))}</td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{trip.aTyp || '–'}</td>
                        <td className="px-2 py-1.5 text-xs max-w-[140px] truncate">{trip.aArt || '–'}</td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{trip.avvNumber || '–'}</td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{trip.articleNumber || '–'}</td>
                        <td className="px-2 py-1.5 text-xs max-w-[140px] truncate">{trip.articleName || (material ? material.name : '–')}</td>
                        <td className={`px-2 py-1.5 text-xs font-medium border-l-2 border-primary/30 ${isSubi ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                          {trip.orderType ? <Badge variant="outline" className={`text-[10px] py-0 ${isSubi ? 'border-orange-400 text-orange-600' : ''}`}>{orderLabel}</Badge> : '–'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex gap-0.5 justify-center">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(trip)} data-testid={`button-edit-trip-${trip.id}`}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteConfirm({ id: trip.id, date: format(parseISO(trip.tripDate), "dd.MM.yyyy", { locale: de }) })} data-testid={`button-delete-trip-${trip.id}`}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold text-xs">
                    <td className="p-2" colSpan={7}>GESAMT ({tripsInPeriod.length} Fahrten)</td>
                    <td className="p-2 text-right text-emerald-600">{formatCurrency(totalRevenue)}</td>
                    <td colSpan={7}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) { setImportDialogOpen(false); setImportPreview(null); setImportFile(null); setImportErrors([]); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] lg:max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importType === "csv" ? <FileSpreadsheet className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
              {importType === "csv" ? "CSV" : "PDF"} Import – Vorschau
            </DialogTitle>
            <DialogDescription>
              {importFile?.name ? `Datei: ${importFile.name}` : "Datei wird verarbeitet..."}
            </DialogDescription>
          </DialogHeader>
          {importLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">{importType === "pdf" ? "PDF wird analysiert (KI-Erkennung)..." : "CSV wird verarbeitet..."}</p>
            </div>
          )}
          {!importLoading && importPreview && importPreview.length > 0 && (
            <div className="space-y-4">
              {(() => {
                const dupCount = importPreview.filter((t: any) => t.isDuplicate).length;
                const newCount = importPreview.length - dupCount;
                return (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground"><strong>{importPreview.length}</strong> Fahrten erkannt.</p>
                    {dupCount > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex items-center gap-2" data-testid="text-duplicate-warning">
                        <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                          {dupCount} bereits importiert (werden übersprungen)
                        </span>
                        <span className="text-amber-500 dark:text-amber-500 text-xs">
                          · {newCount} neue Fahrten
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Termin</th>
                      <th className="px-2 py-2 text-left font-medium">Kennzeichen</th>
                      <th className="px-2 py-2 text-left font-medium">Ku.-Nr.</th>
                      <th className="px-2 py-2 text-left font-medium">Kundenname</th>
                      <th className="px-2 py-2 text-left font-medium">Baustelle</th>
                      <th className="px-2 py-2 text-right font-medium">Menge</th>
                      <th className="px-2 py-2 text-left font-medium">Einh.</th>
                      <th className="px-2 py-2 text-right font-medium">Summe</th>
                      <th className="px-2 py-2 text-left font-medium">ATyp</th>
                      <th className="px-2 py-2 text-left font-medium">AArt</th>
                      <th className="px-2 py-2 text-left font-medium">AVVNr.</th>
                      <th className="px-2 py-2 text-left font-medium">Art.-Nr.</th>
                      <th className="px-2 py-2 text-left font-medium">Art.-Name</th>
                      <th className="px-2 py-2 text-left font-medium border-l-2 border-primary/30">Kategorie</th>
                      <th className="px-2 py-2 text-left font-medium">Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((t: any, i: number) => (
                      <tr key={i} className={`border-t hover:bg-muted/30 ${t.isDuplicate ? 'opacity-40 line-through bg-muted/20' : ''} ${!t.isDuplicate && t.orderType === 'Subi' ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`} data-testid={`import-preview-row-${i}`}>
                        <td className="px-2 py-1.5">{t.tripDate}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{t.vehiclePlate || "–"}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{t.customerNumber || "–"}</td>
                        <td className="px-2 py-1.5 max-w-[120px] truncate">{t.customerName || "–"}</td>
                        <td className="px-2 py-1.5 max-w-[120px] truncate text-muted-foreground">{t.constructionSite || "–"}</td>
                        <td className="px-2 py-1.5 text-right">{t.quantity || t.containerSize}</td>
                        <td className="px-2 py-1.5">{t.unit || "–"}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{formatCurrency(Number(t.actualPrice))}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{t.aTyp || "–"}</td>
                        <td className="px-2 py-1.5 max-w-[140px] truncate">{t.aArt || "–"}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{t.avvNumber || "–"}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{t.articleNumber || "–"}</td>
                        <td className="px-2 py-1.5 max-w-[140px] truncate">{t.articleName || "–"}</td>
                        <td className={`px-2 py-1.5 font-medium border-l-2 border-primary/30 ${t.orderType === 'Subi' ? 'text-orange-600 dark:text-orange-400' : ''}`}>{t.orderType || "–"}</td>
                        <td className="px-2 py-1.5">{t.materialName || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importErrors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium text-destructive">Hinweise ({importErrors.length}):</p>
                  {importErrors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-xs text-destructive/80">{err}</p>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportPreview(null); setImportFile(null); }} data-testid="button-import-cancel">Abbrechen</Button>
                <Button onClick={handleImportConfirm} disabled={importLoading || importPreview.every((t: any) => t.isDuplicate)} data-testid="button-import-confirm">
                  {importLoading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importiere...</> : <><Upload className="w-4 h-4 mr-1" /> {importPreview.filter((t: any) => !t.isDuplicate).length} neue Fahrten importieren</>}
                </Button>
              </div>
            </div>
          )}
          {!importLoading && importPreview && importPreview.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Keine Fahrten in der Datei erkannt.</p>
              <Button variant="outline" className="mt-4" onClick={() => setImportDialogOpen(false)} data-testid="button-import-close">Schließen</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fahrt bearbeiten</DialogTitle>
            <DialogDescription>Alle Felder aktualisieren</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} data-testid="input-edit-trip-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fahrzeug</Label>
                <Select value={editVehicleId} onValueChange={setEditVehicleId}>
                  <SelectTrigger data-testid="select-edit-vehicle"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>
                    {vehicles?.filter(v => v.isActive && v.type !== 'anhaenger').map((v) => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.licensePlate || v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kunde</Label>
              <Select value={editCustomerId} onValueChange={setEditCustomerId}>
                <SelectTrigger data-testid="select-edit-customer"><SelectValue placeholder="Kunde..." /></SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.customerNumber ? `${c.customerNumber} – ` : ''}{c.companyName || `${c.firstName} ${c.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Baustelle</Label>
              <Input value={editConstructionSite} onChange={(e) => setEditConstructionSite(e.target.value)} data-testid="input-edit-construction-site" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Auftragsart</Label>
                <Select value={editOrderType} onValueChange={setEditOrderType}>
                  <SelectTrigger data-testid="select-edit-order-type"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>
                    {ORDER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Art.-Nr.</Label>
                <Select value={editArticleId} onValueChange={setEditArticleId}>
                  <SelectTrigger data-testid="select-edit-article"><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>
                    {activeArticles.map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.articleNumber} – {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Container</Label>
                <Select value={editContainerSize} onValueChange={setEditContainerSize}>
                  <SelectTrigger data-testid="select-edit-container-size"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 m³</SelectItem>
                    <SelectItem value="7">7 m³</SelectItem>
                    <SelectItem value="10">10 m³</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Menge</Label>
                <div className="flex gap-1">
                  <Input type="number" step="0.01" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} data-testid="input-edit-quantity" />
                  <span className="flex items-center text-xs text-muted-foreground px-1 shrink-0">{selectedEditArticle?.unit || 't'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">km</Label>
                <Input type="number" value={editDistanceKm} onChange={(e) => setEditDistanceKm(e.target.value)} data-testid="input-edit-distance" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preis netto (€)</Label>
              <Input type="number" step="0.01" value={editActualPrice} onChange={(e) => setEditActualPrice(e.target.value)} data-testid="input-edit-price" />
            </div>
            <Button onClick={handleEditSave} className="w-full" data-testid="button-save-edit-trip">Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fahrt löschen</AlertDialogTitle>
            <AlertDialogDescription>Möchten Sie die Fahrt vom {deleteConfirm?.date} wirklich löschen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-trip">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fahrten löschen</DialogTitle>
            <DialogDescription>Wählen Sie aus, welche Fahrten gelöscht werden sollen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={deleteMode === "period" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setDeleteMode("period")}
                data-testid="button-delete-mode-period"
              >
                Aktueller Zeitraum
              </Button>
              <Button
                variant={deleteMode === "all" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setDeleteMode("all")}
                data-testid="button-delete-mode-all"
              >
                Alle Fahrten
              </Button>
            </div>

            {deleteMode === "period" && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">Zeitraum: {periodLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {format(periodStart, "dd.MM.yyyy", { locale: de })} – {format(periodEnd, "dd.MM.yyyy", { locale: de })}
                </p>
                <p className="text-sm mt-2">
                  <span className="font-bold text-destructive">{tripsInPeriodRaw.length}</span> Fahrten werden gelöscht
                </p>
              </div>
            )}

            {deleteMode === "all" && (
              <div className="bg-destructive/10 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-destructive">Alle Fahrten löschen</p>
                <p className="text-sm">
                  <span className="font-bold text-destructive">{trips?.length || 0}</span> Fahrten werden unwiderruflich gelöscht
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteLoading || (deleteMode === "period" && tripsInPeriodRaw.length === 0)}
                data-testid="button-confirm-delete"
                onClick={async () => {
                  setDeleteLoading(true);
                  try {
                    const params = deleteMode === "period"
                      ? `?from=${format(periodStart, "yyyy-MM-dd")}&to=${format(periodEnd, "yyyy-MM-dd")}`
                      : '';
                    const res = await apiRequest('DELETE', `/api/trips${params}`);
                    const data = await res.json();
                    toast({ title: "Gelöscht", description: data.message });
                    queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
                    setDeleteDialogOpen(false);
                  } catch (err: any) {
                    toast({ title: "Fehler", description: err.message || "Löschen fehlgeschlagen", variant: "destructive" });
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
              >
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                {deleteMode === "period" ? `${tripsInPeriodRaw.length} Fahrten löschen` : 'Alle löschen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
