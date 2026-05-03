import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TrendingUp, Download, Mail, Save, Trash2, FolderOpen,
  BarChart3, Settings2, ArrowUpRight, ArrowDownRight,
  Loader2, RefreshCw, Calendar, Truck, Package, Users,
  Target, Percent, Euro, FileText, CheckCircle2, AlertTriangle,
  XCircle, HelpCircle, Zap, Check, Info
} from "lucide-react";
import { downloadPdf } from "@/lib/pdf-export";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, ComposedChart
} from "recharts";
import type { ForecastParams } from "@shared/schema";

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTH_NAMES_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function fmtEur(v: number, decimals = 0) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function CurrencyInput({ value, onChange, ...props }: { value: number; onChange: (val: number) => void; [key: string]: any }) {
  const [focused, setFocused] = useState(false);
  const [editValue, setEditValue] = useState("");
  const formatted = value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  return (
    <Input
      {...props}
      type={focused ? "text" : "text"}
      inputMode="decimal"
      value={focused ? editValue : formatted}
      onFocus={() => {
        setFocused(true);
        setEditValue(String(value).replace('.', ','));
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseFloat(editValue.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsed)) onChange(Math.round(parsed * 100) / 100);
      }}
      onChange={e => {
        if (focused) setEditValue(e.target.value);
      }}
    />
  );
}

