import { useCostVariables } from "@/hooks/use-cost-variables";
import { usePlanningSettings } from "@/hooks/use-planning";
import { useVehicles, useEmployees, useLoans } from "@/hooks/use-resources";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, Truck, TrendingUp, Fuel, ArrowRight, Wrench, Euro } from "lucide-react";
import { Link } from "wouter";
import type { Loan } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

export default function Dashboard() {
  const { data: variables } = useCostVariables();
  const { data: settings } = usePlanningSettings();
  const { data: vehicles } = useVehicles();
  const { data: employees } = useEmployees();
  const { data: loans } = useLoans();

  const dieselPrice = variables?.find(v => v.name === "Diesel Preis")?.value || "0";

  const calcMonthlyLoanCost = (loan: Loan) => {
    const amount = Number(loan.amount || 0);
    const repayment = Number(loan.repaymentPercent || 0);
    const interest = Number(loan.interestPercent || 0);
    return ((amount * repayment / 100) + (amount * interest / 100)) / 12;
  };
  
  // Helper: Check if a resource has already started (date is in the past or today)
  const hasStarted = (dateStr: string | null | undefined) => {
    if (!dateStr) return true;
    const startDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    return startDate <= today;
  };

  // Fahrzeugkosten (nur aktive, bereits gestartete)
  const monthlyVehicleCosts = vehicles?.filter(v => v.isActive && hasStarted(v.purchaseDate)).reduce((sum, v) => 
    sum + Number(v.monthlyLeaseCost || 0) + Number(v.monthlyInsurance || 0) + Number(v.monthlyMaintenance || 0), 0) || 0;
  
  // Personalkosten (nur aktive, bereits gestartete) - inkl. steuerfreie Zulagen
  const monthlyEmployeeCosts = employees?.filter(e => e.isActive && hasStarted(e.hireDate)).reduce((sum, e) => 
    sum + Number(e.monthlySalary || 0) + Number(e.taxFreeAllowance || 0), 0) || 0;
  
  // Betriebskosten aus cost_variables (alle monatlichen Kosten)
  const monthlyOperatingCosts = variables
    ?.filter(v => v.unit === 'per_month')
    ?.reduce((sum, v) => sum + Number(v.value), 0) || 0;
  
  // Darlehenskosten (Tilgung + Zinsen)
  const monthlyLoanCosts = loans?.filter(l => l.isActive && (!l.endDate || new Date(l.endDate) >= new Date())).reduce((sum, l) => 
    sum + calcMonthlyLoanCost(l), 0) || 0;
  
  // Gesamt-Fixkosten = Fahrzeuge + Personal + Betriebskosten + Darlehen
  const monthlyFixCosts = monthlyVehicleCosts + monthlyEmployeeCosts + monthlyOperatingCosts + monthlyLoanCosts;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
      <PageHeader 
        title="Container Kalkulator" 
        description="Interne Preiskalkulation für Ihren Containerdienst"
      />

      {/* Hero Card - Calculator CTA */}
      <Card className="bg-industrial-gradient text-white border-none shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9Ii4wNSIvPjwvZz48L3N2Zz4=')] opacity-30" />
        <CardContent className="py-8 sm:py-10 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Neue Kalkulation</h2>
              <p className="text-white/70 mt-2 text-sm sm:text-base max-w-md">
                Berechnen Sie Preise basierend auf Ihren aktuellen Betriebskosten und Zielmargen
              </p>
            </div>
            <Link href="/calculator">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-lg font-semibold w-full sm:w-auto">
                <Calculator className="mr-2 h-5 w-5" />
                Zum Rechner
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard 
          href="/planning"
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          label="Zielmarge"
          value={`${settings?.targetMarginPercent || 15}%`}
          subtext="Gewinnaufschlag"
        />
        <KPICard 
          href="/costs"
          icon={<Fuel className="w-5 h-5" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
          label="Diesel"
          value={formatCurrency(Number(dieselPrice))}
          subtext="pro Liter"
        />
        <KPICard 
          href="/costs"
          icon={<Euro className="w-5 h-5" />}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          label="Fixkosten"
          value={formatCurrency(monthlyFixCosts)}
          subtext="pro Monat"
        />
        <KPICard 
          href="/planning"
          icon={<Truck className="w-5 h-5" />}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          label="Kapazität"
          value={`${settings?.containersPerDay || 5}/Tag`}
          subtext={`${settings?.activeTrucks || 1} LKW`}
        />
      </div>

      {/* Quick Links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink 
          href="/costs"
          icon={<Euro className="w-5 h-5" />}
          title="Betriebskosten"
          description="Kosten anpassen"
        />
        <QuickLink 
          href="/materials"
          icon={<Wrench className="w-5 h-5" />}
          title="Abfallarten"
          description="Dichten & Preise"
        />
        <QuickLink 
          href="/planning"
          icon={<TrendingUp className="w-5 h-5" />}
          title="Planung"
          description="Prognose & Ziele"
        />
      </div>
    </div>
  );
}

function KPICard({ href, icon, iconBg, iconColor, label, value, subtext }: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <Link href={href}>
      <Card className="border-border/50 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer h-full">
        <CardContent className="p-4 sm:p-5">
          <div className={`w-10 h-10 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center mb-3`}>
            {icon}
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({ href, icon, title, description }: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="border-border/50 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group h-full">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </CardContent>
      </Card>
    </Link>
  );
}
