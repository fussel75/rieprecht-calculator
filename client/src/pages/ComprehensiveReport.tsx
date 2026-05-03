import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Send, Printer, Loader2, BarChart3, TrendingUp, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MaterialCalc {
  materialName: string;
  avvNumber: string;
  density: number;
  containerSize: number;
  weight: number;
  transportCost: number;
  disposalCost: number;
  fixedCostPerContainer: number;
  baseCost: number;
  listPriceTonne: number | null;
  listPriceM3: number | null;
  listPrice: number | null;
  marketPriceNet: number | null;
  marketPriceGross: number | null;
  realMargin: number | null;
  realMarginPercent: number | null;
  marginForListPrice: number | null;
}

interface ScenarioResult {
  label: string;
  monthlyVehicleCosts: number;
  monthlyEmployeeCosts: number;
  monthlyOperatingCosts: number;
  monthlyLoanCosts: number;
  totalMonthlyFixed: number;
  containersPerDay: number;
  containersPerMonth: number;
  fixedCostPerContainer: number;
  vehicleDetails: { name: string; monthly: number }[];
  employeeDetails: { name: string; monthly: number }[];
  calculations7: MaterialCalc[];
  calculations10: MaterialCalc[];
  breakEvenContainersPerMonth: number;
  breakEvenContainersPerDay: number;
}

interface ProfitProjection {
  containersPerDay: number;
  containersPerMonth: number;
  monthlyRevenue: number;
  monthlyVariableCosts: number;
  monthlyFixedCosts: number;
  monthlyProfit: number;
  annualProfit: number;
}

interface ReportData {
  generatedAt: string;
  customerName: string;
  customerNumber: string;
  distance: number;
  workDaysPerMonth: number;
  transportCostPerTrip: number;
  ist: ScenarioResult;
  soll: ScenarioResult;
  profitProjectionsIst: ProfitProjection[];
  profitProjectionsSoll: ProfitProjection[];
  avgListPrice7: number;
  avgListPrice10: number;
}

