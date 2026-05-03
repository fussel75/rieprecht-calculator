import { usePlanningSettings, useUpdatePlanningSettings } from "@/hooks/use-planning";
import { useTrips } from "@/hooks/use-trips";
import { useMaterials } from "@/hooks/use-materials";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Calendar as CalendarIcon, Save, TrendingUp, Target, Box, Euro, ArrowUp, ArrowDown, Minus, FileText, Loader2 } from "lucide-react";
import { downloadPdf } from "@/lib/pdf-export";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { formatCurrency } from "@/lib/utils";

export default function Planning() {
  const { data: settings } = usePlanningSettings();
  const { mutate: updateSettings } = useUpdatePlanningSettings();
  const { data: trips } = useTrips();
  const { data: materials } = useMaterials();
  const { toast } = useToast();

  const [pdfLoading, setPdfLoading] = useState(false);
  const [containersPerDay, setContainersPerDay] = useState(5);
  const [activeTrucks, setActiveTrucks] = useState(1);
  const [workDaysPerMonth, setWorkDaysPerMonth] = useState(20);
  const [margin, setMargin] = useState(15);

  useEffect(() => {
    if (settings) {
      setContainersPerDay(settings.containersPerDay || 5);
      setActiveTrucks(settings.activeTrucks || 1);
      setWorkDaysPerMonth(settings.workDaysPerMonth || 20);
      setMargin(Number(settings.targetMarginPercent) || 15);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      containersPerDay,
      activeTrucks,
      workDaysPerMonth,
      targetMarginPercent: margin.toString(),
    }, {
      onSuccess: () => toast({ title: "Gespeichert" })
    });
  };

  const currentDate = new Date();
  const fallbackPlanned = containersPerDay * activeTrucks * workDaysPerMonth;

  const { data: activePlan } = useQuery<any>({
    queryKey: ["/api/plans/active"],
  });

  const { data: forecastReport, isLoading: forecastLoading } = useQuery<any>({
    queryKey: ["/api/forecast/annual-report"],
  });

  const getPlannedForMonth = (date: Date): number => {
    const m = date.getMonth();
    if (activePlan?.monthlyData && Array.isArray(activePlan.monthlyData)) {
      const planMonth = activePlan.monthlyData.find((fm: any) => fm.month === m);
      if (planMonth) return planMonth.totalTrips || 0;
    }
    const scenarioA = forecastReport?.scenarioA;
    if (scenarioA && Array.isArray(scenarioA)) {
      const forecastMonth = scenarioA.find((fm: any) => fm.month === m);
      if (forecastMonth) return forecastMonth.totalTrips || 0;
    }
    return fallbackPlanned;
  };

  const getMonthData = (monthOffset: number) => {
    const targetDate = subMonths(currentDate, monthOffset);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    
    const monthTrips = trips?.filter(t => {
      const date = parseISO(t.tripDate);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    }) || [];

    return {
      month: format(targetDate, 'MMM yy', { locale: de }),
      actual: monthTrips.length,
      planned: getPlannedForMonth(targetDate),
      revenue: monthTrips.reduce((sum, t) => sum + Number(t.actualPrice), 0),
    };
  };

  const comparisonData = Array.from({ length: 6 }).map((_, i) => getMonthData(5 - i));

  const currentMonthData = getMonthData(0);
  const plannedContainersPerMonth = currentMonthData.planned;
  const percentOfTarget = plannedContainersPerMonth > 0 
    ? Math.round((currentMonthData.actual / plannedContainersPerMonth) * 100) 
    : 0;

  const planSource = activePlan?.monthlyData && Array.isArray(activePlan.monthlyData)
    ? activePlan.monthlyData
    : forecastReport?.scenarioA;
  const planLabel = activePlan ? `${activePlan.name}` : 'aus Prognose-Center';

  const forecastData = (planSource || []).map((m: any) => ({
    month: m.monthName?.substring(0, 3) || '',
    profit: m.monthlyProfit || 0,
    revenue: m.totalRevenue || 0,
    costs: (m.totalVariableCosts || 0) + (m.fixedCosts || 0),
  }));

  const yearlyProfit = forecastData.reduce((sum: number, d: any) => sum + d.profit, 0);
  const yearlyRevenue = forecastData.reduce((sum: number, d: any) => sum + d.revenue, 0);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader 
          title="Planung" 
          description="Kapazitätsziele und Gewinnprognose" 
        />
        <Button
          variant="outline"
          size="sm"
          disabled={pdfLoading}
          data-testid="button-pdf-export"
          onClick={async () => {
            setPdfLoading(true);
            try {
              const totalPlannedTrips = comparisonData.reduce((sum, d) => sum + d.planned, 0);
              const totalActualTrips = comparisonData.reduce((sum, d) => sum + d.actual, 0);
              const totalPlannedRevenue = comparisonData.reduce((sum, d) => sum + d.planned * (avgBaseCost + avgMarginPerContainer), 0);
              const totalActualRevenue = comparisonData.reduce((sum, d) => sum + d.revenue, 0);
              await downloadPdf('/api/planning/pdf', 'Planung.pdf', {
                months: comparisonData,
                totalPlannedRevenue,
                totalActualRevenue,
                totalPlannedTrips,
                totalActualTrips,
                year: currentDate.getFullYear(),
              });
            } catch (err: any) {
              toast({ title: "Fehler", description: err.message || "PDF-Export fehlgeschlagen", variant: "destructive" });
            } finally {
              setPdfLoading(false);
            }
          }}
        >
          <FileText className="h-4 w-4 mr-1" />
          {pdfLoading ? 'Exportiere...' : 'PDF Export'}
        </Button>
      </div>

      {/* Controls */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="w-5 h-5 text-primary" />
            Kapazitätsplanung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-sm font-medium">Container/Tag pro LKW</Label>
                <span className="font-mono text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded-full">{containersPerDay}</span>
              </div>
              <Slider 
                value={[containersPerDay]} 
                onValueChange={(v) => setContainersPerDay(v[0])} 
                max={20} 
                step={1}
                data-testid="slider-containers-per-day"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-sm font-medium">Aktive LKWs</Label>
                <span className="font-mono text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded-full">{activeTrucks}</span>
              </div>
              <Slider 
                value={[activeTrucks]} 
                onValueChange={(v) => setActiveTrucks(v[0])} 
                max={5} 
                step={1}
                data-testid="slider-active-trucks"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-sm font-medium">Arbeitstage/Woche</Label>
                <span className="font-mono text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded-full">{Math.round(workDaysPerMonth / 4)} Tage</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={workDaysPerMonth === 20 ? "default" : "outline"} 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setWorkDaysPerMonth(20)}
                  data-testid="button-5-days"
                >
                  5 Tage
                </Button>
                <Button 
                  variant={workDaysPerMonth === 24 ? "default" : "outline"} 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setWorkDaysPerMonth(24)}
                  data-testid="button-6-days"
                >
                  6 Tage
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-sm font-medium">Zielmarge</Label>
                <span className="font-mono text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded-full">{margin}%</span>
              </div>
              <Slider 
                value={[margin]} 
                onValueChange={(v) => setMargin(v[0])} 
                max={100} 
                step={1}
                data-testid="slider-target-margin"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border/50">
            <Button onClick={handleSave} className="font-semibold" data-testid="button-save-settings">
              <Save className="w-4 h-4 mr-2" /> Speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ist vs. Soll */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Target className="w-5 h-5 text-primary" />
            Ist vs. Soll - Aktueller Monat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Box className="w-4 h-4" />
                <span className="text-sm">Geplant</span>
              </div>
              <p className="text-2xl font-bold">{plannedContainersPerMonth}</p>
              <p className="text-xs text-muted-foreground">
                {activePlan ? `Aktiver Plan: ${activePlan.name}` : 'Container/Monat (Live-Prognose)'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-primary/10">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Box className="w-4 h-4" />
                <span className="text-sm font-medium">Tatsächlich</span>
              </div>
              <p className="text-2xl font-bold text-primary">{currentMonthData.actual}</p>
              <p className="text-xs text-muted-foreground">Container gefahren</p>
            </div>

            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                {percentOfTarget >= 100 ? (
                  <ArrowUp className="w-4 h-4 text-emerald-500" />
                ) : percentOfTarget >= 80 ? (
                  <Minus className="w-4 h-4 text-amber-500" />
                ) : (
                  <ArrowDown className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm">Zielerreichung</span>
              </div>
              <p className={`text-2xl font-bold ${
                percentOfTarget >= 100 ? "text-emerald-600" : 
                percentOfTarget >= 80 ? "text-amber-600" : "text-red-600"
              }`}>
                {percentOfTarget}%
              </p>
              <p className="text-xs text-muted-foreground">vom Monatsziel</p>
            </div>
          </div>

          {comparisonData.some(d => d.actual > 0) && (
            <div className="mt-6 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={30} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name === 'actual' ? 'Tatsächlich' : 'Geplant']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  />
                  <Legend formatter={(value) => value === 'actual' ? 'Tatsächlich' : 'Geplant'} />
                  <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            12-Monats-Gewinnprognose
            <span className="text-xs font-normal text-muted-foreground ml-auto">{planLabel}</span>
          </CardTitle>
          {!forecastLoading && forecastData.length > 0 && (
            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
              <span>Jahresumsatz: <strong className="text-foreground">{formatCurrency(yearlyRevenue)}</strong></span>
              <span>Jahresgewinn: <strong className={yearlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(yearlyProfit)}</strong></span>
            </div>
          )}
        </CardHeader>
        <CardContent className="h-[300px] sm:h-[380px]">
          {forecastLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Prognose wird berechnet...</span>
            </div>
          ) : forecastData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Keine Prognosedaten verfügbar. Berechne eine Prognose im Prognose-Center.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={40} />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'profit' ? 'Gewinn' : name === 'revenue' ? 'Umsatz' : 'Kosten']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Legend formatter={(value) => value === 'profit' ? 'Gewinn' : value === 'revenue' ? 'Umsatz' : 'Kosten'} />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#1b9e6b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: "#1b9e6b", strokeWidth: 1.5, stroke: "white" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "white" }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "white" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