export default function ForecastCenter() {
  const { toast } = useToast();
  const [params, setParams] = useState<ForecastParams | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [scenarioName, setScenarionName] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [planScenario, setPlanScenario] = useState<'A' | 'B'>('A');
  const [priceOptData, setPriceOptData] = useState<any>(null);
  const [selectedPrices, setSelectedPrices] = useState<Set<string>>(new Set());
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [priceStrategy, setPriceStrategy] = useState<'market' | 'market_minus' | 'list' | 'cost_plus'>('market');
  const [strategyValue, setStrategyValue] = useState(5);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [priceListCustomer, setPriceListCustomer] = useState('');
  const [priceListDiscount, setPriceListDiscount] = useState(0);
  const [priceListEmail, setPriceListEmail] = useState('');
  const [sendingPriceList, setSendingPriceList] = useState(false);
  const [priceOptDistance, setPriceOptDistance] = useState(15);

  const { data: customers } = useQuery<any[]>({
    queryKey: ['/api/customers'],
  });

  const { data: defaults, isLoading: loadingDefaults } = useQuery<ForecastParams>({
    queryKey: ['/api/forecast/defaults'],
  });

  const { data: scenarios, isLoading: loadingScenarios } = useQuery<any[]>({
    queryKey: ['/api/forecast/scenarios'],
  });

  useEffect(() => {
    if (defaults && !params) {
      setParams(defaults);
    }
  }, [defaults]);

  const calculateMutation = useMutation({
    mutationFn: async (p: Partial<ForecastParams>) => {
      const res = await apiRequest('POST', '/api/forecast/calculate', p);
      return res.json();
    },
    onSuccess: (data) => setReportData(data),
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const pdfMutation = useMutation({
    mutationFn: async (p: Partial<ForecastParams>) => {
      await downloadPdf('/api/forecast/pdf', `Jahresplanung_${reportData?.year || 2026}.pdf`, p);
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message || "PDF-Export fehlgeschlagen", variant: "destructive" }),
  });

  const csvMutation = useMutation({
    mutationFn: async (p: Partial<ForecastParams>) => {
      const res = await fetch('/api/forecast/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('CSV export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Jahresplanung_${p.year || 2026}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast({ title: "Fehler", description: "CSV-Export fehlgeschlagen", variant: "destructive" }),
  });

  const emailMutation = useMutation({
    mutationFn: async ({ email, params: p }: { email: string; params: Partial<ForecastParams> }) => {
      const res = await apiRequest('POST', '/api/forecast/email', { email, params: p });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Versendet", description: "Prognose per E-Mail versendet" });
      setShowEmailDialog(false);
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ name, params: p }: { name: string; params: ForecastParams }) => {
      const res = await apiRequest('POST', '/api/forecast/scenarios', { name, params: p });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Gespeichert", description: "Szenario wurde gespeichert" });
      queryClient.invalidateQueries({ queryKey: ['/api/forecast/scenarios'] });
      setShowSaveDialog(false);
      setScenarionName('');
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/forecast/scenarios/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Gelöscht", description: "Szenario wurde gelöscht" });
      queryClient.invalidateQueries({ queryKey: ['/api/forecast/scenarios'] });
    },
  });

  const activatePlanMutation = useMutation({
    mutationFn: async ({ scenario }: { scenario: 'A' | 'B' }) => {
      if (!reportData) throw new Error("Keine Prognose-Daten");
      const months = scenario === 'A' ? reportData.scenarioA : reportData.scenarioB;
      const monthlyData = months.map((m: any) => ({
        month: m.month,
        monthName: m.monthName,
        totalTrips: m.totalTrips,
        ownContainersTotal: m.ownContainersTotal,
        subiTripsTotal: m.subiTripsTotal,
        totalRevenue: m.totalRevenue,
        fixedCosts: m.fixedCosts,
        totalVariableCosts: m.totalVariableCosts,
        monthlyProfit: m.monthlyProfit,
        effectiveWorkDays: m.effectiveWorkDays,
        actualContainersPerDay: m.actualContainersPerDay,
        driverCount: m.driverCount,
      }));
      const res = await apiRequest('POST', '/api/plans/activate', {
        name: `Prognose ${reportData.year} – Szenario ${scenario}`,
        scenario,
        year: reportData.year,
        monthlyData,
        params,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Plan aktiviert", description: `Szenario ${planScenario} wurde als aktiver Plan übernommen` });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/active'] });
      setShowPlanDialog(false);
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const priceOptMutation = useMutation({
    mutationFn: async (dist: number) => {
      const res = await apiRequest('POST', '/api/forecast/price-optimization', { distance: dist });
      return res.json();
    },
    onSuccess: (data) => {
      setPriceOptData(data);
      setSelectedPrices(new Set());
      const initial: Record<string, number> = {};
      for (const r of data.recommendations) {
        const key = `${r.materialId}-${r.containerSize}`;
        if (r.currentListPrice !== null) {
          initial[key] = r.currentListPrice;
        } else if (r.marketPriceNet !== null) {
          initial[key] = r.marketPriceNet;
        } else {
          initial[key] = r.optimalPrice;
        }
      }
      setCustomPrices(initial);
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const [applyWarning, setApplyWarning] = useState<{ warnings: string[]; pendingSelections: any[] } | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const applyPricesWithCheck = async (selections: { materialId: number; containerSize: number; targetPrice: number }[], confirm: boolean = false) => {
    setIsApplying(true);
    try {
      const res = await fetch('/api/forecast/apply-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ selections, distance: priceOptDistance, confirmLargeChange: confirm }),
      });
      const json = await res.json();

      if (res.status === 409 && json.requireConfirmation) {
        setApplyWarning({ warnings: json.warnings, pendingSelections: selections });
        return;
      }

      if (!res.ok) {
        toast({ title: "Fehler", description: json.message, variant: "destructive" });
        return;
      }

      toast({ title: "Preise aktualisiert", description: json.message });
      setSelectedPrices(new Set());
      setApplyWarning(null);
      priceOptMutation.mutate(priceOptDistance);
    } catch {
      toast({ title: "Fehler", variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  const applyPricesMutation = { isPending: isApplying, mutate: (s: any[]) => applyPricesWithCheck(s) };

  const applyStrategy = useCallback((strategy: typeof priceStrategy, value: number) => {
    if (!priceOptData) return;
    const newPrices: Record<string, number> = {};
    for (const r of priceOptData.recommendations) {
      const key = `${r.materialId}-${r.containerSize}`;
      switch (strategy) {
        case 'market':
          newPrices[key] = r.marketPriceNet !== null ? r.marketPriceNet : (r.currentListPrice ?? r.optimalPrice);
          break;
        case 'market_minus':
          newPrices[key] = r.marketPriceNet !== null ? Math.round(r.marketPriceNet * (1 - value / 100) * 100) / 100 : (r.currentListPrice ?? r.optimalPrice);
          break;
        case 'list':
          newPrices[key] = r.currentListPrice ?? r.optimalPrice;
          break;
        case 'cost_plus':
          newPrices[key] = Math.round((r.baseCost + value) * 100) / 100;
          break;
      }
    }
    setCustomPrices(newPrices);
    const allKeys = new Set(priceOptData.recommendations.map((r: any) => `${r.materialId}-${r.containerSize}`));
    setSelectedPrices(allKeys);
  }, [priceOptData]);

  const getTargetStatus = useCallback((r: any, targetPrice: number) => {
    if (targetPrice < r.baseCost) return 'under_cost';
    if (r.marketPriceNet === null) return 'no_market';
    if (targetPrice <= r.marketPriceNet * 0.95) return 'below_market';
    if (targetPrice <= r.marketPriceNet * 1.05) return 'at_market';
    return 'above_market';
  }, []);

  const handleCalculate = useCallback(() => {
    if (params) calculateMutation.mutate(params);
  }, [params]);

  const updateParam = <K extends keyof ForecastParams>(key: K, value: ForecastParams[K]) => {
    setParams(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const updateArrayParam = (key: 'growthFactors' | 'subiShare' | 'seasonalFactors', index: number, value: number) => {
    setParams(prev => {
      if (!prev) return prev;
      const arr = [...prev[key]];
      arr[index] = value;
      return { ...prev, [key]: arr };
    });
  };

  const loadScenario = (scenario: any) => {
    setParams(scenario.params as ForecastParams);
    setShowLoadDialog(false);
    toast({ title: "Geladen", description: `Szenario "${scenario.name}" geladen` });
  };

  const resetToDefaults = () => {
    if (defaults) {
      setParams(defaults);
      setReportData(null);
      toast({ title: "Zurückgesetzt", description: "Standard-Parameter wiederhergestellt" });
    }
  };

  if (loadingDefaults || !params) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const chartData = reportData ? reportData.scenarioA.map((m: any, i: number) => ({
    month: MONTH_NAMES[i],
    profitA: Math.round(m.monthlyProfit),
    profitB: Math.round(reportData.scenarioB[i].monthlyProfit),
    revenueA: Math.round(m.totalRevenue),
    revenueB: Math.round(reportData.scenarioB[i].totalRevenue),
    ownA: m.ownContainersTotal,
    subiA: m.subiTripsTotal,
    ownB: reportData.scenarioB[i].ownContainersTotal,
    subiB: reportData.scenarioB[i].subiTripsTotal,
    marginList: m.marginPercentAtListPrice || 0,
    marginMarket: m.marginPercentAtMarketPrice || 0,
  })) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-forecast-title">
            <Target className="h-7 w-7 text-primary" />
            Prognose-Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Konfigurierbare Jahresplanung mit Szenarien-Vergleich
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={resetToDefaults} data-testid="button-reset-defaults">
            <RefreshCw className="h-4 w-4 mr-1" /> Zurücksetzen
          </Button>
          <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-load-scenario">
                <FolderOpen className="h-4 w-4 mr-1" /> Laden
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Szenario laden</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {loadingScenarios ? (
                  <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : scenarios && scenarios.length > 0 ? (
                  scenarios.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg" data-testid={`scenario-item-${s.id}`}>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(s.createdAt).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" onClick={() => loadScenario(s)} data-testid={`button-load-${s.id}`}>
                          Laden
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-${s.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center p-4">Keine gespeicherten Szenarien</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-save-scenario">
                <Save className="h-4 w-4 mr-1" /> Speichern
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Szenario speichern</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={scenarioName}
                    onChange={e => setScenarionName(e.target.value)}
                    placeholder="z.B. Optimistisches Wachstum"
                    data-testid="input-scenario-name"
                  />
                </div>
                <Button
                  onClick={() => saveMutation.mutate({ name: scenarioName, params })}
                  disabled={!scenarioName || saveMutation.isPending}
                  className="w-full"
                  data-testid="button-confirm-save"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Szenario speichern
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="params">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="params" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-params">
            <Settings2 className="h-4 w-4 mr-1 hidden sm:inline-block shrink-0" /> Parameter
          </TabsTrigger>
          <TabsTrigger value="results" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-3" disabled={!reportData} data-testid="tab-results">
            <BarChart3 className="h-4 w-4 mr-1 hidden sm:inline-block shrink-0" /> Ergebnisse
          </TabsTrigger>
          <TabsTrigger value="curves" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-curves">
            <TrendingUp className="h-4 w-4 mr-1 hidden sm:inline-block shrink-0" /> Kurven
          </TabsTrigger>
          <TabsTrigger value="priceopt" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-priceopt">
            <Zap className="h-4 w-4 mr-1 hidden sm:inline-block shrink-0" /> Preise
          </TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Allgemein
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Planjahr</Label>
                    <Select value={String(params.year)} onValueChange={v => updateParam('year', Number(v))}>
                      <SelectTrigger data-testid="select-year"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Entfernung (km)</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[params.distance]}
                        onValueChange={([v]) => updateParam('distance', v)}
                        min={5} max={100} step={1}
                        data-testid="slider-distance"
                      />
                      <Badge variant="secondary" className="min-w-[3rem] justify-center">{params.distance}</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Max. Container/Tag/Fahrer</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[params.maxContainersPerDayPerDriver]}
                      onValueChange={([v]) => updateParam('maxContainersPerDayPerDriver', v)}
                      min={3} max={12} step={1}
                      data-testid="slider-max-containers"
                    />
                    <Badge variant="secondary" className="min-w-[3rem] justify-center">{params.maxContainersPerDayPerDriver}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Urlaubstage/Fahrer</Label>
                    <Input
                      type="number"
                      value={params.vacationDaysPerDriver}
                      onChange={e => updateParam('vacationDaysPerDriver', Number(e.target.value))}
                      data-testid="input-vacation-days"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Krankheitstage/Fahrer</Label>
                    <Input
                      type="number"
                      value={params.sickDaysPerDriver}
                      onChange={e => updateParam('sickDaysPerDriver', Number(e.target.value))}
                      data-testid="input-sick-days"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" /> Container
                </CardTitle>
                <p className="text-xs text-muted-foreground">Daten aus Ressourcen</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">7m³ Anzahl</Label>
                    <Input
                      type="number"
                      value={params.containers7Count ?? 0}
                      onChange={e => {
                        const c7 = Number(e.target.value);
                        const c10 = params.containers10Count ?? 0;
                        const total = c7 + c10;
                        const avgPrice = total > 0 ? Math.round((c7 * (params.containers7Price ?? 0) + c10 * (params.containers10Price ?? 0)) / total) : params.containerPricePerUnit;
                        setParams(prev => prev ? { ...prev, containers7Count: c7, initialContainerStock: total, containerPricePerUnit: avgPrice } : prev);
                      }}
                      data-testid="input-containers-7-count"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">7m³ Preis/Stk.</Label>
                    <CurrencyInput
                      value={params.containers7Price ?? 0}
                      onChange={p7 => {
                        const c7 = params.containers7Count ?? 0;
                        const c10 = params.containers10Count ?? 0;
                        const total = c7 + c10;
                        const avgPrice = total > 0 ? Math.round((c7 * p7 + c10 * (params.containers10Price ?? 0)) / total) : params.containerPricePerUnit;
                        setParams(prev => prev ? { ...prev, containers7Price: p7, containerPricePerUnit: avgPrice } : prev);
                      }}
                      data-testid="input-containers-7-price"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">10m³ Anzahl</Label>
                    <Input
                      type="number"
                      value={params.containers10Count ?? 0}
                      onChange={e => {
                        const c10 = Number(e.target.value);
                        const c7 = params.containers7Count ?? 0;
                        const total = c7 + c10;
                        const avgPrice = total > 0 ? Math.round((c7 * (params.containers7Price ?? 0) + c10 * (params.containers10Price ?? 0)) / total) : params.containerPricePerUnit;
                        setParams(prev => prev ? { ...prev, containers10Count: c10, initialContainerStock: total, containerPricePerUnit: avgPrice } : prev);
                      }}
                      data-testid="input-containers-10-count"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">10m³ Preis/Stk.</Label>
                    <CurrencyInput
                      value={params.containers10Price ?? 0}
                      onChange={p10 => {
                        const c7 = params.containers7Count ?? 0;
                        const c10 = params.containers10Count ?? 0;
                        const total = c7 + c10;
                        const avgPrice = total > 0 ? Math.round((c7 * (params.containers7Price ?? 0) + c10 * p10) / total) : params.containerPricePerUnit;
                        setParams(prev => prev ? { ...prev, containers10Price: p10, containerPricePerUnit: avgPrice } : prev);
                      }}
                      data-testid="input-containers-10-price"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Gesamt: <strong className="text-foreground">{params.initialContainerStock} Container</strong></span>
                  <span>Ø-Preis: <strong className="text-foreground">{fmtEur(params.containerPricePerUnit)}</strong></span>
                </div>
                <div>
                  <Label className="text-xs">Ø Containerstandzeit (Tage beim Kunden)</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[params.containerTurnaroundDays]}
                      onValueChange={([v]) => updateParam('containerTurnaroundDays', v)}
                      min={3} max={21} step={1}
                      data-testid="slider-turnaround"
                    />
                    <Badge variant="secondary" className="min-w-[3rem] justify-center">{params.containerTurnaroundDays} T</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Wie lange ist ein Container im Schnitt weg? Je länger, desto mehr Container werden benötigt.</p>
                </div>
                <div>
                  <Label className="text-xs">Auslastungsschwelle</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[params.containerUtilizationThreshold * 100]}
                      onValueChange={([v]) => updateParam('containerUtilizationThreshold', v / 100)}
                      min={50} max={100} step={5}
                      data-testid="slider-utilization"
                    />
                    <Badge variant="secondary" className="min-w-[3rem] justify-center">{Math.round(params.containerUtilizationThreshold * 100)}%</Badge>
                  </div>
                </div>
                <Separator />
                {(() => {
                  const stock = params.initialContainerStock;
                  const turnaround = params.containerTurnaroundDays;
                  const maxPerDay = params.maxContainersPerDayPerDriver;
                  const avgSeason = params.seasonalFactors.reduce((a, b) => a + b, 0) / 12;
                  const avgGrowth = params.growthFactors.reduce((a, b) => a + b, 0) / 12;
                  const avgSubiShare = params.subiShare.reduce((a, b) => a + b, 0) / 12;
                  const avgWorkDaysRaw = 22;
                  const avgVac = (params.vacationDaysPerDriver || 30) / 12;
                  const avgSick = (params.sickDaysPerDriver || 10) / 12;
                  const effectiveWorkDays = Math.max(avgWorkDaysRaw - avgVac - avgSick, 1);

                  const demandPerDay = maxPerDay * avgGrowth * avgSeason;
                  const demandMonth = Math.round(demandPerDay * effectiveWorkDays);
                  const ownTrips = Math.round(demandMonth * (1 - avgSubiShare));
                  const subiTrips = demandMonth - ownTrips;

                  const containersNeeded = Math.ceil(demandPerDay * turnaround);
                  const needsPurchase = containersNeeded > stock;
                  const deficit = needsPurchase ? containersNeeded - stock : 0;
                  const purchaseRounded = deficit > 0 ? Math.ceil(deficit / 10) * 10 : 0;
                  const purchaseCost = purchaseRounded * (params.containers7Price || 1285);
                  const avgPrice = (params.containers7Price && params.containers10Price)
                    ? ((params.containers7Price * (params.containers7Count || 15)) + (params.containers10Price * (params.containers10Count || 15))) / stock
                    : 1492;

                  return (
                    <div className="space-y-2" data-testid="container-capacity-info">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-secondary/60 rounded-lg p-2 text-center">
                          <div className="text-muted-foreground">Ø Fahrten/Tag</div>
                          <div className="text-lg font-bold text-foreground">{demandPerDay.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</div>
                        </div>
                        <div className="bg-secondary/60 rounded-lg p-2 text-center">
                          <div className="text-muted-foreground">Container nötig</div>
                          <div className="text-lg font-bold text-foreground">{containersNeeded}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground px-1">
                        Ø Bedarf: <strong className="text-foreground">{demandMonth} Fahrten/Monat</strong> (davon {ownTrips} eigene, {subiTrips} Subi)
                      </div>
                      <div className="text-xs text-muted-foreground px-1 bg-secondary/40 rounded p-2">
                        Rechnung: {demandPerDay.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Cnt/Tag × {turnaround} Tage Standzeit = <strong className="text-foreground">{containersNeeded} Container</strong> im Umlauf nötig
                      </div>
                      {needsPurchase ? (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs" data-testid="container-limit-warning">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400 mb-1">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            Nachkauf erforderlich
                          </div>
                          <p className="text-amber-600 dark:text-amber-500">
                            Bestand: <strong>{stock}</strong> Container. Benötigt: <strong>{containersNeeded}</strong> Container.
                          </p>
                          <p className="text-amber-700 dark:text-amber-400 font-medium mt-1">
                            Nachkauf: {purchaseRounded} Container (ca. {(purchaseRounded * avgPrice).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })})
                          </p>
                          <p className="text-amber-600/80 dark:text-amber-500/80 mt-1">
                            Die Prognose kauft diese automatisch nach — Umsatz bleibt unbeeinflusst.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-xs" data-testid="container-capacity-ok">
                          <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                            <Package className="h-3.5 w-3.5" />
                            Bestand ausreichend
                          </div>
                          <p className="text-emerald-600 dark:text-emerald-500 mt-1">
                            Bestand: {stock} Container. Benötigt: {containersNeeded}. Reserve: {stock - containersNeeded} Container.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Expansion (2. Fahrer)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Daten aus Ressourcen (Mitarbeiter & Fahrzeuge)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Startmonat</Label>
                    <Select value={String(params.expansionStartMonth)} onValueChange={v => updateParam('expansionStartMonth', Number(v))}>
                      <SelectTrigger data-testid="select-expansion-month"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES_FULL.map((n, i) => (
                          <SelectItem key={i} value={String(i)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Startjahr</Label>
                    <Select value={String(params.expansionStartYear ?? params.year)} onValueChange={v => updateParam('expansionStartYear', Number(v))}>
                      <SelectTrigger data-testid="select-expansion-year"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{params.driver2Name || 'Fahrer 2'}</span>
                    <Badge variant="outline" className="text-xs" data-testid="badge-driver2-total">
                      {fmtEur(params.driver2MonthlySalary + params.driver2MonthlySpesen)}/Mon
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Gehalt</Label>
                      <CurrencyInput
                        value={params.driver2MonthlySalary}
                        onChange={v => updateParam('driver2MonthlySalary', v)}
                        data-testid="input-driver2-salary"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Zulagen/Spesen</Label>
                      <CurrencyInput
                        value={params.driver2MonthlySpesen}
                        onChange={v => updateParam('driver2MonthlySpesen', v)}
                        data-testid="input-driver2-spesen"
                      />
                    </div>
                  </div>
                </div>
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{params.newVehicleName || 'Neues Fahrzeug'}</span>
                    <Badge variant="outline" className="text-xs" data-testid="badge-vehicle-total">
                      {fmtEur(params.newVehicleMonthlyLease + params.newVehicleMonthlyInsurance + params.newVehicleMonthlyMaintenance + (params.newVehicleMonthlyDepreciation || 0))}/Mon
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Leasing</Label>
                      <CurrencyInput
                        value={params.newVehicleMonthlyLease}
                        onChange={v => updateParam('newVehicleMonthlyLease', v)}
                        data-testid="input-vehicle-lease"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Versicherung</Label>
                      <CurrencyInput
                        value={params.newVehicleMonthlyInsurance}
                        onChange={v => updateParam('newVehicleMonthlyInsurance', v)}
                        data-testid="input-vehicle-insurance"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Wartung</Label>
                      <CurrencyInput
                        value={params.newVehicleMonthlyMaintenance}
                        onChange={v => updateParam('newVehicleMonthlyMaintenance', v)}
                        data-testid="input-vehicle-maintenance"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">AfA/Monat</Label>
                      <CurrencyInput
                        value={params.newVehicleMonthlyDepreciation ?? 0}
                        onChange={v => updateParam('newVehicleMonthlyDepreciation', v)}
                        data-testid="input-vehicle-depreciation"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Expansion gesamt: <strong className="text-foreground">{fmtEur(params.driver2MonthlySalary + params.driver2MonthlySpesen + params.newVehicleMonthlyLease + params.newVehicleMonthlyInsurance + params.newVehicleMonthlyMaintenance + (params.newVehicleMonthlyDepreciation || 0))}/Mon</strong></span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="h-4 w-4" /> Subi-Unternehmer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Erlös pro Subi-Fahrt (netto)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={params.subiRevenuePerTrip}
                      onChange={e => updateParam('subiRevenuePerTrip', parseFloat(e.target.value) || 0)}
                      className="w-32"
                      min={0}
                      max={500}
                      step={5}
                      data-testid="input-subi-revenue"
                    />
                    <span className="text-xs text-muted-foreground">€ netto</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Pauschaler Netto-Erlös pro Subi-Fahrt, unabhängig vom Material</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 justify-center pt-2">
            <Button
              size="lg"
              onClick={handleCalculate}
              disabled={calculateMutation.isPending}
              className="min-w-[200px]"
              data-testid="button-calculate"
            >
              {calculateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4 mr-2" />
              )}
              Prognose berechnen
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="curves" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Wachstumskurve (% Kapazität)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {params.growthFactors.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs w-8 text-muted-foreground">{MONTH_NAMES[i]}</span>
                      <Slider
                        value={[v * 100]}
                        onValueChange={([val]) => updateArrayParam('growthFactors', i, val / 100)}
                        min={10} max={100} step={1}
                        className="flex-1"
                        data-testid={`slider-growth-${i}`}
                      />
                      <Badge variant="outline" className="min-w-[3rem] justify-center text-xs">{fmtPct(v * 100)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Subi-Anteil (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {params.subiShare.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs w-8 text-muted-foreground">{MONTH_NAMES[i]}</span>
                      <Slider
                        value={[v * 100]}
                        onValueChange={([val]) => updateArrayParam('subiShare', i, val / 100)}
                        min={0} max={80} step={1}
                        className="flex-1"
                        data-testid={`slider-subi-${i}`}
                      />
                      <Badge variant="outline" className="min-w-[3rem] justify-center text-xs">{fmtPct(v * 100)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saisonfaktoren</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {params.seasonalFactors.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs w-8 text-muted-foreground">{MONTH_NAMES[i]}</span>
                      <Slider
                        value={[v * 100]}
                        onValueChange={([val]) => updateArrayParam('seasonalFactors', i, val / 100)}
                        min={20} max={130} step={5}
                        className="flex-1"
                        data-testid={`slider-season-${i}`}
                      />
                      <Badge variant="outline" className="min-w-[3rem] justify-center text-xs">{(v).toFixed(2)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4 mt-4">
          {reportData ? (
            <>
              <div className="flex gap-2 justify-end flex-wrap">
                <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary" data-testid="button-activate-plan">
                      <Target className="h-4 w-4 mr-1" /> Als Plan übernehmen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Prognose als aktiven Plan übernehmen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Wähle welches Szenario als offizieller Plan für die Planungsseite gelten soll. Der aktive Plan bestimmt die "Geplant"-Werte für den Ist/Soll-Vergleich.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          className={`p-4 rounded-lg border-2 text-left transition-colors ${planScenario === 'A' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-border hover:border-muted-foreground'}`}
                          onClick={() => setPlanScenario('A')}
                          data-testid="button-plan-scenario-a"
                        >
                          <p className="font-semibold text-blue-600">Szenario A</p>
                          <p className="text-xs text-muted-foreground">1 Fahrer</p>
                          {reportData && (
                            <p className="text-sm font-mono mt-1">{fmtEur(reportData.scenarioATotalProfit)}</p>
                          )}
                        </button>
                        <button
                          className={`p-4 rounded-lg border-2 text-left transition-colors ${planScenario === 'B' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : 'border-border hover:border-muted-foreground'}`}
                          onClick={() => setPlanScenario('B')}
                          data-testid="button-plan-scenario-b"
                        >
                          <p className="font-semibold text-orange-600">Szenario B</p>
                          <p className="text-xs text-muted-foreground">2 Fahrer</p>
                          {reportData && (
                            <p className="text-sm font-mono mt-1">{fmtEur(reportData.scenarioBTotalProfit)}</p>
                          )}
                        </button>
                      </div>
                      <Button
                        onClick={() => activatePlanMutation.mutate({ scenario: planScenario })}
                        disabled={activatePlanMutation.isPending}
                        className="w-full"
                        data-testid="button-confirm-plan"
                      >
                        {activatePlanMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        Szenario {planScenario} als Plan aktivieren
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" onClick={() => pdfMutation.mutate(params)} disabled={pdfMutation.isPending} data-testid="button-pdf-export">
                  <FileText className="h-4 w-4 mr-1" />
                  {pdfMutation.isPending ? 'Exportiere...' : 'PDF Export'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => csvMutation.mutate(params)} disabled={csvMutation.isPending} data-testid="button-csv-export">
                  <Download className="h-4 w-4 mr-1" />
                  {csvMutation.isPending ? 'Exportiere...' : 'CSV Export'}
                </Button>
                <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-email-send">
                      <Mail className="h-4 w-4 mr-1" /> Per E-Mail
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Prognose per E-Mail senden</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>E-Mail-Adresse</Label>
                        <Input
                          type="email"
                          value={emailAddress}
                          onChange={e => setEmailAddress(e.target.value)}
                          placeholder="name@firma.de"
                          data-testid="input-email"
                        />
                      </div>
                      <Button
                        onClick={() => emailMutation.mutate({ email: emailAddress, params })}
                        disabled={!emailAddress || emailMutation.isPending}
                        className="w-full"
                        data-testid="button-confirm-email"
                      >
                        {emailMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                        Senden
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(() => {
                  const revenueA = reportData.scenarioATotalRevenue;
                  const revenueB = reportData.scenarioBTotalRevenue;
                  const profitA = reportData.scenarioATotalProfit;
                  const profitB = reportData.scenarioBTotalProfit;
                  const rentA = revenueA > 0 ? (profitA / revenueA) * 100 : 0;
                  const rentB = revenueB > 0 ? (profitB / revenueB) * 100 : 0;
                  const revDiff = revenueB - revenueA;

                  return (
                    <>
                      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <CardContent className="pt-4 pb-3 text-center">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Szenario A Gewinn</p>
                          <p className="text-xl font-bold text-blue-700 dark:text-blue-300" data-testid="text-profit-a">{fmtEur(profitA)}</p>
                          <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1" data-testid="text-revenue-a">
                            Umsatz: {fmtEur(revenueA)} · Rentabilität: {rentA.toFixed(1).replace('.', ',')}%
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                        <CardContent className="pt-4 pb-3 text-center">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Szenario B Gewinn</p>
                          <p className="text-xl font-bold text-amber-700 dark:text-amber-300" data-testid="text-profit-b">{fmtEur(profitB)}</p>
                          <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-1" data-testid="text-revenue-b">
                            Umsatz: {fmtEur(revenueB)} · Rentabilität: {rentB.toFixed(1).replace('.', ',')}%
                          </p>
                        </CardContent>
                      </Card>
                      <Card className={`${reportData.breakEven.profitDifference > 0 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                        <CardContent className="pt-4 pb-3 text-center">
                          <p className="text-xs font-medium text-muted-foreground">Differenz</p>
                          <div className="flex items-center justify-center gap-1">
                            {reportData.breakEven.profitDifference > 0 ? (
                              <ArrowUpRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-600" />
                            )}
                            <p className={`text-xl font-bold ${reportData.breakEven.profitDifference > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`} data-testid="text-profit-diff">
                              {fmtEur(reportData.breakEven.profitDifference)}
                            </p>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1" data-testid="text-revenue-diff">
                            Umsatz B−A: {fmtEur(revDiff)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 pb-3 text-center">
                          <p className="text-xs font-medium text-muted-foreground">Break-Even</p>
                          <p className="text-xl font-bold" data-testid="text-breakeven">
                            {reportData.breakEven.breakEvenMonthName || 'Nicht erreicht'}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {reportData.breakEven.monthsToBreakEven
                              ? `nach ${reportData.breakEven.monthsToBreakEven} Monaten`
                              : 'Expansion nicht rentabel im Planjahr'}
                          </p>
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </div>

              {reportData.calculationMethod && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3" data-testid="info-calculation-method">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      <span className="font-medium">Berechnungsmethode:</span> {reportData.calculationMethod}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Monatlicher Gewinn: A vs B</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => fmtEur(v)} />
                        <Legend />
                        <Bar dataKey="profitA" name="Szenario A" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="profitB" name="Szenario B" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Umsatzentwicklung</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => fmtEur(v)} />
                        <Legend />
                        <Area type="monotone" dataKey="revenueA" name="Umsatz A" stroke="#3b82f6" fill="#3b82f680" />
                        <Area type="monotone" dataKey="revenueB" name="Umsatz B" stroke="#f59e0b" fill="#f59e0b80" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Fahrten-Aufschlüsselung (Szenario A)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="ownA" name="Eigenfahrten" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="subiA" name="Subi-Fahrten" stackId="a" fill="#a78bfa" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {chartData.some((d: any) => d.marginList > 0 || d.marginMarket > 0) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Margenvergleich: Listenpreis vs. Marktpreis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                        <Legend />
                        <Bar dataKey="marginList" name="Listenpreis-Marge" fill="#1b9e6b" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="marginMarket" name="Marktpreis-Marge" fill="#eb7636" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {reportData.containerEvents && reportData.containerEvents.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800" data-testid="card-container-purchases">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4 text-amber-600" />
                      Container-Nachkaufplan ({params.containerTurnaroundDays} Tage Standzeit)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground mb-3">
                      Bei {params.containerTurnaroundDays} Tagen Standzeit werden im Jahresverlauf Container nachgekauft, um den Betrieb uneingeschränkt aufrechtzuerhalten.
                      Die Nachkaufkosten sind im Gewinn bereits berücksichtigt.
                    </div>
                    <table className="w-full text-xs" data-testid="table-container-purchases">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Monat</th>
                          <th className="text-right p-2 font-medium">Bestand vorher</th>
                          <th className="text-right p-2 font-medium">Nachkauf</th>
                          <th className="text-right p-2 font-medium">Bestand nachher</th>
                          <th className="text-right p-2 font-medium">Kosten</th>
                          <th className="text-left p-2 font-medium">Grund</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.containerEvents.map((ev: any, i: number) => (
                          <tr key={i} className="border-b hover:bg-secondary/50">
                            <td className="p-2 font-medium">{ev.monthName}</td>
                            <td className="text-right p-2">{ev.stockBefore}</td>
                            <td className="text-right p-2 font-semibold text-amber-700 dark:text-amber-400">+{ev.purchased}</td>
                            <td className="text-right p-2 font-medium">{ev.stockAfter}</td>
                            <td className="text-right p-2">{fmtEur(ev.cost)}</td>
                            <td className="p-2 text-muted-foreground max-w-[300px] truncate">{ev.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold border-t-2">
                          <td className="p-2">Gesamt</td>
                          <td className="text-right p-2">{reportData.containerEvents[0]?.stockBefore || '-'}</td>
                          <td className="text-right p-2 text-amber-700 dark:text-amber-400">
                            +{reportData.containerEvents.reduce((s: number, e: any) => s + e.purchased, 0)}
                          </td>
                          <td className="text-right p-2">{reportData.containerEvents[reportData.containerEvents.length - 1]?.stockAfter || '-'}</td>
                          <td className="text-right p-2">
                            {fmtEur(reportData.containerEvents.reduce((s: number, e: any) => s + e.cost, 0))}
                          </td>
                          <td className="p-2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Monatsübersicht – IST + Prognose</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="table-monthly-overview">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Monat</th>
                        <th className="text-right p-2 font-medium">Fahrten</th>
                        <th className="text-right p-2 font-medium">Umsatz</th>
                        <th className="text-right p-2 font-medium">Gewinn</th>
                        <th className="text-right p-2 font-medium border-l text-muted-foreground">Plan Fahrten</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Plan Umsatz</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Plan Gewinn</th>
                        <th className="text-right p-2 font-medium">Δ Umsatz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.scenarioA.map((m: any, i: number) => {
                        const hasActual = m.isActual === true;
                        const planRevenue = hasActual ? (m.planRevenue ?? m.totalRevenue) : m.totalRevenue;
                        const planTrips = hasActual ? (m.planTrips ?? m.totalTrips) : m.totalTrips;
                        const revDiff = hasActual ? m.totalRevenue - planRevenue : 0;
                        return (
                          <tr key={i} className={`border-b hover:bg-secondary/50 ${hasActual ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`} data-testid={`row-month-${i}`}>
                            <td className="p-2 font-medium">
                              {m.monthName}
                              {hasActual && <span className="ml-1 text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 rounded" data-testid={`badge-actual-${i}`}>IST</span>}
                              {!hasActual && <span className="ml-1 text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1 rounded">Plan</span>}
                            </td>
                            <td className="text-right p-2 font-semibold">{m.totalTrips}</td>
                            <td className="text-right p-2 font-semibold">{fmtEur(m.totalRevenue)}</td>
                            <td className={`text-right p-2 font-semibold ${m.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {fmtEur(m.monthlyProfit)}
                            </td>
                            <td className="text-right p-2 border-l text-muted-foreground">
                              {hasActual ? planTrips : '–'}
                            </td>
                            <td className="text-right p-2 text-muted-foreground">
                              {hasActual ? fmtEur(planRevenue) : '–'}
                            </td>
                            <td className="text-right p-2 text-muted-foreground">
                              {hasActual ? fmtEur(m.planProfit ?? 0) : '–'}
                            </td>
                            <td className={`text-right p-2 font-medium ${hasActual ? (revDiff >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                              {hasActual ? (
                                `${revDiff >= 0 ? '+' : ''}${fmtEur(revDiff)}`
                              ) : (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const months = reportData.scenarioA;
                        const totalTrips = months.reduce((s: number, m: any) => s + m.totalTrips, 0);
                        const totalRevenue = months.reduce((s: number, m: any) => s + m.totalRevenue, 0);
                        const totalProfit = months.reduce((s: number, m: any) => s + m.monthlyProfit, 0);
                        const actualMonths = months.filter((m: any) => m.isActual === true);
                        const totalPlanRevenue = actualMonths.reduce((s: number, m: any) => s + (m.planRevenue ?? m.totalRevenue), 0);
                        const totalDiff = actualMonths.length > 0
                          ? actualMonths.reduce((s: number, m: any) => s + m.totalRevenue, 0) - totalPlanRevenue
                          : 0;
                        return (
                          <tr className="font-bold border-t-2">
                            <td className="p-2">GESAMT {actualMonths.length > 0 ? `(${actualMonths.length}× IST + ${12 - actualMonths.length}× Plan)` : ''}</td>
                            <td className="text-right p-2">{totalTrips}</td>
                            <td className="text-right p-2">{fmtEur(totalRevenue)}</td>
                            <td className={`text-right p-2 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {fmtEur(totalProfit)}
                            </td>
                            <td className="text-right p-2 border-l text-muted-foreground">{actualMonths.length > 0 ? actualMonths.reduce((s: number, m: any) => s + (m.planTrips ?? 0), 0) : '–'}</td>
                            <td className="text-right p-2 text-muted-foreground">{actualMonths.length > 0 ? fmtEur(totalPlanRevenue) : '–'}</td>
                            <td className="text-right p-2 text-muted-foreground">{actualMonths.length > 0 ? fmtEur(actualMonths.reduce((s: number, m: any) => s + (m.planProfit ?? 0), 0)) : '–'}</td>
                            <td className={`text-right p-2 ${actualMonths.length > 0 ? (totalDiff >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                              {actualMonths.length > 0 ? `${totalDiff >= 0 ? '+' : ''}${fmtEur(totalDiff)}` : '–'}
                            </td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                  {reportData.scenarioA.some((m: any) => m.isActual) && (
                    <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-2" data-testid="text-actual-hint">
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-200 dark:bg-blue-800"></span> IST = echte Fahrten-Daten</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-gray-200 dark:bg-gray-700"></span> Plan = Hochrechnung</span>
                      <span>· Jahresprognose = IST-Monate + verbleibende Plan-Monate</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {reportData.scenarioA[0]?.avgBaseCostPerContainer != null && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Euro className="h-4 w-4" /> Margenanalyse je Monat (Szenario A)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-xs" data-testid="table-margin-analysis">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Monat</th>
                          <th className="text-right p-2 font-medium">Cnt/Tag</th>
                          <th className="text-right p-2 font-medium">Fixk./Cnt</th>
                          <th className="text-right p-2 font-medium">Basiskosten</th>
                          <th className="text-right p-2 font-medium">Ø Listenpreis</th>
                          <th className="text-right p-2 font-medium">Marge LP</th>
                          <th className="text-right p-2 font-medium">Marge LP %</th>
                          <th className="text-right p-2 font-medium">Ø Marktpreis</th>
                          <th className="text-right p-2 font-medium">Marge MP %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.scenarioA.map((m: any, i: number) => (
                          <tr key={i} className="border-b hover:bg-secondary/50">
                            <td className="p-2 font-medium">{m.monthName}</td>
                            <td className="text-right p-2">{m.actualContainersPerDay?.toFixed(1) || '-'}</td>
                            <td className="text-right p-2 text-muted-foreground">{m.fixedCostPerContainer ? fmtEur(m.fixedCostPerContainer) : '-'}</td>
                            <td className="text-right p-2">{m.avgBaseCostPerContainer ? fmtEur(m.avgBaseCostPerContainer) : '-'}</td>
                            <td className="text-right p-2">{m.avgListPricePerContainer ? fmtEur(m.avgListPricePerContainer) : '-'}</td>
                            <td className={`text-right p-2 font-medium ${(m.marginAtListPrice || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {m.marginAtListPrice != null ? fmtEur(m.marginAtListPrice) : '-'}
                            </td>
                            <td className={`text-right p-2 font-medium ${(m.marginPercentAtListPrice || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {m.marginPercentAtListPrice != null ? `${m.marginPercentAtListPrice.toFixed(1)}%` : '-'}
                            </td>
                            <td className="text-right p-2">{m.avgMarketPricePerContainer ? fmtEur(m.avgMarketPricePerContainer) : '-'}</td>
                            <td className={`text-right p-2 font-medium ${(m.marginPercentAtMarketPrice || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {m.marginPercentAtMarketPrice != null ? `${m.marginPercentAtMarketPrice.toFixed(1)}%` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 text-[10px] text-muted-foreground bg-secondary/30 rounded p-2 space-y-1" data-testid="text-calculation-notes">
                      <p><strong>Lesehinweis:</strong> Fixk./Cnt = Fixkosten pro Container (sinkt bei mehr Fahrten). Basiskosten = variable Kosten + Fixk./Cnt. Marge LP = Listenpreis − Basiskosten. Marktpreis = Ø aus {reportData.scenarioA[0]?.avgMarketPricePerContainer > 0 ? 'Buhck + Junkbusters + KI' : 'verfügbaren Quellen'}.</p>
                      {reportData.scenarioA[0]?.calculationHint && (
                        <p><strong>Jan-Beispiel:</strong> {reportData.scenarioA[0].calculationHint}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className={`${reportData.breakEven.profitDifference > 0 ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700' : 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700'}`}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm font-medium mb-1">Empfehlung</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-recommendation">
                    {reportData.breakEven.recommendation}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">Noch keine Berechnung</p>
              <p className="text-sm">Passe die Parameter an und klicke "Prognose berechnen"</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="priceopt" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" /> Preisoptimierung
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Kosten vs. Listenpreise vs. Marktpreise – Zielpreise setzen und direkt übernehmen
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 mb-4">
                <div className="flex-1 max-w-[200px]">
                  <Label className="text-xs">Ø Entfernung (km)</Label>
                  <Input
                    type="number"
                    value={priceOptDistance}
                    onChange={e => setPriceOptDistance(Number(e.target.value) || 15)}
                    min={5} max={100}
                    data-testid="input-priceopt-distance"
                  />
                </div>
                <Button
                  onClick={() => priceOptMutation.mutate(priceOptDistance)}
                  disabled={priceOptMutation.isPending}
                  data-testid="button-analyze-prices"
                >
                  {priceOptMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Target className="h-4 w-4 mr-1" />}
                  Preise analysieren
                </Button>
              </div>
            </CardContent>
          </Card>

          {priceOptData && (() => {
            const recs = priceOptData.recommendations as any[];
            const totalAnnualImpactCustom = recs.reduce((sum: number, r: any) => {
              const key = `${r.materialId}-${r.containerSize}`;
              const tp = customPrices[key];
              if (tp === undefined || r.currentListPrice === null) return sum;
              return sum + Math.round((tp - r.currentListPrice) * priceOptData.summary.containersPerMonth * 12 / (recs.length));
            }, 0);
            const statusCounts = recs.reduce((acc: any, r: any) => {
              const key = `${r.materialId}-${r.containerSize}`;
              const tp = customPrices[key];
              const st = tp !== undefined ? getTargetStatus(r, tp) : r.status;
              acc[st] = (acc[st] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">Unter Kosten</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300" data-testid="text-count-under-cost">{statusCounts.under_cost || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">Unter Markt</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300" data-testid="text-count-below-market">{statusCounts.below_market || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Am Markt</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-count-at-market">{statusCounts.at_market || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Über Markt</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300" data-testid="text-count-above-market">{statusCounts.above_market || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Kein Markt</p>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300" data-testid="text-count-no-market">{(statusCounts.no_market || 0) + (statusCounts.no_price || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {totalAnnualImpactCustom !== 0 && (
                <Card className={totalAnnualImpactCustom > 0 ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700' : 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700'}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Geschätzte Auswirkung (Jahresbasis)</p>
                        <p className="text-xs text-muted-foreground">Bei Übernahme aller Zielpreise vs. aktuelle Listenpreise</p>
                      </div>
                      <p className={`text-xl font-bold ${totalAnnualImpactCustom > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`} data-testid="text-annual-impact">
                        {totalAnnualImpactCustom > 0 ? '+' : ''}{fmtEur(totalAnnualImpactCustom)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings2 className="h-4 w-4" /> Preisstrategie wählen
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Wähle eine Strategie und alle Zielpreise werden automatisch gesetzt. Du kannst danach einzelne Preise anpassen.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <button
                      className={`p-3 rounded-lg border-2 text-left transition-all ${priceStrategy === 'market' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      onClick={() => setPriceStrategy('market')}
                      data-testid="button-strategy-market"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold">Marktpreis</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Alle Preise auf Marktniveau setzen</p>
                    </button>
                    <button
                      className={`p-3 rounded-lg border-2 text-left transition-all ${priceStrategy === 'market_minus' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      onClick={() => setPriceStrategy('market_minus')}
                      data-testid="button-strategy-market-minus"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Percent className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs font-semibold">Markt −X%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Unterbieten für Wettbewerbsvorteil</p>
                    </button>
                    <button
                      className={`p-3 rounded-lg border-2 text-left transition-all ${priceStrategy === 'list' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      onClick={() => setPriceStrategy('list')}
                      data-testid="button-strategy-list"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Euro className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-semibold">Listenpreis</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Aktuelle Listenpreise beibehalten</p>
                    </button>
                    <button
                      className={`p-3 rounded-lg border-2 text-left transition-all ${priceStrategy === 'cost_plus' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      onClick={() => setPriceStrategy('cost_plus')}
                      data-testid="button-strategy-cost-plus"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="h-3.5 w-3.5 text-orange-600" />
                        <span className="text-xs font-semibold">Kosten + X €</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Fester Aufschlag pro Container</p>
                    </button>
                  </div>

                  <div className="flex items-end gap-3">
                    {(priceStrategy === 'market_minus') && (
                      <div className="w-32">
                        <Label className="text-xs">Rabatt (%)</Label>
                        <Input
                          type="number"
                          value={strategyValue}
                          onChange={e => setStrategyValue(Number(e.target.value) || 0)}
                          min={0} max={50}
                          data-testid="input-strategy-value"
                        />
                      </div>
                    )}
                    {priceStrategy === 'cost_plus' && (
                      <div className="w-32">
                        <Label className="text-xs">Aufschlag (€)</Label>
                        <Input
                          type="number"
                          value={strategyValue}
                          onChange={e => setStrategyValue(Number(e.target.value) || 0)}
                          min={0} max={500}
                          data-testid="input-strategy-value"
                        />
                      </div>
                    )}
                    <Button
                      onClick={() => applyStrategy(priceStrategy, strategyValue)}
                      size="sm"
                      data-testid="button-apply-strategy"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      {priceStrategy === 'market' ? 'Alle auf Marktpreis' :
                       priceStrategy === 'market_minus' ? `Alle auf Markt −${strategyValue}%` :
                       priceStrategy === 'list' ? 'Alle auf Listenpreis' :
                       `Alle auf Kosten +${strategyValue} €`}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {[7, 10].map(size => {
                const sizeRecs = recs.filter((r: any) => r.containerSize === size);
                if (sizeRecs.length === 0) return null;
                const allSelected = sizeRecs.every((r: any) => selectedPrices.has(`${r.materialId}-${r.containerSize}`));
                return (
                  <Card key={size}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Package className="h-4 w-4" /> {size}m³ Container
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedPrices);
                              sizeRecs.forEach((r: any) => {
                                const key = `${r.materialId}-${r.containerSize}`;
                                if (checked) newSet.add(key); else newSet.delete(key);
                              });
                              setSelectedPrices(newSet);
                            }}
                            data-testid={`checkbox-select-all-${size}`}
                          />
                          <Label className="text-xs cursor-pointer">Alle</Label>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-xs" data-testid={`table-priceopt-${size}`}>
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="text-left p-2 w-8"></th>
                              <th className="text-left p-2">Material</th>
                              <th className="text-right p-2">Kosten</th>
                              <th className="text-right p-2">Listenpreis</th>
                              <th className="text-right p-2">Marktpreis</th>
                              <th className="text-right p-2 min-w-[100px]">Zielpreis</th>
                              <th className="text-right p-2">Akt. Marge</th>
                              <th className="text-right p-2">Ziel-Marge</th>
                              <th className="text-center p-2">Status</th>
                              <th className="text-right p-2">Jahreseffekt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sizeRecs.map((r: any) => {
                              const key = `${r.materialId}-${r.containerSize}`;
                              const isSelected = selectedPrices.has(key);
                              const targetPrice = customPrices[key] ?? r.currentListPrice ?? r.optimalPrice;
                              const targetMargin = r.baseCost > 0 ? ((targetPrice - r.baseCost) / r.baseCost * 100) : 0;
                              const targetStatus = getTargetStatus(r, targetPrice);
                              const impact = r.currentListPrice !== null
                                ? Math.round((targetPrice - r.currentListPrice) * priceOptData.summary.containersPerMonth * 12 / recs.length)
                                : null;
                              return (
                                <tr key={key} className={`border-b hover:bg-secondary/50 ${isSelected ? 'bg-primary/5' : ''}`} data-testid={`row-priceopt-${key}`}>
                                  <td className="p-2">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const newSet = new Set(selectedPrices);
                                        if (checked) newSet.add(key); else newSet.delete(key);
                                        setSelectedPrices(newSet);
                                      }}
                                      data-testid={`checkbox-${key}`}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <div className="font-medium">{r.materialName}</div>
                                    {r.avvNumber && <div className="text-muted-foreground text-[10px]">AVV: {r.avvNumber}</div>}
                                  </td>
                                  <td className="text-right p-2 font-mono">{fmtEur(r.baseCost, 2)}</td>
                                  <td className="text-right p-2 font-mono">
                                    {r.currentListPrice !== null ? fmtEur(r.currentListPrice, 2) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="text-right p-2 font-mono" title={r.marketProviders?.length ? `Quellen: ${r.marketProviders.join(', ')}` : ''}>
                                    {r.marketPriceNet !== null ? (
                                      <div>
                                        <div>{fmtEur(r.marketPriceNet, 2)}</div>
                                        {r.marketProviders?.length > 0 && (
                                          <div className="text-[9px] text-muted-foreground leading-tight">
                                            Ø {r.marketProviders.length} {r.marketProviders.length === 1 ? 'Quelle' : 'Quellen'}
                                          </div>
                                        )}
                                      </div>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="p-1">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-7 text-xs font-mono text-right w-24 ml-auto"
                                      value={targetPrice.toFixed(2)}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val)) {
                                          setCustomPrices(prev => ({ ...prev, [key]: Math.round(val * 100) / 100 }));
                                          setSelectedPrices(prev => new Set(prev).add(key));
                                        }
                                      }}
                                      data-testid={`input-target-price-${key}`}
                                    />
                                  </td>
                                  <td className={`text-right p-2 font-mono ${r.currentMarginPercent !== null ? (r.currentMarginPercent < 0 ? 'text-red-600' : 'text-green-600') : ''}`}>
                                    {r.currentMarginPercent !== null ? `${r.currentMarginPercent.toFixed(1)}%` : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className={`text-right p-2 font-mono font-medium ${targetMargin < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {targetMargin.toFixed(1)}%
                                  </td>
                                  <td className="text-center p-2">
                                    {targetStatus === 'under_cost' && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5" data-testid={`badge-status-${key}`}>
                                        <XCircle className="h-3 w-3 mr-0.5" /> Unter Kosten
                                      </Badge>
                                    )}
                                    {targetStatus === 'below_market' && (
                                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5" data-testid={`badge-status-${key}`}>
                                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Unter Markt
                                      </Badge>
                                    )}
                                    {targetStatus === 'at_market' && (
                                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] px-1.5" data-testid={`badge-status-${key}`}>
                                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Am Markt
                                      </Badge>
                                    )}
                                    {targetStatus === 'above_market' && (
                                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] px-1.5" data-testid={`badge-status-${key}`}>
                                        <ArrowUpRight className="h-3 w-3 mr-0.5" /> Über Markt
                                      </Badge>
                                    )}
                                    {targetStatus === 'no_market' && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5" data-testid={`badge-status-${key}`}>
                                        <HelpCircle className="h-3 w-3 mr-0.5" /> Kein Markt
                                      </Badge>
                                    )}
                                  </td>
                                  <td className={`text-right p-2 font-mono ${impact !== null ? (impact > 0 ? 'text-green-600' : impact < 0 ? 'text-red-600' : '') : ''}`}>
                                    {impact !== null ? (
                                      <>{impact > 0 ? '+' : ''}{fmtEur(impact)}</>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="md:hidden space-y-2" data-testid={`cards-priceopt-${size}`}>
                        {sizeRecs.map((r: any) => {
                          const key = `${r.materialId}-${r.containerSize}`;
                          const isSelected = selectedPrices.has(key);
                          const targetPrice = customPrices[key] ?? r.currentListPrice ?? r.optimalPrice;
                          const targetMarginPct = r.baseCost > 0 ? ((targetPrice - r.baseCost) / r.baseCost * 100) : 0;
                          const targetStatus = getTargetStatus(r, targetPrice);
                          const impact = r.currentListPrice !== null
                            ? Math.round((targetPrice - r.currentListPrice) * priceOptData.summary.containersPerMonth * 12 / recs.length)
                            : null;
                          const statusBadge = targetStatus === 'under_cost' ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5"><XCircle className="h-3 w-3 mr-0.5" /> Unter Kosten</Badge>
                          ) : targetStatus === 'below_market' ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Unter Markt</Badge>
                          ) : targetStatus === 'at_market' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] px-1.5"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Am Markt</Badge>
                          ) : targetStatus === 'above_market' ? (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] px-1.5"><ArrowUpRight className="h-3 w-3 mr-0.5" /> Über Markt</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5"><HelpCircle className="h-3 w-3 mr-0.5" /> Kein Markt</Badge>
                          );
                          return (
                            <div key={key} className={`border rounded-lg p-3 text-xs ${isSelected ? 'bg-primary/5 border-primary/30' : ''}`} data-testid={`row-priceopt-${key}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const newSet = new Set(selectedPrices);
                                      if (checked) newSet.add(key); else newSet.delete(key);
                                      setSelectedPrices(newSet);
                                    }}
                                    data-testid={`checkbox-${key}`}
                                    className="shrink-0 mt-0.5"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{r.materialName}</div>
                                    {r.avvNumber && <div className="text-muted-foreground text-[10px]">AVV: {r.avvNumber}</div>}
                                  </div>
                                </div>
                                {statusBadge}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                <div className="flex justify-between"><span className="text-muted-foreground">Kosten:</span><span className="font-mono">{fmtEur(r.baseCost, 2)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Listenpreis:</span><span className="font-mono">{r.currentListPrice !== null ? fmtEur(r.currentListPrice, 2) : '—'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Markt:</span><span className="font-mono">{r.marketPriceNet !== null ? fmtEur(r.marketPriceNet, 2) : '—'}</span></div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Ziel-Marge:</span>
                                  <span className={`font-mono font-medium ${targetMarginPct < 0 ? 'text-red-600' : 'text-green-600'}`}>{targetMarginPct.toFixed(1)}%</span>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Zielpreis:</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-7 text-xs font-mono text-right flex-1"
                                  value={targetPrice.toFixed(2)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      setCustomPrices(prev => ({ ...prev, [key]: Math.round(val * 100) / 100 }));
                                      setSelectedPrices(prev => new Set(prev).add(key));
                                    }
                                  }}
                                  data-testid={`input-target-price-${key}`}
                                />
                              </div>
                              {impact !== null && (
                                <div className="mt-1 flex justify-between text-[11px]">
                                  <span className="text-muted-foreground">Jahreseffekt:</span>
                                  <span className={`font-mono ${impact > 0 ? 'text-green-600' : impact < 0 ? 'text-red-600' : ''}`}>
                                    {impact > 0 ? '+' : ''}{fmtEur(impact)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <div className="flex gap-2 justify-end flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await downloadPdf('/api/priceopt/pdf', `Preisoptimierung_${new Date().toISOString().split('T')[0]}.pdf`, {
                        recommendations: priceOptData.recommendations,
                        summary: priceOptData.summary,
                      });
                    } catch (err: any) {
                      toast({ title: "Fehler", description: err.message, variant: "destructive" });
                    }
                  }}
                  data-testid="button-export-priceopt-pdf"
                >
                  <FileText className="h-4 w-4 mr-1" /> PDF Export
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPriceListCustomer('');
                    setPriceListDiscount(0);
                    setPriceListOpen(true);
                  }}
                  data-testid="button-create-pricelist"
                >
                  <Euro className="h-4 w-4 mr-1" /> Preisliste
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const lines = [
                      'Material;Container (m³);Kosten (€);Listenpreis (€);Marktpreis (€);Zielpreis (€);Akt. Marge (%);Ziel-Marge (%);Status'
                    ];
                    for (const r of recs) {
                      const key = `${r.materialId}-${r.containerSize}`;
                      const tp = customPrices[key] ?? r.currentListPrice ?? r.optimalPrice;
                      const tm = r.baseCost > 0 ? ((tp - r.baseCost) / r.baseCost * 100) : 0;
                      const st = getTargetStatus(r, tp);
                      const statusLabel = st === 'under_cost' ? 'Unter Kosten' : st === 'below_market' ? 'Unter Markt' : st === 'at_market' ? 'Am Markt' : st === 'above_market' ? 'Über Markt' : 'Kein Markt';
                      lines.push([
                        r.materialName,
                        r.containerSize,
                        r.baseCost.toFixed(2).replace('.', ','),
                        r.currentListPrice !== null ? r.currentListPrice.toFixed(2).replace('.', ',') : '',
                        r.marketPriceNet !== null ? r.marketPriceNet.toFixed(2).replace('.', ',') : '',
                        tp.toFixed(2).replace('.', ','),
                        r.currentMarginPercent !== null ? r.currentMarginPercent.toFixed(1).replace('.', ',') : '',
                        tm.toFixed(1).replace('.', ','),
                        statusLabel,
                      ].join(';'));
                    }
                    const csv = '\uFEFF' + lines.join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Preisoptimierung_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  data-testid="button-export-priceopt-csv"
                >
                  <Download className="h-4 w-4 mr-1" /> CSV Export
                </Button>

                <Button
                  disabled={selectedPrices.size === 0 || applyPricesMutation.isPending}
                  onClick={() => {
                    const selections: { materialId: number; containerSize: number; targetPrice: number }[] = [];
                    for (const key of Array.from(selectedPrices)) {
                      const rec = recs.find((r: any) => `${r.materialId}-${r.containerSize}` === key);
                      if (!rec || !rec.salesPriceId) continue;
                      const tp = customPrices[key] ?? rec.currentListPrice ?? rec.optimalPrice;
                      selections.push({ materialId: rec.materialId, containerSize: rec.containerSize, targetPrice: tp });
                    }
                    if (selections.length === 0) {
                      toast({ title: "Hinweis", description: "Keine anpassbaren Preise ausgewählt", variant: "destructive" });
                      return;
                    }
                    applyPricesMutation.mutate(selections);
                  }}
                  data-testid="button-apply-prices"
                >
                  {applyPricesMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  {selectedPrices.size} Preise übernehmen
                </Button>
              </div>

              {applyWarning && (
                <Card className="border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40" data-testid="apply-price-warning">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-300">Große Preisänderungen erkannt!</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{applyWarning.warnings.length} Preise weichen um mehr als 25% ab:</p>
                      </div>
                    </div>
                    <ul className="space-y-1 mb-4 max-h-40 overflow-y-auto">
                      {applyWarning.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5 shrink-0">⚠</span> {w}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setApplyWarning(null)} data-testid="button-cancel-apply-warning">
                        Abbrechen
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isApplying}
                        onClick={() => applyPricesWithCheck(applyWarning.pendingSelections, true)}
                        data-testid="button-confirm-apply-warning"
                      >
                        {isApplying ? "Speichern..." : "Trotzdem übernehmen"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">So funktioniert's</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    1. Wähle eine Preisstrategie (Marktpreis, Markt−X%, Listenpreis, Kosten+X€) – alle Zielpreise werden gesetzt.
                    2. Passe einzelne Preise an, wenn nötig. Status zeigt die Position zum Marktpreis.
                    3. Klicke "Preise übernehmen" – die Verkaufspreise werden in der Preisliste aktualisiert.
                  </p>
                </CardContent>
              </Card>
            </>
          );
          })()}

          {!priceOptData && !priceOptMutation.isPending && (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">Preisanalyse starten</p>
              <p className="text-sm">Entfernung eingeben und "Preise analysieren" klicken</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={priceListOpen} onOpenChange={setPriceListOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kunden-Preisliste erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kunde (optional)</Label>
              <Select value={priceListCustomer} onValueChange={(val) => {
                setPriceListCustomer(val);
                if (val && val !== '__none__' && customers) {
                  const c = customers.find((cu: any) => (cu.companyName || cu.contactPerson) === val);
                  if (c?.discountPercent) setPriceListDiscount(Number(c.discountPercent));
                  else setPriceListDiscount(0);
                  if (c?.email) setPriceListEmail(c.email);
                } else {
                  setPriceListDiscount(0);
                  setPriceListEmail('');
                }
              }}>
                <SelectTrigger data-testid="select-pricelist-customer">
                  <SelectValue placeholder="Allgemeine Preisliste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Allgemeine Preisliste</SelectItem>
                  {customers?.map((c: any) => (
                    <SelectItem key={c.id} value={c.companyName || c.contactPerson || `Kunde ${c.id}`}>
                      {c.companyName || c.contactPerson || `Kunde ${c.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rabatt (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={priceListDiscount}
                onChange={(e) => setPriceListDiscount(Number(e.target.value) || 0)}
                data-testid="input-pricelist-discount"
              />
            </div>
            <Separator />
            <div>
              <Label>E-Mail senden an (optional)</Label>
              <Input
                type="email"
                placeholder="kunde@beispiel.de"
                value={priceListEmail}
                onChange={(e) => setPriceListEmail(e.target.value)}
                data-testid="input-pricelist-email"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={async () => {
                  try {
                    const customerName = priceListCustomer && priceListCustomer !== '__none__' ? priceListCustomer : undefined;
                    await downloadPdf('/api/priceopt/pricelist', `Preisliste_${customerName || 'Allgemein'}_${new Date().toISOString().split('T')[0]}.pdf`, {
                      recommendations: priceOptData.recommendations,
                      distance: priceOptDistance,
                      customerName,
                      discountPercent: priceListDiscount,
                    });
                  } catch (err: any) {
                    toast({ title: "Fehler", description: err.message, variant: "destructive" });
                  }
                }}
                data-testid="button-generate-pricelist"
              >
                <FileText className="h-4 w-4 mr-2" /> PDF Vorschau
              </Button>
              <Button
                className="flex-1"
                disabled={!priceListEmail || sendingPriceList}
                onClick={async () => {
                  setSendingPriceList(true);
                  try {
                    const customerName = priceListCustomer && priceListCustomer !== '__none__' ? priceListCustomer : undefined;
                    const res = await apiRequest('POST', '/api/priceopt/pricelist/send', {
                      recommendations: priceOptData.recommendations,
                      distance: priceOptDistance,
                      customerName,
                      discountPercent: priceListDiscount,
                      email: priceListEmail,
                    });
                    const data = await res.json();
                    toast({ title: "Gesendet", description: data.message });
                    setPriceListOpen(false);
                  } catch (err: any) {
                    toast({ title: "Fehler", description: err.message, variant: "destructive" });
                  } finally {
                    setSendingPriceList(false);
                  }
                }}
                data-testid="button-send-pricelist"
              >
                {sendingPriceList ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                Per E-Mail senden
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