export default function ComprehensiveReport() {
  const [distance, setDistance] = useState(15);
  const [email, setEmail] = useState("ronny.friedrich@rieprecht-gmbh.de");
  const { toast } = useToast();

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/report/data", distance],
    queryFn: async () => {
      const res = await fetch(`/api/report/data?distance=${distance}`);
      return res.json();
    },
  });

  const { mutate: sendEmail, isPending: isSending } = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/report/send-email", { email, distance });
    },
    onSuccess: () => {
      toast({ title: "Versendet", description: `Bericht wurde an ${email} gesendet.` });
    },
    onError: () => {
      toast({ title: "Fehler", description: "E-Mail konnte nicht gesendet werden.", variant: "destructive" });
    },
  });

  const handlePrint = () => {
    window.open(`/api/report/html?distance=${distance}`, '_blank');
  };

  if (isLoading || !report) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <PageHeader title="Kalkulationsvergleich" description="Umfassender Bericht wird generiert..." />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const marginColor = (pct: number | null) => {
    if (pct === null) return 'text-muted-foreground';
    if (pct >= 30) return 'text-green-600 dark:text-green-400';
    if (pct >= 15) return 'text-yellow-600 dark:text-yellow-400';
    if (pct >= 0) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const profitColor = (val: number) => val >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const profitBg = (val: number) => val >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30';

  return (
    <div className="space-y-6 animate-fade-in-up print:space-y-4">
      <div className="print:hidden">
        <PageHeader 
          title="Kalkulationsvergleich" 
          description="Umfassender Bericht mit Marktanalyse, Break-even und Gewinnprognosen"
          action={
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="outline" data-testid="button-print-report">
                <Printer className="mr-2 h-4 w-4" /> PDF / Drucken
              </Button>
              <Button onClick={() => sendEmail()} disabled={isSending || !email} data-testid="button-send-report">
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Per E-Mail senden
              </Button>
            </div>
          }
        />
      </div>

      {/* Controls */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>Entfernung (km einfach)</Label>
              <Input type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} className="w-32" data-testid="input-report-distance" />
            </div>
            <div className="flex-1 min-w-[250px]">
              <Label>E-Mail-Empfänger</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="ronny.friedrich@rieprecht-gmbh.de" data-testid="input-report-email" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cover */}
      <div className="text-center py-8 border-b-4 border-foreground print:py-12">
        <p className="text-xs text-muted-foreground uppercase tracking-[3px] mb-2">Rieprecht GmbH · Containerdienst Hamburg</p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2" data-testid="text-report-title">Umfassender Kalkulationsvergleich</h1>
        <p className="text-muted-foreground text-lg">mit Marktanalyse, Break-even und Gewinnprognosen</p>
        <div className="inline-block mt-6 bg-secondary/50 rounded-lg px-6 py-3 text-left text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <span className="text-muted-foreground">Erstellt am:</span><span className="font-semibold">{report.generatedAt}</span>
            <span className="text-muted-foreground">Referenzkunde:</span><span className="font-semibold">{report.customerName}</span>
            <span className="text-muted-foreground">Kundennummer:</span><span className="font-semibold">{report.customerNumber}</span>
            <span className="text-muted-foreground">Entfernung:</span><span className="font-semibold">{distance} km (einfach)</span>
            <span className="text-muted-foreground">Arbeitstage/Monat:</span><span className="font-semibold">{report.workDaysPerMonth}</span>
          </div>
        </div>
      </div>

      {/* Kalkulationsweg */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold border-b-2 border-foreground pb-2 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" /> Kalkulationsweg
          </h2>
          <div className="bg-secondary/30 rounded-lg p-4 text-sm space-y-3">
            <p>Die Preiskalkulation basiert auf drei Kostenblöcken:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong>Transportkosten</strong> = (Verbrauch/100km × Dieselpreis + Maut/km) × Entfernung × 2
                <span className="block text-muted-foreground text-xs mt-1">= {formatCurrency(report.transportCostPerTrip)} pro Fahrt</span>
              </li>
              <li>
                <strong>Entsorgungskosten</strong> = Gewicht(t) × Entsorgungspreis/t + Zuschläge
                <span className="block text-muted-foreground text-xs mt-1">Variiert je nach Abfallart und Containergröße</span>
              </li>
              <li>
                <strong>Fixkostenanteil</strong> = Monatliche Gesamtfixkosten ÷ Container pro Monat
                <span className="block text-muted-foreground text-xs mt-1">Fahrzeuge + Personal + Betrieb + Darlehenszinsen</span>
              </li>
            </ol>
            <div className="bg-primary/10 rounded p-3 mt-3">
              <strong>Selbstkosten</strong> = Transport + Entsorgung + Fixkostenanteil<br/>
              <strong>Ist-Marge</strong> = Listenpreis − Selbstkosten (tatsächlicher Gewinn bei Listenpreis-Verkauf)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kostenstruktur IST vs SOLL */}
      <Card className="print:break-before-page">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold border-b-2 border-foreground pb-2 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Kostenstruktur: IST vs. SOLL
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* IST */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-500 rounded-lg p-4">
              <h3 className="font-bold text-blue-800 dark:text-blue-300 text-lg mb-3">IST (aktuell)</h3>
              <div className="space-y-1 text-sm">
                {report.ist.vehicleDetails.map((v, i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">🚛 {v.name}</span><span className="font-medium">{formatCurrency(v.monthly)}</span></div>
                ))}
                <div className="flex justify-between border-t border-blue-300 pt-1 font-semibold"><span>Fahrzeuge gesamt</span><span>{formatCurrency(report.ist.monthlyVehicleCosts)}</span></div>
                <div className="pt-2" />
                {report.ist.employeeDetails.map((e, i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">👤 {e.name}</span><span className="font-medium">{formatCurrency(e.monthly)}</span></div>
                ))}
                <div className="flex justify-between border-t border-blue-300 pt-1 font-semibold"><span>Personal gesamt</span><span>{formatCurrency(report.ist.monthlyEmployeeCosts)}</span></div>
                <div className="pt-2" />
                <div className="flex justify-between"><span className="text-muted-foreground">Betriebskosten</span><span className="font-medium">{formatCurrency(report.ist.monthlyOperatingCosts)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Darlehenszinsen</span><span className="font-medium">{formatCurrency(report.ist.monthlyLoanCosts)}</span></div>
                <div className="flex justify-between border-t-2 border-blue-700 pt-2 mt-2 text-blue-800 dark:text-blue-200">
                  <span className="font-bold text-base">GESAMT / Monat</span>
                  <span className="font-extrabold text-lg" data-testid="text-ist-total">{formatCurrency(report.ist.totalMonthlyFixed)}</span>
                </div>
              </div>
            </div>

            {/* SOLL */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500 rounded-lg p-4">
              <h3 className="font-bold text-amber-800 dark:text-amber-300 text-lg mb-3">SOLL (ab 07/2026)</h3>
              <div className="space-y-1 text-sm">
                {report.soll.vehicleDetails.map((v, i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">🚛 {v.name}</span><span className="font-medium">{formatCurrency(v.monthly)}</span></div>
                ))}
                <div className="flex justify-between border-t border-amber-300 pt-1 font-semibold"><span>Fahrzeuge gesamt</span><span>{formatCurrency(report.soll.monthlyVehicleCosts)}</span></div>
                <div className="pt-2" />
                {report.soll.employeeDetails.map((e, i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">👤 {e.name}</span><span className="font-medium">{formatCurrency(e.monthly)}</span></div>
                ))}
                <div className="flex justify-between border-t border-amber-300 pt-1 font-semibold"><span>Personal gesamt</span><span>{formatCurrency(report.soll.monthlyEmployeeCosts)}</span></div>
                <div className="pt-2" />
                <div className="flex justify-between"><span className="text-muted-foreground">Betriebskosten</span><span className="font-medium">{formatCurrency(report.soll.monthlyOperatingCosts)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Darlehenszinsen</span><span className="font-medium">{formatCurrency(report.soll.monthlyLoanCosts)}</span></div>
                <div className="flex justify-between border-t-2 border-amber-700 pt-2 mt-2 text-amber-800 dark:text-amber-200">
                  <span className="font-bold text-base">GESAMT / Monat</span>
                  <span className="font-extrabold text-lg" data-testid="text-soll-total">{formatCurrency(report.soll.totalMonthlyFixed)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 bg-red-50 dark:bg-red-950/30 border border-red-300 rounded-lg p-3 text-sm">
            <strong>Mehrkosten SOLL vs. IST:</strong>{' '}
            <span className="text-red-600 dark:text-red-400 font-bold">
              {formatCurrency(report.soll.totalMonthlyFixed - report.ist.totalMonthlyFixed)}
            </span>{' '}
            pro Monat (+ neuer LKW MAN TGS 26.440 und Fahrer 2)
          </div>
        </CardContent>
      </Card>

      {/* Price Comparison Tables */}
      {[
        { calcs: report.ist.calculations7, title: 'Preisvergleich 7m³ Container – IST' },
        { calcs: report.ist.calculations10, title: 'Preisvergleich 10m³ Container – IST' },
        { calcs: report.soll.calculations7, title: 'Preisvergleich 7m³ Container – SOLL (ab 07/2026)' },
        { calcs: report.soll.calculations10, title: 'Preisvergleich 10m³ Container – SOLL (ab 07/2026)' },
      ].map((section, idx) => (
        <Card key={idx} className="print:break-before-page overflow-x-auto">
          <CardContent className="pt-6">
            <h2 className="text-lg font-bold border-b-2 border-foreground pb-2 mb-2">{section.title}</h2>
            <p className="text-xs text-muted-foreground mb-3">Kunde: {report.customerName} | Entfernung: {distance} km | Transport: {formatCurrency(report.transportCostPerTrip)}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" data-testid={`table-${idx}`}>
                <thead>
                  <tr className="bg-foreground text-background">
                    <th className="px-2 py-2 text-left border border-border/30">Abfallart</th>
                    <th className="px-2 py-2 text-right border border-border/30">Gewicht (t)</th>
                    <th className="px-2 py-2 text-right border border-border/30">Kalkulation</th>
                    <th className="px-2 py-2 text-right border border-border/30">Listenpreis</th>
                    <th className="px-2 py-2 text-right border border-border/30">Marktpreis</th>
                    <th className="px-2 py-2 text-right border border-border/30">Ist-Marge</th>
                    <th className="px-2 py-2 text-right border border-border/30">Marge %</th>
                  </tr>
                </thead>
                <tbody>
                  {section.calcs.map((c, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-secondary/20' : ''}>
                      <td className="px-2 py-1.5 border border-border/20 font-medium">{c.materialName}</td>
                      <td className="px-2 py-1.5 text-right border border-border/20">{c.weight.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                      <td className="px-2 py-1.5 text-right border border-border/20 font-semibold">{formatCurrency(c.baseCost)}</td>
                      <td className="px-2 py-1.5 text-right border border-border/20 font-semibold text-blue-600 dark:text-blue-400">{c.listPrice !== null ? formatCurrency(c.listPrice) : '—'}</td>
                      <td className="px-2 py-1.5 text-right border border-border/20 text-purple-600 dark:text-purple-400">{c.marketPriceNet !== null ? formatCurrency(c.marketPriceNet) : '—'}</td>
                      <td className={`px-2 py-1.5 text-right border border-border/20 font-semibold ${profitColor(c.realMargin || 0)}`}>{c.realMargin !== null ? formatCurrency(c.realMargin) : '—'}</td>
                      <td className={`px-2 py-1.5 text-right border border-border/20 font-bold ${marginColor(c.realMarginPercent)}`}>{c.realMarginPercent !== null ? c.realMarginPercent.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Kalkulation = Selbstkosten (Transport + Entsorgung + Fixkostenanteil) | Listenpreis = Rieprecht Verkaufspreis | Marktpreis = Ø Hamburg | Ist-Marge = Listenpreis − Kalkulation
            </p>
          </CardContent>
        </Card>
      ))}

      {/* Break-even */}
      <Card className="print:break-before-page">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold border-b-2 border-foreground pb-2 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" /> Break-even-Analyse
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Wie viele Container pro Tag müssen gefahren werden, um alle Fixkosten zu decken?</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-500 rounded-lg p-6 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">IST Break-even</p>
              <p className="text-4xl font-extrabold text-blue-800 dark:text-blue-200" data-testid="text-ist-breakeven">
                {report.ist.breakEvenContainersPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </p>
              <p className="text-sm font-semibold text-blue-600">Container / Tag</p>
              <p className="text-xs text-muted-foreground mt-1">({Math.ceil(report.ist.breakEvenContainersPerMonth)} / Monat)</p>
              <p className="text-xs text-muted-foreground mt-2">Fixkosten: {formatCurrency(report.ist.totalMonthlyFixed)} / Monat</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500 rounded-lg p-6 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">SOLL Break-even</p>
              <p className="text-4xl font-extrabold text-amber-800 dark:text-amber-200" data-testid="text-soll-breakeven">
                {report.soll.breakEvenContainersPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </p>
              <p className="text-sm font-semibold text-amber-600">Container / Tag</p>
              <p className="text-xs text-muted-foreground mt-1">({Math.ceil(report.soll.breakEvenContainersPerMonth)} / Monat)</p>
              <p className="text-xs text-muted-foreground mt-2">Fixkosten: {formatCurrency(report.soll.totalMonthlyFixed)} / Monat</p>
            </div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
            <p><strong>Kapazitätsgrenzen (gesetzlich/praktisch):</strong></p>
            <p>• 1 LKW ohne Anhänger: ca. 8–9 Container/Tag (Spitzenwert)</p>
            <p>• 1 LKW mit Anhänger: ca. 12–14 Container/Tag (selten erreichbar)</p>
            <p>• Begrenzung durch Lenkzeiten (max. 9h/Tag lt. FahrPersV)</p>
          </div>
        </CardContent>
      </Card>

      {/* Gewinnprognosen */}
      <Card className="print:break-before-page">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold border-b-2 border-foreground pb-2 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Gewinnprognosen
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Monatlicher und jährlicher Gewinn bei unterschiedlicher Auslastung ({report.workDaysPerMonth} Arbeitstage/Monat)</p>

          <h3 className="font-bold text-blue-800 dark:text-blue-300 text-base mb-2">IST-Szenario (aktuelle Ressourcen)</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-800 text-white">
                  <th className="px-2 py-2 text-center border border-blue-700">Container/Tag</th>
                  <th className="px-2 py-2 text-center border border-blue-700">Container/Monat</th>
                  <th className="px-2 py-2 text-right border border-blue-700">Umsatz/Monat</th>
                  <th className="px-2 py-2 text-right border border-blue-700">Var. Kosten</th>
                  <th className="px-2 py-2 text-right border border-blue-700">Fixkosten</th>
                  <th className="px-2 py-2 text-right border border-blue-700 font-bold">Gewinn/Monat</th>
                  <th className="px-2 py-2 text-right border border-blue-700 font-bold">Gewinn/Jahr</th>
                </tr>
              </thead>
              <tbody>
                {report.profitProjectionsIst.map((p, i) => (
                  <tr key={i} className={profitBg(p.monthlyProfit)}>
                    <td className="px-2 py-1.5 text-center border border-border/20 font-semibold">{p.containersPerDay}</td>
                    <td className="px-2 py-1.5 text-center border border-border/20">{p.containersPerMonth}</td>
                    <td className="px-2 py-1.5 text-right border border-border/20">{formatCurrency(p.monthlyRevenue)}</td>
                    <td className="px-2 py-1.5 text-right border border-border/20">{formatCurrency(p.monthlyVariableCosts)}</td>
                    <td className="px-2 py-1.5 text-right border border-border/20">{formatCurrency(p.monthlyFixedCosts)}</td>
                    <td className={`px-2 py-1.5 text-right border border-border/20 font-bold ${profitColor(p.monthlyProfit)}`}>{formatCurrency(p.monthlyProfit)}</td>
                    <td className={`px-2 py-1.5 text-right border border-border/20 font-bold ${profitColor(p.annualProfit)}`}>{formatCurrency(p.annualProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-bold text-amber-800 dark:text-amber-300 text-base mb-2">SOLL-Szenario (ab 07/2026 mit neuem LKW + Fahrer)</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-800 text-white">
                  <th className="px-2 py-2 text-center border border-amber-700">Container/Tag</th>
                  <th className="px-2 py-2 text-center border border-amber-700">Container/Monat</th>
                  <th className="px-2 py-2 text-right border border-amber-700">Umsatz/Monat</th>
                  <th className="px-2 py-2 text-right border border-amber-700">Var. Kosten</th>
                  <th className="px-2 py-2 text-right border border-amber-700">Fixkosten</th>
                  <th className="px-2 py-2 text-right border border-amber-700 font-bold">Gewinn/Monat</th>
                  <th className="px-2 py-2 text-right border border-amber-700 font-bold">Gewinn/Jahr</th>
                </tr>
              </thead>
              <tbody>
                {report.profitProjectionsSoll.map((p, i) => (
                  <tr key={i} className={profitBg(p.monthlyProfit)}>
                    <td className="px-2 py-1.5 text-center border border-border/20 font-semibold">{p.containersPerDay}</td>
                    <td className="px-2 py-1.5 text-center border border-border/20">{p.containersPerMonth}</td>
                    <td className="px-2 py-1.5 text-right border border-border/20">{formatCurrency(p.monthlyRevenue)}</td>
                    <td className="px-2 py-1.5 text-right border border-border/20">{formatCurrency(p.monthlyVariableCosts)}</td>
                    <td className="px-2 py-1.5 text-right border border-border/20">{formatCurrency(p.monthlyFixedCosts)}</td>
                    <td className={`px-2 py-1.5 text-right border border-border/20 font-bold ${profitColor(p.monthlyProfit)}`}>{formatCurrency(p.monthlyProfit)}</td>
                    <td className={`px-2 py-1.5 text-right border border-border/20 font-bold ${profitColor(p.annualProfit)}`}>{formatCurrency(p.annualProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
            <strong>Berechnungsgrundlage:</strong> Ø-Listenpreis über alle Abfallarten (7m³: {formatCurrency(report.avgListPrice7)}, 10m³: {formatCurrency(report.avgListPrice10)}).
            Gewinn = Umsatz − variable Kosten − Fixkosten.
          </div>
        </CardContent>
      </Card>

      {/* Zusammenfassung */}
      <Card className="print:break-before-page">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold border-b-2 border-foreground pb-2 mb-4">Zusammenfassung & Fazit</h2>
          
          <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-xl p-6 mb-4">
            <h3 className="text-amber-400 font-bold text-lg mb-4">Kernaussagen</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase">IST Break-even</p>
                <p className="text-3xl font-extrabold text-blue-300">
                  {report.ist.breakEvenContainersPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </p>
                <p className="text-sm text-gray-300">Container/Tag</p>
                <p className="text-xs text-gray-400 mt-1">bei {formatCurrency(report.ist.totalMonthlyFixed)} Fixkosten/Monat</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase">SOLL Break-even</p>
                <p className="text-3xl font-extrabold text-amber-300">
                  {report.soll.breakEvenContainersPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </p>
                <p className="text-sm text-gray-300">Container/Tag</p>
                <p className="text-xs text-gray-400 mt-1">bei {formatCurrency(report.soll.totalMonthlyFixed)} Fixkosten/Monat</p>
              </div>
              {(() => {
                const p6 = report.profitProjectionsIst.find(p => p.containersPerDay === 6);
                if (!p6) return null;
                return (
                  <div className="bg-white/10 rounded-lg p-4">
                    <p className="text-xs text-gray-400 uppercase">IST Gewinn bei 6/Tag</p>
                    <p className={`text-3xl font-extrabold ${p6.monthlyProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {formatCurrency(p6.monthlyProfit)}
                    </p>
                    <p className="text-sm text-gray-300">pro Monat</p>
                    <p className="text-xs text-gray-400 mt-1">{formatCurrency(p6.annualProfit)} / Jahr</p>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500 rounded-lg p-4 mb-4">
            <h4 className="text-amber-800 dark:text-amber-300 font-bold mb-2">Bewertung der Erweiterung (ab 07/2026)</h4>
            <ul className="text-sm text-amber-900 dark:text-amber-200 space-y-1 list-disc pl-5">
              <li>Monatliche Mehrkosten: <strong>{formatCurrency(report.soll.totalMonthlyFixed - report.ist.totalMonthlyFixed)}</strong></li>
              <li>Break-even steigt von <strong>{report.ist.breakEvenContainersPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1 })}</strong> auf <strong>{report.soll.breakEvenContainersPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1 })}</strong> Container/Tag</li>
              {(() => {
                const p8 = report.profitProjectionsSoll.find(p => p.containersPerDay === 8);
                if (!p8) return null;
                return <li>Bei 8 Container/Tag (realistisch mit 2 LKW): <strong className={profitColor(p8.monthlyProfit)}>{formatCurrency(p8.monthlyProfit)}/Monat</strong></li>;
              })()}
              {(() => {
                const p12 = report.profitProjectionsSoll.find(p => p.containersPerDay === 12);
                if (!p12) return null;
                return <li>Bei 12 Container/Tag (mit Anhänger): <strong className={profitColor(p12.monthlyProfit)}>{formatCurrency(p12.monthlyProfit)}/Monat</strong></li>;
              })()}
              <li>Die Erweiterung lohnt sich bei dauerhaft mehr als <strong>{report.soll.breakEvenContainersPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1 })} Container/Tag</strong></li>
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-950/30 border border-green-300 rounded-lg p-3 text-sm text-green-800 dark:text-green-300">
            <strong>Empfehlung:</strong> Vor der Erweiterung sollte die Nachfrage gesichert sein. 
            Der Break-even von {report.soll.breakEvenContainersPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1 })} Containern/Tag ist realistisch erreichbar, 
            erfordert aber eine stabile Auftragslage. Die Preise liegen im Marktvergleich Hamburg im Wettbewerbsbereich.
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-4 border-t-2 border-border text-xs text-muted-foreground">
        <p>Rieprecht GmbH · Containerdienst Hamburg</p>
        <p>Generiert am {report.generatedAt}. Alle Preise in EUR netto (sofern nicht anders angegeben).</p>
        <p className="text-[10px]">Berechnungsgrundlage: Jahresabschluss 2025, aktuelle Betriebsdaten und Marktpreise Region Hamburg</p>
      </div>

      {/* Send Email Action (bottom) */}
      <div className="print:hidden flex justify-center gap-3 py-6">
        <Button onClick={handlePrint} variant="outline" size="lg" data-testid="button-print-bottom">
          <Printer className="mr-2 h-4 w-4" /> PDF / Drucken
        </Button>
        <Button onClick={() => sendEmail()} disabled={isSending || !email} size="lg" data-testid="button-send-bottom">
          {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Bericht an {email} senden
        </Button>
      </div>
    </div>
  );
}
