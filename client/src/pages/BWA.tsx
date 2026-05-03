import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileSpreadsheet, Upload, Loader2, Trash2, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Info
} from "lucide-react";
import type { BwaReport } from "@shared/schema";

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTH_NAMES_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function fmtEur(v: number | string | null | undefined): string {
  const num = Number(v || 0);
  return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function fmtEurFull(v: number | string | null | undefined): string {
  const num = Number(v || 0);
  return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BWA() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [preview, setPreview] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  const yearParam = selectedYear !== "all" ? `?year=${selectedYear}` : "";
  const { data: reports = [], isLoading } = useQuery<BwaReport[]>({
    queryKey: ['/api/bwa', selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/bwa${yearParam}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Fehler');
      return res.json();
    },
  });

  const years = [...new Set(reports.map(r => r.year))].sort((a, b) => b - a);
  const availableYears = years.length > 0 ? years : [new Date().getFullYear()];

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/bwa/${id}`);
    },
    onSuccess: () => {
      toast({ title: "BWA-Eintrag gelöscht" });
      queryClient.invalidateQueries({ queryKey: ['/api/bwa'] });
    },
    onError: () => toast({ title: "Fehler", variant: "destructive" }),
  });

  const confirmImportMutation = useMutation({
    mutationFn: async (data: { preview: any[]; year: number; fileName: string }) => {
      const res = await apiRequest('POST', '/api/bwa/confirm-import', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Import erfolgreich", description: data.message });
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['/api/bwa'] });
    },
    onError: () => toast({ title: "Fehler beim Import", variant: "destructive" }),
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/bwa/import-pdf', {
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
      toast({ title: "Vorschau bereit", description: `${json.preview.length} Monate für ${json.year} erkannt` });
    } catch {
      toast({ title: "Fehler beim Upload", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [toast]);

  const groupedByYear = reports.reduce((acc: Record<number, BwaReport[]>, r) => {
    if (!acc[r.year]) acc[r.year] = [];
    acc[r.year].push(r);
    return acc;
  }, {});

  const displayYear = selectedYear !== "all" ? Number(selectedYear) : (years[0] || new Date().getFullYear());
  const displayReports = groupedByYear[displayYear] || [];

  let cumResult = 0;
  const monthlyData = displayReports.map(r => {
    const rev = Number(r.revenue || 0);
    const costs = Number(r.totalCosts || 0);
    const result = Number(r.operatingResult || 0);
    cumResult += result;
    return { ...r, rev, costs, result, cumResult };
  });

  const totalRevenue = monthlyData.reduce((s, m) => s + m.rev, 0);
  const totalCosts = monthlyData.reduce((s, m) => s + m.costs, 0);
  const totalResult = monthlyData.reduce((s, m) => s + m.result, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-bwa">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            BWA – Betriebswirtschaftliche Auswertung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            BWA-Daten importieren, archivieren und mit App-Werten vergleichen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]" data-testid="select-bwa-year">
              <SelectValue placeholder="Jahr" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Jahre</SelectItem>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-bwa-file"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-bwa-upload"
          >
            {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            BWA PDF importieren
          </Button>
        </div>
      </div>

      {preview && (
        <Card className="border-2 border-blue-300 dark:border-blue-700" data-testid="card-bwa-preview">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Vorschau: {preview.fileName} – Jahr {preview.year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="table-bwa-preview">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Monat</th>
                    <th className="text-right p-2 font-medium">Umsatz</th>
                    <th className="text-right p-2 font-medium">Personal</th>
                    <th className="text-right p-2 font-medium">Fahrzeug</th>
                    <th className="text-right p-2 font-medium">Betrieb</th>
                    <th className="text-right p-2 font-medium">AfA</th>
                    <th className="text-right p-2 font-medium">Gesamt Kosten</th>
                    <th className="text-right p-2 font-medium">Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((m: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-secondary/50">
                      <td className="p-2 font-medium">{m.monthName}</td>
                      <td className="text-right p-2">{fmtEur(m.revenue)}</td>
                      <td className="text-right p-2">{fmtEur(m.personnelCosts)}</td>
                      <td className="text-right p-2">{fmtEur(m.vehicleCosts)}</td>
                      <td className="text-right p-2">{fmtEur(m.operatingCosts)}</td>
                      <td className="text-right p-2">{fmtEur(m.depreciation)}</td>
                      <td className="text-right p-2">{fmtEur(m.totalCosts)}</td>
                      <td className={`text-right p-2 font-medium ${m.operatingResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtEur(m.operatingResult)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" size="sm" onClick={() => setPreview(null)} data-testid="button-cancel-preview">
                Abbrechen
              </Button>
              <Button
                size="sm"
                disabled={confirmImportMutation.isPending}
                onClick={() => confirmImportMutation.mutate({
                  preview: preview.preview,
                  year: preview.year,
                  fileName: preview.fileName,
                })}
                data-testid="button-confirm-import"
              >
                {confirmImportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                {preview.preview.length} Monate importieren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : monthlyData.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Noch keine BWA-Daten vorhanden.</p>
            <p className="text-sm text-muted-foreground mt-1">Lade eine BWA-PDF hoch, um zu starten.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Gesamtumsatz {displayYear}</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300" data-testid="text-bwa-revenue">{fmtEur(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Gesamtkosten {displayYear}</p>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-300" data-testid="text-bwa-costs">{fmtEur(totalCosts)}</p>
              </CardContent>
            </Card>
            <Card className={totalResult >= 0 ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs font-medium text-muted-foreground">Betriebsergebnis</p>
                <p className={`text-xl font-bold ${totalResult >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`} data-testid="text-bwa-result">
                  {fmtEur(totalResult)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs font-medium text-muted-foreground">Umsatzrentabilität</p>
                <p className="text-xl font-bold" data-testid="text-bwa-profitability">
                  {totalRevenue > 0 ? `${(totalResult / totalRevenue * 100).toFixed(1).replace('.', ',')}%` : '–'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Monatsübersicht BWA {displayYear}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="table-bwa-monthly">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Monat</th>
                    <th className="text-right p-2 font-medium">Umsatz</th>
                    <th className="text-right p-2 font-medium">Material</th>
                    <th className="text-right p-2 font-medium">Personal</th>
                    <th className="text-right p-2 font-medium">Fahrzeug</th>
                    <th className="text-right p-2 font-medium">Betrieb</th>
                    <th className="text-right p-2 font-medium">AfA</th>
                    <th className="text-right p-2 font-medium">Zinsen</th>
                    <th className="text-right p-2 font-medium">Sonstige</th>
                    <th className="text-right p-2 font-medium">Σ Kosten</th>
                    <th className="text-right p-2 font-medium">Ergebnis</th>
                    <th className="text-right p-2 font-medium">Kumuliert</th>
                    <th className="text-center p-2 font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-secondary/50">
                      <td className="p-2 font-medium">{MONTH_NAMES_FULL[(m.month || 1) - 1]}</td>
                      <td className="text-right p-2">{fmtEur(m.revenue)}</td>
                      <td className="text-right p-2">{fmtEur(m.materialCosts)}</td>
                      <td className="text-right p-2">{fmtEur(m.personnelCosts)}</td>
                      <td className="text-right p-2">{fmtEur(m.vehicleCosts)}</td>
                      <td className="text-right p-2">{fmtEur(m.operatingCosts)}</td>
                      <td className="text-right p-2">{fmtEur(m.depreciation)}</td>
                      <td className="text-right p-2">{fmtEur(m.interestCosts)}</td>
                      <td className="text-right p-2">{fmtEur(m.otherCosts)}</td>
                      <td className="text-right p-2 font-medium">{fmtEur(m.totalCosts)}</td>
                      <td className={`text-right p-2 font-bold ${m.result >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtEur(m.result)}
                      </td>
                      <td className={`text-right p-2 font-medium ${m.cumResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtEur(m.cumResult)}
                      </td>
                      <td className="text-center p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteMutation.mutate(m.id)}
                          data-testid={`button-delete-bwa-${m.id}`}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td className="p-2">GESAMT</td>
                    <td className="text-right p-2">{fmtEur(totalRevenue)}</td>
                    <td className="text-right p-2">{fmtEur(monthlyData.reduce((s, m) => s + Number(m.materialCosts || 0), 0))}</td>
                    <td className="text-right p-2">{fmtEur(monthlyData.reduce((s, m) => s + Number(m.personnelCosts || 0), 0))}</td>
                    <td className="text-right p-2">{fmtEur(monthlyData.reduce((s, m) => s + Number(m.vehicleCosts || 0), 0))}</td>
                    <td className="text-right p-2">{fmtEur(monthlyData.reduce((s, m) => s + Number(m.operatingCosts || 0), 0))}</td>
                    <td className="text-right p-2">{fmtEur(monthlyData.reduce((s, m) => s + Number(m.depreciation || 0), 0))}</td>
                    <td className="text-right p-2">{fmtEur(monthlyData.reduce((s, m) => s + Number(m.interestCosts || 0), 0))}</td>
                    <td className="text-right p-2">{fmtEur(monthlyData.reduce((s, m) => s + Number(m.otherCosts || 0), 0))}</td>
                    <td className="text-right p-2">{fmtEur(totalCosts)}</td>
                    <td className={`text-right p-2 ${totalResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtEur(totalResult)}
                    </td>
                    <td className="text-right p-2"></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {reports.length > 0 && (
            <Card className="bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">Hinweis</p>
                    <p>Die BWA-Daten stammen vom Steuerberater und zeigen das tatsächliche Betriebsergebnis (IST).
                    Bei einem erneuten Import für denselben Monat werden die Werte automatisch aktualisiert.
                    Die Quelldatei wird gespeichert: <strong>{reports[0]?.sourceFileName || '-'}</strong></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
