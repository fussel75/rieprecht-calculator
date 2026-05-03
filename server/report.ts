import { storage } from "./storage";
import type { Material, CostVariable, Vehicle, Employee, Loan, LoanPayment, SalesPrice, MarketPrice, PlanningSettings, Customer, ForecastParams, PurchaseSurcharge, SalesSurcharge } from "@shared/schema";
import { calcPurchaseSurchargeTotal, calcSalesSurchargeTotal } from "./surchargeCalc";

function fmt(value: number, decimals = 2): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtNum(value: number, decimals = 1): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function normalizeAvv(avv: string | null | undefined): string {
  if (!avv) return '';
  return avv.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function hasStarted(dateStr: string | null | undefined, referenceDate: Date): boolean {
  if (!dateStr) return true;
  const startDate = new Date(dateStr);
  startDate.setHours(0, 0, 0, 0);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return startDate <= ref;
}

function calcMonthlyDepreciation(purchaseCost: string | null | undefined, years: number | null | undefined): number {
  const cost = Number(purchaseCost || 0);
  const depYears = years || 10;
  return Math.round(cost / (depYears * 12) * 100) / 100;
}

function calcMonthlyLoanCost(loan: Loan): number {
  const amount = Number(loan.amount || 0);
  const repayment = Number(loan.repaymentPercent || 0);
  const interest = Number(loan.interestPercent || 0);
  return ((amount * repayment / 100) + (amount * interest / 100)) / 12;
}

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

export interface ReportData {
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

function computeScenario(
  label: string,
  includeAll: boolean,
  materials: Material[],
  variables: CostVariable[],
  vehicles: Vehicle[],
  employees: Employee[],
  loans: Loan[],
  salesPrices: SalesPrice[],
  marketPrices: MarketPrice[],
  settings: PlanningSettings,
  distance: number,
  today: Date,
  purchaseSurcharges: PurchaseSurcharge[] = [],
  salesSurchargesAll: SalesSurcharge[] = []
): ScenarioResult {
  const dieselPrice = Number(variables.find(v => v.name === "Diesel Preis")?.value || 1.70);
  const fuelConsumption = Number(variables.find(v => v.name === "Verbrauch (L/100km)")?.value || 35);
  const tollPerKm = Number(variables.find(v => v.name === "Maut / Gebühren")?.value || 0.19);
  const containerPickupPrice = 135;

  const activeVehicles = vehicles.filter(v => v.isActive && (includeAll || hasStarted(v.purchaseDate, today)));
  const activeEmployees = employees.filter(e => e.isActive && (includeAll || hasStarted(e.hireDate, today)));
  const activeLoans = loans.filter(l => l.isActive && (!l.endDate || new Date(l.endDate) >= today));

  const vehicleDetails = activeVehicles.map(v => {
    const monthly = Number(v.monthlyLeaseCost || 0) + Number(v.monthlyInsurance || 0) + Number(v.monthlyMaintenance || 0) + calcMonthlyDepreciation(v.purchaseCost, v.depreciationYears);
    return { name: v.name, monthly };
  });

  const employeeDetails = activeEmployees.map(e => {
    const monthly = Number(e.monthlySalary || 0) + Number(e.taxFreeAllowance || 0);
    return { name: e.name, monthly };
  });

  const monthlyVehicleCosts = vehicleDetails.reduce((s, v) => s + v.monthly, 0);
  const monthlyEmployeeCosts = employeeDetails.reduce((s, e) => s + e.monthly, 0);
  const monthlyOperatingCosts = variables.filter(v => v.unit === 'per_month').reduce((s, v) => s + Number(v.value), 0);
  const monthlyLoanCosts = activeLoans.reduce((s, l) => s + calcMonthlyLoanCost(l), 0);
  const totalMonthlyFixed = monthlyVehicleCosts + monthlyEmployeeCosts + monthlyOperatingCosts + monthlyLoanCosts;

  const workDays = settings.workDaysPerMonth || 20;
  const containersPerDay = settings.containersPerDay || 6;
  const containersPerMonth = workDays * containersPerDay;
  const fixedCostPerContainer = containersPerMonth > 0 ? totalMonthlyFixed / containersPerMonth : 0;

  const fuelCostPerKm = (fuelConsumption / 100) * dieselPrice;
  const transportCost = (fuelCostPerKm + tollPerKm) * distance * 2;

  function calcForSize(size: number): MaterialCalc[] {
    return materials.filter(m => m.isActive).map(mat => {
      const density = Number(mat.density || 0);
      const weight = size * density;
      const disposalRate = Number(mat.disposalCostPerTonne || 0);
      const matchingSP = salesPrices.find(sp => normalizeAvv(sp.avvCode) === normalizeAvv(mat.avvNumber));
      const isDangerous = matchingSP?.isDangerous || false;
      const purchSurcharge = calcPurchaseSurchargeTotal(mat.purchaseSurchargeIds, purchaseSurcharges, "m3", weight, size, isDangerous);
      const disposalCost = (weight * disposalRate) + purchSurcharge;
      const baseCost = transportCost + disposalCost + fixedCostPerContainer;

      const sSurchargeTonne = calcSalesSurchargeTotal(matchingSP?.salesSurchargeIds, salesSurchargesAll, "tonne", weight, size, isDangerous);
      const sSurchargeM3 = calcSalesSurchargeTotal(matchingSP?.salesSurchargeIds, salesSurchargesAll, "m3", weight, size, isDangerous);

      let listPriceTonne: number | null = null;
      if (matchingSP?.pricePerTonne && weight > 0) {
        listPriceTonne = Number(matchingSP.pricePerTonne) * weight + sSurchargeTonne + containerPickupPrice;
      }

      let listPriceM3: number | null = null;
      if (matchingSP?.pricePerCubicMeter && size > 0) {
        listPriceM3 = Number(matchingSP.pricePerCubicMeter) * size + sSurchargeM3 + containerPickupPrice;
      }

      const listPrice = listPriceM3 ?? listPriceTonne ?? null;

      const matchingMP = marketPrices.find(p => p.materialCategory === mat.name && p.containerSizeM3 === size);
      const marketPriceNet = matchingMP ? Number(matchingMP.priceNet) : null;
      const marketPriceGross = matchingMP ? Number(matchingMP.priceGross) : null;

      let realMargin: number | null = null;
      let realMarginPercent: number | null = null;
      let marginForListPrice: number | null = null;
      if (listPrice !== null && baseCost > 0) {
        realMargin = listPrice - baseCost;
        realMarginPercent = (realMargin / baseCost) * 100;
        marginForListPrice = realMarginPercent;
      }

      return {
        materialName: mat.name,
        avvNumber: mat.avvNumber || '',
        density,
        containerSize: size,
        weight,
        transportCost,
        disposalCost,
        fixedCostPerContainer,
        baseCost,
        listPriceTonne,
        listPriceM3,
        listPrice,
        marketPriceNet,
        marketPriceGross,
        realMargin,
        realMarginPercent,
        marginForListPrice,
      };
    });
  }

  const calculations7 = calcForSize(7);
  const calculations10 = calcForSize(10);

  const allCalcs = [...calculations7, ...calculations10];
  const calcsWithListPrice = allCalcs.filter(c => c.listPrice !== null && c.listPrice > 0);
  const avgNetProfitPerContainer = calcsWithListPrice.length > 0
    ? calcsWithListPrice.reduce((s, c) => s + (c.listPrice! - c.transportCost - c.disposalCost), 0) / calcsWithListPrice.length
    : 0;

  const breakEvenContainersPerMonth = avgNetProfitPerContainer > 0 ? totalMonthlyFixed / avgNetProfitPerContainer : 0;
  const breakEvenContainersPerDay = workDays > 0 ? breakEvenContainersPerMonth / workDays : 0;

  return {
    label,
    monthlyVehicleCosts,
    monthlyEmployeeCosts,
    monthlyOperatingCosts,
    monthlyLoanCosts,
    totalMonthlyFixed,
    containersPerDay,
    containersPerMonth,
    fixedCostPerContainer,
    vehicleDetails,
    employeeDetails,
    calculations7,
    calculations10,
    breakEvenContainersPerMonth,
    breakEvenContainersPerDay,
  };
}

function computeProfitProjections(scenario: ScenarioResult, workDays: number, containerSizes: number[]): ProfitProjection[] {
  const dailyOptions = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14];
  const allCalcs = [...scenario.calculations7, ...scenario.calculations10];
  const calcsWithPrice = allCalcs.filter(c => c.listPrice !== null && c.listPrice > 0);
  const avgListPrice = calcsWithPrice.length > 0
    ? calcsWithPrice.reduce((s, c) => s + c.listPrice!, 0) / calcsWithPrice.length
    : 0;
  const avgVariableCost = calcsWithPrice.length > 0
    ? calcsWithPrice.reduce((s, c) => s + c.transportCost + c.disposalCost, 0) / calcsWithPrice.length
    : 0;

  return dailyOptions.map(cpd => {
    const cpm = cpd * workDays;
    const monthlyRevenue = cpm * avgListPrice;
    const monthlyVariableCosts = cpm * avgVariableCost;
    const monthlyProfit = monthlyRevenue - monthlyVariableCosts - scenario.totalMonthlyFixed;
    return {
      containersPerDay: cpd,
      containersPerMonth: cpm,
      monthlyRevenue,
      monthlyVariableCosts,
      monthlyFixedCosts: scenario.totalMonthlyFixed,
      monthlyProfit,
      annualProfit: monthlyProfit * 12,
    };
  });
}

export async function generateReportData(distance: number = 15): Promise<ReportData> {
  const [allMaterials, allVariables, allVehicles, allEmployees, allLoans, allSalesPrices, allMarketPrices, settingsRow, allCustomers, allPurchaseSurcharges, allSalesSurchargesData] = await Promise.all([
    storage.getMaterials(),
    storage.getCostVariables(),
    storage.getVehicles(),
    storage.getEmployees(),
    storage.getLoans(),
    storage.getSalesPrices(),
    storage.getMarketPrices(),
    storage.getPlanningSettings(),
    storage.getCustomers(),
    storage.getPurchaseSurcharges(),
    storage.getSalesSurcharges(),
  ]);

  const settings = settingsRow || { id: 1, containersPerDay: 6, workDaysPerMonth: 20, targetMarginPercent: "65", activeTrucks: 1, plannedTrucksDate: null, monthlyRent: "0" };
  const customer = allCustomers.find(c => c.companyName?.includes('FriStD'));
  const today = new Date();
  const workDays = settings.workDaysPerMonth || 20;

  const ist = computeScenario("IST-Zustand (aktuell)", false, allMaterials, allVariables, allVehicles, allEmployees, allLoans, allSalesPrices, allMarketPrices, settings as PlanningSettings, distance, today, allPurchaseSurcharges, allSalesSurchargesData);
  const soll = computeScenario("SOLL-Zustand (ab 07/2026)", true, allMaterials, allVariables, allVehicles, allEmployees, allLoans, allSalesPrices, allMarketPrices, settings as PlanningSettings, distance, today, allPurchaseSurcharges, allSalesSurchargesData);

  const profitProjectionsIst = computeProfitProjections(ist, workDays, [7, 10]);
  const profitProjectionsSoll = computeProfitProjections(soll, workDays, [7, 10]);

  const dieselPrice = Number(allVariables.find(v => v.name === "Diesel Preis")?.value || 1.70);
  const fuelConsumption = Number(allVariables.find(v => v.name === "Verbrauch (L/100km)")?.value || 35);
  const tollPerKm = Number(allVariables.find(v => v.name === "Maut / Gebühren")?.value || 0.19);
  const transportCostPerTrip = ((fuelConsumption / 100) * dieselPrice + tollPerKm) * distance * 2;

  const calcsWithPrice7 = ist.calculations7.filter(c => c.listPrice !== null && c.listPrice > 0);
  const calcsWithPrice10 = ist.calculations10.filter(c => c.listPrice !== null && c.listPrice > 0);
  const avgListPrice7 = calcsWithPrice7.length > 0 ? calcsWithPrice7.reduce((s, c) => s + c.listPrice!, 0) / calcsWithPrice7.length : 0;
  const avgListPrice10 = calcsWithPrice10.length > 0 ? calcsWithPrice10.reduce((s, c) => s + c.listPrice!, 0) / calcsWithPrice10.length : 0;

  return {
    generatedAt: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    customerName: customer?.companyName || 'Referenzkunde',
    customerNumber: customer?.customerNumber || '',
    distance,
    workDaysPerMonth: workDays,
    transportCostPerTrip,
    ist,
    soll,
    profitProjectionsIst,
    profitProjectionsSoll,
    avgListPrice7,
    avgListPrice10,
  };
}

export function generateReportHTML(data: ReportData): string {
  const marginColor = (pct: number | null) => {
    if (pct === null) return '#888';
    if (pct >= 30) return '#16a34a';
    if (pct >= 15) return '#ca8a04';
    if (pct >= 0) return '#ea580c';
    return '#dc2626';
  };

  const profitColor = (val: number) => val >= 0 ? '#16a34a' : '#dc2626';

  function renderCalcTable(calcs: MaterialCalc[], title: string): string {
    return `
      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">${title}</h2>
        <p style="color: #666; font-size: 12px; margin-bottom: 12px;">Kunde: ${data.customerName} | Entfernung: ${data.distance} km (einfach) | Transport: ${fmt(data.transportCostPerTrip)}</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #1a1a1a; color: white;">
              <th style="padding: 8px 6px; text-align: left; border: 1px solid #333;">Abfallart</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #333;">Gewicht (t)</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #333;">Kalkulation</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #333;">Listenpreis</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #333;">Marktpreis</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #333;">Ist-Marge</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #333;">Marge %</th>
            </tr>
          </thead>
          <tbody>
            ${calcs.map((c, i) => `
              <tr style="background: ${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
                <td style="padding: 6px; border: 1px solid #e5e7eb; font-weight: 500;">${c.materialName}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${fmtNum(c.weight)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">${fmt(c.baseCost)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; color: #2563eb; font-weight: 600;">${c.listPrice !== null ? fmt(c.listPrice) : '—'}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; color: #7c3aed;">${c.marketPriceNet !== null ? fmt(c.marketPriceNet) : '—'}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; color: ${profitColor(c.realMargin || 0)}; font-weight: 600;">${c.realMargin !== null ? fmt(c.realMargin) : '—'}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; color: ${marginColor(c.realMarginPercent)}; font-weight: 700;">${c.realMarginPercent !== null ? fmtPct(c.realMarginPercent) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 8px; font-size: 10px; color: #666;">
          <strong>Legende:</strong> Kalkulation = Selbstkosten (Transport + Entsorgung + anteilige Fixkosten) | Listenpreis = Rieprecht Verkaufspreis | Marktpreis = Ø Hamburg | Ist-Marge = Listenpreis − Kalkulation
        </div>
      </div>
    `;
  }

  function renderCostComparison(): string {
    const ist = data.ist;
    const soll = data.soll;
    const diff = soll.totalMonthlyFixed - ist.totalMonthlyFixed;
    return `
      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">Kostenstruktur: IST vs. SOLL</h2>
        <div style="display: flex; gap: 20px;">
          <div style="flex: 1; background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px;">
            <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 16px;">IST (aktuell)</h3>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              ${ist.vehicleDetails.map(v => `<tr><td style="padding: 3px 0; color: #666;">🚛 ${v.name}</td><td style="padding: 3px 0; text-align: right; font-weight: 500;">${fmt(v.monthly)}</td></tr>`).join('')}
              <tr style="border-top: 1px solid #93c5fd;"><td style="padding: 4px 0; font-weight: 600;">Fahrzeuge gesamt</td><td style="padding: 4px 0; text-align: right; font-weight: 700;">${fmt(ist.monthlyVehicleCosts)}</td></tr>
              <tr><td colspan="2" style="padding: 4px 0;"></td></tr>
              ${ist.employeeDetails.map(e => `<tr><td style="padding: 3px 0; color: #666;">👤 ${e.name}</td><td style="padding: 3px 0; text-align: right; font-weight: 500;">${fmt(e.monthly)}</td></tr>`).join('')}
              <tr style="border-top: 1px solid #93c5fd;"><td style="padding: 4px 0; font-weight: 600;">Personal gesamt</td><td style="padding: 4px 0; text-align: right; font-weight: 700;">${fmt(ist.monthlyEmployeeCosts)}</td></tr>
              <tr><td colspan="2" style="padding: 4px 0;"></td></tr>
              <tr><td style="padding: 3px 0; color: #666;">Betriebskosten</td><td style="padding: 3px 0; text-align: right; font-weight: 500;">${fmt(ist.monthlyOperatingCosts)}</td></tr>
              <tr><td style="padding: 3px 0; color: #666;">Darlehenszinsen</td><td style="padding: 3px 0; text-align: right; font-weight: 500;">${fmt(ist.monthlyLoanCosts)}</td></tr>
              <tr style="border-top: 2px solid #1e40af; margin-top: 8px;"><td style="padding: 8px 0; font-weight: 700; font-size: 14px; color: #1e40af;">GESAMT / Monat</td><td style="padding: 8px 0; text-align: right; font-weight: 800; font-size: 16px; color: #1e40af;">${fmt(ist.totalMonthlyFixed)}</td></tr>
            </table>
          </div>
          <div style="flex: 1; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px;">
            <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 16px;">SOLL (ab 07/2026)</h3>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              ${soll.vehicleDetails.map(v => `<tr><td style="padding: 3px 0; color: #666;">🚛 ${v.name}</td><td style="padding: 3px 0; text-align: right; font-weight: 500;">${fmt(v.monthly)}</td></tr>`).join('')}
              <tr style="border-top: 1px solid #fbbf24;"><td style="padding: 4px 0; font-weight: 600;">Fahrzeuge gesamt</td><td style="padding: 4px 0; text-align: right; font-weight: 700;">${fmt(soll.monthlyVehicleCosts)}</td></tr>
              <tr><td colspan="2" style="padding: 4px 0;"></td></tr>
              ${soll.employeeDetails.map(e => `<tr><td style="padding: 3px 0; color: #666;">👤 ${e.name}</td><td style="padding: 3px 0; text-align: right; font-weight: 500;">${fmt(e.monthly)}</td></tr>`).join('')}
              <tr style="border-top: 1px solid #fbbf24;"><td style="padding: 4px 0; font-weight: 600;">Personal gesamt</td><td style="padding: 4px 0; text-align: right; font-weight: 700;">${fmt(soll.monthlyEmployeeCosts)}</td></tr>
              <tr><td colspan="2" style="padding: 4px 0;"></td></tr>
              <tr><td style="padding: 3px 0; color: #666;">Betriebskosten</td><td style="padding: 3px 0; text-align: right; font-weight: 500;">${fmt(soll.monthlyOperatingCosts)}</td></tr>
              <tr><td style="padding: 3px 0; color: #666;">Darlehenszinsen</td><td style="padding: 3px 0; text-align: right; font-weight: 500;">${fmt(soll.monthlyLoanCosts)}</td></tr>
              <tr style="border-top: 2px solid #92400e; margin-top: 8px;"><td style="padding: 8px 0; font-weight: 700; font-size: 14px; color: #92400e;">GESAMT / Monat</td><td style="padding: 8px 0; text-align: right; font-weight: 800; font-size: 16px; color: #92400e;">${fmt(soll.totalMonthlyFixed)}</td></tr>
            </table>
          </div>
        </div>
        <div style="margin-top: 16px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px; font-size: 13px;">
          <strong>Mehrkosten SOLL vs. IST:</strong> <span style="color: #dc2626; font-weight: 700;">${fmt(diff)}</span> pro Monat
          (+ neuer LKW MAN TGS 26.440 und Fahrer 2)
        </div>
      </div>
    `;
  }

  function renderBreakEven(): string {
    return `
      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">Break-even-Analyse</h2>
        <p style="color: #666; font-size: 13px; margin-bottom: 16px;">Wie viele Container pro Monat/Tag müssen gefahren werden, um alle Fixkosten zu decken?</p>
        <div style="display: flex; gap: 20px; margin-bottom: 24px;">
          <div style="flex: 1; background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">IST Break-even</div>
            <div style="font-size: 36px; font-weight: 800; color: #1e40af;">${fmtNum(data.ist.breakEvenContainersPerDay)}</div>
            <div style="font-size: 14px; color: #3b82f6; font-weight: 600;">Container / Tag</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">(${Math.ceil(data.ist.breakEvenContainersPerMonth)} / Monat)</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Fixkosten: ${fmt(data.ist.totalMonthlyFixed)} / Monat</div>
          </div>
          <div style="flex: 1; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; text-align: center;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">SOLL Break-even</div>
            <div style="font-size: 36px; font-weight: 800; color: #92400e;">${fmtNum(data.soll.breakEvenContainersPerDay)}</div>
            <div style="font-size: 14px; color: #d97706; font-weight: 600;">Container / Tag</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">(${Math.ceil(data.soll.breakEvenContainersPerMonth)} / Monat)</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Fixkosten: ${fmt(data.soll.totalMonthlyFixed)} / Monat</div>
          </div>
        </div>
        <div style="background: #f1f5f9; border-radius: 6px; padding: 14px; font-size: 12px; color: #475569;">
          <strong>Hinweis:</strong> Break-even berechnet auf Basis des durchschnittlichen Deckungsbeitrags (Listenpreis − variable Kosten) über alle Abfallarten.
          Die tatsächliche Break-even-Menge variiert je nach Materialmix.
          <br><br>
          <strong>Kapazitätsgrenzen (gesetzlich/praktisch):</strong><br>
          • 1 LKW ohne Anhänger: ca. 8–9 Container/Tag (Spitzenwert)<br>
          • 1 LKW mit Anhänger: ca. 12–14 Container/Tag (Spitzenwert, selten erreichbar)<br>
          • Begrenzung durch Lenkzeiten (max. 9h/Tag lt. FahrPersV)
        </div>
      </div>
    `;
  }

  function renderProfitProjections(): string {
    return `
      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">Gewinnprognosen</h2>
        <p style="color: #666; font-size: 13px; margin-bottom: 16px;">Monatlicher und jährlicher Gewinn bei unterschiedlicher Auslastung (${data.workDaysPerMonth} Arbeitstage/Monat)</p>
        
        <h3 style="color: #1e40af; font-size: 16px; margin: 20px 0 12px 0;">IST-Szenario (aktuelle Ressourcen)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
          <thead>
            <tr style="background: #1e40af; color: white;">
              <th style="padding: 8px 6px; text-align: center; border: 1px solid #1e3a8a;">Container/Tag</th>
              <th style="padding: 8px 6px; text-align: center; border: 1px solid #1e3a8a;">Container/Monat</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #1e3a8a;">Umsatz/Monat</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #1e3a8a;">Var. Kosten</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #1e3a8a;">Fixkosten</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #1e3a8a; font-weight: 700;">Gewinn/Monat</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #1e3a8a; font-weight: 700;">Gewinn/Jahr</th>
            </tr>
          </thead>
          <tbody>
            ${data.profitProjectionsIst.map((p, i) => `
              <tr style="background: ${p.monthlyProfit >= 0 ? (i % 2 === 0 ? '#f0fdf4' : '#dcfce7') : (i % 2 === 0 ? '#fef2f2' : '#fee2e2')};">
                <td style="padding: 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: 600;">${p.containersPerDay}</td>
                <td style="padding: 6px; text-align: center; border: 1px solid #e5e7eb;">${p.containersPerMonth}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${fmt(p.monthlyRevenue)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${fmt(p.monthlyVariableCosts)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${fmt(p.monthlyFixedCosts)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 700; color: ${profitColor(p.monthlyProfit)};">${fmt(p.monthlyProfit)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 700; color: ${profitColor(p.annualProfit)};">${fmt(p.annualProfit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h3 style="color: #92400e; font-size: 16px; margin: 20px 0 12px 0;">SOLL-Szenario (ab 07/2026 mit neuem LKW + Fahrer)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #92400e; color: white;">
              <th style="padding: 8px 6px; text-align: center; border: 1px solid #78350f;">Container/Tag</th>
              <th style="padding: 8px 6px; text-align: center; border: 1px solid #78350f;">Container/Monat</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #78350f;">Umsatz/Monat</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #78350f;">Var. Kosten</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #78350f;">Fixkosten</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #78350f; font-weight: 700;">Gewinn/Monat</th>
              <th style="padding: 8px 6px; text-align: right; border: 1px solid #78350f; font-weight: 700;">Gewinn/Jahr</th>
            </tr>
          </thead>
          <tbody>
            ${data.profitProjectionsSoll.map((p, i) => `
              <tr style="background: ${p.monthlyProfit >= 0 ? (i % 2 === 0 ? '#f0fdf4' : '#dcfce7') : (i % 2 === 0 ? '#fef2f2' : '#fee2e2')};">
                <td style="padding: 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: 600;">${p.containersPerDay}</td>
                <td style="padding: 6px; text-align: center; border: 1px solid #e5e7eb;">${p.containersPerMonth}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${fmt(p.monthlyRevenue)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${fmt(p.monthlyVariableCosts)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${fmt(p.monthlyFixedCosts)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 700; color: ${profitColor(p.monthlyProfit)};">${fmt(p.monthlyProfit)}</td>
                <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 700; color: ${profitColor(p.annualProfit)};">${fmt(p.annualProfit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 16px; background: #f1f5f9; border-radius: 6px; padding: 14px; font-size: 12px; color: #475569;">
          <strong>Berechnungsgrundlage:</strong> Ø-Listenpreis über alle Abfallarten (7m³: ${fmt(data.avgListPrice7)}, 10m³: ${fmt(data.avgListPrice10)}).
          Gewinn = Umsatz − variable Kosten − Fixkosten. Variable Kosten = Transport + Entsorgung pro Container.
        </div>
      </div>
    `;
  }

  function renderSummary(): string {
    const istBE = data.ist.breakEvenContainersPerDay;
    const sollBE = data.soll.breakEvenContainersPerDay;
    const istProfit6 = data.profitProjectionsIst.find(p => p.containersPerDay === 6);
    const sollProfit8 = data.profitProjectionsSoll.find(p => p.containersPerDay === 8);
    const sollProfit12 = data.profitProjectionsSoll.find(p => p.containersPerDay === 12);

    return `
      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">Zusammenfassung & Fazit</h2>
        
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #374151 100%); color: white; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #fbbf24;">Kernaussagen</h3>
          <div style="display: flex; gap: 16px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.1); border-radius: 8px; padding: 14px;">
              <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase;">IST Break-even</div>
              <div style="font-size: 28px; font-weight: 800; color: #60a5fa;">${fmtNum(istBE)} Container/Tag</div>
              <div style="font-size: 12px; color: #d1d5db;">bei ${fmt(data.ist.totalMonthlyFixed)} Fixkosten/Monat</div>
            </div>
            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.1); border-radius: 8px; padding: 14px;">
              <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase;">SOLL Break-even</div>
              <div style="font-size: 28px; font-weight: 800; color: #fbbf24;">${fmtNum(sollBE)} Container/Tag</div>
              <div style="font-size: 12px; color: #d1d5db;">bei ${fmt(data.soll.totalMonthlyFixed)} Fixkosten/Monat</div>
            </div>
            ${istProfit6 ? `
            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.1); border-radius: 8px; padding: 14px;">
              <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase;">IST Gewinn bei 6/Tag</div>
              <div style="font-size: 28px; font-weight: 800; color: ${istProfit6.monthlyProfit >= 0 ? '#4ade80' : '#f87171'};">${fmt(istProfit6.monthlyProfit)}</div>
              <div style="font-size: 12px; color: #d1d5db;">pro Monat (${fmt(istProfit6.annualProfit)}/Jahr)</div>
            </div>` : ''}
          </div>
        </div>

        <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h4 style="color: #92400e; margin: 0 0 8px 0;">Bewertung der Erweiterung (ab 07/2026)</h4>
          <ul style="font-size: 13px; color: #78350f; padding-left: 20px; margin: 0;">
            <li>Monatliche Mehrkosten durch neues Fahrzeug + Fahrer: <strong>${fmt(data.soll.totalMonthlyFixed - data.ist.totalMonthlyFixed)}</strong></li>
            <li>Break-even steigt von <strong>${fmtNum(istBE)}</strong> auf <strong>${fmtNum(sollBE)}</strong> Container/Tag</li>
            ${sollProfit8 ? `<li>Bei 8 Container/Tag (realistisch mit 2 LKW): <strong style="color: ${profitColor(sollProfit8.monthlyProfit)};">${fmt(sollProfit8.monthlyProfit)}/Monat</strong></li>` : ''}
            ${sollProfit12 ? `<li>Bei 12 Container/Tag (mit Anhänger): <strong style="color: ${profitColor(sollProfit12.monthlyProfit)};">${fmt(sollProfit12.monthlyProfit)}/Monat</strong></li>` : ''}
            <li>Die Erweiterung lohnt sich, wenn dauerhaft mehr als <strong>${fmtNum(sollBE)} Container/Tag</strong> gefahren werden</li>
          </ul>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 14px; font-size: 12px; color: #166534;">
          <strong>Empfehlung:</strong> Vor der Erweiterung sollte die Nachfrage gesichert sein. 
          Der Break-even von ${fmtNum(sollBE)} Containern/Tag ist realistisch erreichbar, erfordert aber eine stabile Auftragslage.
          Die Preise liegen im Marktvergleich Hamburg im Wettbewerbsbereich.
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kalkulationsvergleich - Rieprecht GmbH</title>
  <meta name="report-type" content="monthly">
  
  <style>
    @media print {
      body { margin: 0; padding: 0; font-size: 11px; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 900px; margin: 0 auto; padding: 20px; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>
  <!-- Cover -->
  <div style="text-align: center; padding: 60px 20px; border-bottom: 4px solid #1a1a1a;">
    <div style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px;">Rieprecht GmbH · Containerdienst Hamburg</div>
    <h1 style="font-size: 32px; color: #1a1a1a; margin: 16px 0 8px 0; font-weight: 800;">Umfassender Kalkulationsvergleich</h1>
    <h2 style="font-size: 18px; color: #64748b; font-weight: 400; margin: 0 0 24px 0;">mit Marktanalyse, Break-even und Gewinnprognosen</h2>
    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; display: inline-block; text-align: left; font-size: 13px;">
      <table style="border-collapse: collapse;">
        <tr><td style="padding: 3px 16px 3px 0; color: #64748b;">Erstellt am:</td><td style="font-weight: 600;">${data.generatedAt}</td></tr>
        <tr><td style="padding: 3px 16px 3px 0; color: #64748b;">Referenzkunde:</td><td style="font-weight: 600;">${data.customerName}</td></tr>
        <tr><td style="padding: 3px 16px 3px 0; color: #64748b;">Kundennummer:</td><td style="font-weight: 600;">${data.customerNumber}</td></tr>
        <tr><td style="padding: 3px 16px 3px 0; color: #64748b;">Entfernung:</td><td style="font-weight: 600;">${data.distance} km (einfach)</td></tr>
        <tr><td style="padding: 3px 16px 3px 0; color: #64748b;">Arbeitstage/Monat:</td><td style="font-weight: 600;">${data.workDaysPerMonth}</td></tr>
      </table>
    </div>
  </div>

  <!-- Kalkulationsweg Erklärung -->
  <div style="margin-top: 40px;">
    <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">Kalkulationsweg</h2>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px;">
      <p style="margin: 0 0 12px 0;">Die Preiskalkulation basiert auf drei Kostenblöcken:</p>
      <ol style="padding-left: 20px; margin: 0;">
        <li style="margin-bottom: 8px;"><strong>Transportkosten</strong> = (Verbrauch/100km × Dieselpreis + Maut/km) × Entfernung × 2 (Hin+Rück)
          <br><span style="color: #64748b;">= (${fmtNum(35, 0)} L/100km × ${fmt(1.70)} + ${fmt(0.19, 2)}/km) × ${data.distance} km × 2 = <strong>${fmt(data.transportCostPerTrip)}</strong></span></li>
        <li style="margin-bottom: 8px;"><strong>Entsorgungskosten</strong> = Gewicht(t) × Entsorgungspreis/t + Zuschläge
          <br><span style="color: #64748b;">Gewicht = Containervolumen(m³) × Dichte(t/m³). Variiert je nach Abfallart.</span></li>
        <li style="margin-bottom: 8px;"><strong>Fixkostenanteil</strong> = Monatliche Gesamtfixkosten ÷ Container pro Monat
          <br><span style="color: #64748b;">Fixkosten = Fahrzeuge + Personal + Betrieb + Darlehenszinsen</span></li>
      </ol>
      <div style="background: #dbeafe; border-radius: 6px; padding: 10px; margin-top: 12px;">
        <strong>Selbstkosten</strong> = Transportkosten + Entsorgungskosten + Fixkostenanteil<br>
        <strong>Verkaufspreis</strong> = Selbstkosten + Gewinnmarge<br>
        <strong>Ist-Marge</strong> = Listenpreis − Selbstkosten (zeigt den tatsächlichen Gewinn bei Listenpreis-Verkauf)
      </div>
    </div>
  </div>

  ${renderCostComparison()}

  ${renderCalcTable(data.ist.calculations7, 'Preisvergleich 7m³ Container – IST')}
  ${renderCalcTable(data.ist.calculations10, 'Preisvergleich 10m³ Container – IST')}
  ${renderCalcTable(data.soll.calculations7, 'Preisvergleich 7m³ Container – SOLL (ab 07/2026)')}
  ${renderCalcTable(data.soll.calculations10, 'Preisvergleich 10m³ Container – SOLL (ab 07/2026)')}

  ${renderBreakEven()}
  ${renderProfitProjections()}
  ${renderSummary()}

  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 16px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
    <p>Rieprecht GmbH · Containerdienst Hamburg</p>
    <p>Dieses Dokument wurde automatisch generiert am ${data.generatedAt}. Alle Preise in EUR netto (sofern nicht anders angegeben).</p>
    <p style="color: #cbd5e1; font-size: 10px;">Berechnungsgrundlage: Jahresabschluss 2025, aktuelle Betriebsdaten und Marktpreise Region Hamburg</p>
  </div>
</body>
</html>`;
}

// ============================================================
// REALISTIC ANNUAL REPORT - Growth-based planning for 2026
// Based on BWA 2025 baseline with container limits & subi mix
// ============================================================

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const DEFAULT_SEASONAL_FACTORS = [0.50, 0.55, 0.75, 0.90, 1.00, 1.10, 1.10, 1.00, 1.05, 0.90, 0.70, 0.45];
const DEFAULT_GROWTH_FACTORS = [0.40, 0.43, 0.48, 0.53, 0.58, 0.63, 0.68, 0.72, 0.76, 0.80, 0.83, 0.85];
const DEFAULT_SUBI_SHARE = [0.45, 0.42, 0.38, 0.35, 0.32, 0.28, 0.25, 0.23, 0.22, 0.20, 0.18, 0.15];

const SEASONAL_FACTORS: Record<number, number> = Object.fromEntries(DEFAULT_SEASONAL_FACTORS.map((v, i) => [i, v]));
const GROWTH_FACTORS: Record<number, number> = Object.fromEntries(DEFAULT_GROWTH_FACTORS.map((v, i) => [i, v]));
const SUBI_SHARE: Record<number, number> = Object.fromEntries(DEFAULT_SUBI_SHARE.map((v, i) => [i, v]));

export function getDefaultForecastParams(): ForecastParams {
  return {
    growthFactors: [...DEFAULT_GROWTH_FACTORS],
    subiShare: [...DEFAULT_SUBI_SHARE],
    seasonalFactors: [...DEFAULT_SEASONAL_FACTORS],
    maxContainersPerDayPerDriver: 6,
    initialContainerStock: 60,
    containerPricePerUnit: 2800,
    containerTurnaroundDays: 5,
    containerUtilizationThreshold: 0.80,
    containers7Count: 40,
    containers10Count: 20,
    containers7Price: 1250,
    containers10Price: 1450,
    vacationDaysPerDriver: 30,
    sickDaysPerDriver: 10,
    distance: 15,
    year: 2026,
    subiRevenuePerTrip: 80,
    driver2MonthlySalary: 3000,
    driver2MonthlySpesen: 500,
    driver2Name: 'Fahrer 2',
    newVehicleMonthlyLease: 3500,
    newVehicleMonthlyInsurance: 800,
    newVehicleMonthlyMaintenance: 1200,
    newVehicleMonthlyDepreciation: 0,
    newVehicleName: 'Neues Fahrzeug',
    expansionStartMonth: 6,
    expansionStartYear: 2026,
  };
}

export async function getDefaultForecastParamsFromDB(): Promise<ForecastParams> {
  const defaults = getDefaultForecastParams();

  try {
    const [allEmployees, allVehicles, allContainers] = await Promise.all([
      storage.getEmployees(),
      storage.getVehicles(),
      storage.getContainers(),
    ]);

    const driver2 = allEmployees.find(e => e.name === 'Fahrer 2' || (e.role === 'fahrer' && e.name !== 'Geschäftsführer'));
    if (driver2) {
      defaults.driver2MonthlySalary = Number(driver2.monthlySalary || 0);
      defaults.driver2MonthlySpesen = Number(driver2.taxFreeAllowance || 0);
      defaults.driver2Name = driver2.name;
      if (driver2.hireDate) {
        const hireDate = new Date(driver2.hireDate);
        defaults.expansionStartMonth = hireDate.getMonth();
        defaults.expansionStartYear = hireDate.getFullYear();
      }
    }

    const expansionVehicle = allVehicles.find(v => v.name?.includes('26.440') || v.name?.includes('Neu'));
    if (expansionVehicle) {
      defaults.newVehicleMonthlyLease = Number(expansionVehicle.monthlyLeaseCost || 0);
      defaults.newVehicleMonthlyInsurance = Number(expansionVehicle.monthlyInsurance || 0);
      defaults.newVehicleMonthlyMaintenance = Number(expansionVehicle.monthlyMaintenance || 0);
      defaults.newVehicleMonthlyDepreciation = calcMonthlyDepreciation(expansionVehicle.purchaseCost, expansionVehicle.depreciationYears);
      defaults.newVehicleName = expansionVehicle.name;
    }

    const containers7 = allContainers.filter(c => c.isActive && c.sizeM3 === 7);
    const containers10 = allContainers.filter(c => c.isActive && c.sizeM3 === 10);
    const count7 = containers7.reduce((s, c) => s + (c.quantity || 1), 0);
    const count10 = containers10.reduce((s, c) => s + (c.quantity || 1), 0);
    defaults.containers7Count = count7;
    defaults.containers10Count = count10;
    defaults.initialContainerStock = count7 + count10;

    if (count7 > 0) {
      const totalCost7 = containers7.reduce((s, c) => s + Number(c.purchaseCost || 0) * (c.quantity || 1), 0);
      defaults.containers7Price = Math.round(totalCost7 / count7);
    }
    if (count10 > 0) {
      const totalCost10 = containers10.reduce((s, c) => s + Number(c.purchaseCost || 0) * (c.quantity || 1), 0);
      defaults.containers10Price = Math.round(totalCost10 / count10);
    }
    const totalCost = count7 * (defaults.containers7Price || 0) + count10 * (defaults.containers10Price || 0);
    const totalCount = count7 + count10;
    defaults.containerPricePerUnit = totalCount > 0 ? Math.round(totalCost / totalCount) : 2800;

  } catch (err) {
    console.error('Failed to load resource defaults, using hardcoded fallbacks:', err);
  }

  return defaults;
}

interface RealisticMonthCalc {
  month: number;
  monthName: string;
  totalWorkDays: number;
  vacationDaysLost: number;
  sickDaysLost: number;
  effectiveWorkDays: number;
  seasonalFactor: number;
  growthFactor: number;
  driverCount: number;
  maxContainersPerDay: number;
  actualContainersPerDay: number;
  ownContainersTotal: number;
  subiTripsTotal: number;
  totalTrips: number;
  subiSharePercent: number;
  containerStock: number;
  containersPurchased: number;
  containerPurchaseCost: number;
  fixedCosts: number;
  fixedCostPerContainer: number;
  avgBaseCostPerContainer: number;
  avgListPricePerContainer: number;
  avgMarketPricePerContainer: number;
  marginAtListPrice: number;
  marginAtMarketPrice: number;
  marginPercentAtListPrice: number;
  marginPercentAtMarketPrice: number;
  avgRevenuePerOwnContainer: number;
  avgRevenuePerSubiTrip: number;
  avgVariableCostPerContainer: number;
  revenueOwn: number;
  revenueSubi: number;
  totalRevenue: number;
  revenueOwnAtMarketPrice: number;
  totalRevenueAtMarketPrice: number;
  variableCostsOwn: number;
  variableCostsSubi: number;
  totalVariableCosts: number;
  monthlyProfit: number;
  monthlyProfitAtMarketPrice: number;
  cumulativeProfit: number;
  cumulativeProfitAtMarketPrice: number;
  cumulativeContainerInvestment: number;
  calculationHint: string;
  isActual?: boolean;
  planTrips?: number;
  planRevenue?: number;
  planProfit?: number;
  actualTrips?: number;
  actualOwnTrips?: number;
  actualSubiTrips?: number;
  actualRevenue?: number;
  actualOwnRevenue?: number;
  actualSubiRevenue?: number;
  actualAvgRevenuePerTrip?: number;
}

interface ContainerStockEvent {
  month: number;
  monthName: string;
  stockBefore: number;
  purchased: number;
  stockAfter: number;
  reason: string;
  cost: number;
}

interface BreakEvenAnalysis {
  driver2StartMonth: number;
  driver2StartMonthName: string;
  additionalMonthlyCost: number;
  additionalMonthlyRevenue: number[];
  breakEvenMonth: number | null;
  breakEvenMonthName: string | null;
  monthsToBreakEven: number | null;
  driver2YearProfit: number;
  withoutDriver2YearProfit: number;
  profitDifference: number;
  recommendation: string;
}

export interface AnnualReportData {
  generatedAt: string;
  year: number;
  customerName: string;
  customerNumber: string;
  distance: number;
  vacationDaysPerDriver: number;
  sickDaysPerDriver: number;
  bwaBaselineMonthlyRevenue: number;
  initialContainerStock: number;
  containerPricePerUnit: number;
  scenarioA: RealisticMonthCalc[];
  scenarioB: RealisticMonthCalc[];
  containerEvents: ContainerStockEvent[];
  breakEven: BreakEvenAnalysis;
  scenarioATotalRevenue: number;
  scenarioATotalCosts: number;
  scenarioATotalProfit: number;
  scenarioATotalOwnContainers: number;
  scenarioATotalSubiTrips: number;
  scenarioATotalTrips: number;
  scenarioBTotalRevenue: number;
  scenarioBTotalCosts: number;
  scenarioBTotalProfit: number;
  scenarioBTotalOwnContainers: number;
  scenarioBTotalSubiTrips: number;
  scenarioBTotalTrips: number;
  avgOwnContainerRevenue: number;
  avgSubiTripRevenue: number;
  monthlyFixedA: number;
  monthlyFixedB: number;
  driver2MonthlyCost: number;
  newVehicleMonthlyCost: number;
  calculationMethod: string;
}

function getVacationDaysPerMonth(): number[] {
  return [1, 1, 2, 3, 2, 2, 5, 5, 2, 2, 2, 3];
}

function getSickDaysPerMonth(): number[] {
  return [2, 2, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1];
}

function getWorkDaysInMonth(month: number): number {
  // Approximate working days per month (2026), excluding weekends and German public holidays
  const workDays: Record<number, number> = {
    0: 21,  // Jan (Neujahr)
    1: 20,  // Feb
    2: 22,  // Mär
    3: 20,  // Apr (Karfreitag, Ostermontag)
    4: 19,  // Mai (Tag der Arbeit, Himmelfahrt)
    5: 20,  // Jun (Pfingstmontag)
    6: 23,  // Jul
    7: 21,  // Aug
    8: 22,  // Sep
    9: 21,  // Okt (Tag d. dt. Einheit)
    10: 21, // Nov
    11: 20, // Dez (Weihnachten)
  };
  return workDays[month] || 21;
}

export async function generateAnnualReportData(distance: number = 15, overrideParams?: Partial<ForecastParams>): Promise<AnnualReportData> {
  const defaults = getDefaultForecastParams();
  const params: ForecastParams = {
    ...defaults,
    ...overrideParams,
    distance: overrideParams?.distance ?? distance,
    growthFactors: overrideParams?.growthFactors?.length === 12 ? overrideParams.growthFactors : defaults.growthFactors,
    subiShare: overrideParams?.subiShare?.length === 12 ? overrideParams.subiShare : defaults.subiShare,
    seasonalFactors: overrideParams?.seasonalFactors?.length === 12 ? overrideParams.seasonalFactors : defaults.seasonalFactors,
  };

  const [allMaterials, allVariables, allVehicles, allEmployees, allLoans, allSalesPrices, allMarketPrices, settingsRow, allCustomers, allPurchaseSurcharges, allSalesSurcharges, allTrips] = await Promise.all([
    storage.getMaterials(),
    storage.getCostVariables(),
    storage.getVehicles(),
    storage.getEmployees(),
    storage.getLoans(),
    storage.getSalesPrices(),
    storage.getMarketPrices(),
    storage.getPlanningSettings(),
    storage.getCustomers(),
    storage.getPurchaseSurcharges(),
    storage.getSalesSurcharges(),
    storage.getTrips(),
  ]);

  const settings = settingsRow || { id: 1, containersPerDay: 6, workDaysPerMonth: 20, targetMarginPercent: "65", activeTrucks: 1, plannedTrucksDate: null, monthlyRent: "0" };
  const customer = allCustomers.find(c => c.companyName?.includes('FriStD'));
  const maxContainersPerDayPerDriver = params.maxContainersPerDayPerDriver;
  const year = params.year;
  const vacationDaysPerDriver = params.vacationDaysPerDriver;
  const sickDaysPerDriver = params.sickDaysPerDriver;
  const initialContainerStock = params.initialContainerStock;
  const containerPricePerUnit = params.containerPricePerUnit;
  const containerTurnaroundDays = params.containerTurnaroundDays;
  const containerUtilizationThreshold = params.containerUtilizationThreshold;

  const dieselPrice = Number(allVariables.find(v => v.name === "Diesel Preis")?.value || 1.70);
  const fuelConsumption = Number(allVariables.find(v => v.name === "Verbrauch (L/100km)")?.value || 35);
  const tollPerKm = Number(allVariables.find(v => v.name === "Maut / Gebühren")?.value || 0.19);
  const containerPickupPrice = 135;
  const fuelCostPerKm = (fuelConsumption / 100) * dieselPrice;
  const transportCostPerTrip = (fuelCostPerKm + tollPerKm) * params.distance * 2;

  const vacationPerMonth = getVacationDaysPerMonth();
  const sickPerMonth = getSickDaysPerMonth();

  const bwaMonthlyRevenues = [0, 0, 0, 0, 13331, 20411, 23269, 18496, 17884, 32587, 30023, 18788];
  const bwaActiveMonths = bwaMonthlyRevenues.filter(r => r > 0);
  const bwaBaselineMonthlyRevenue = bwaActiveMonths.length > 0
    ? bwaActiveMonths.slice(-3).reduce((s, v) => s + v, 0) / 3
    : 27133;

  function computeMonthlyFixed(refDate: Date) {
    const activeVehicles = allVehicles.filter(v => v.isActive && hasStarted(v.purchaseDate, refDate));
    const activeEmployees = allEmployees.filter(e => e.isActive && hasStarted(e.hireDate, refDate));
    const activeLoans = allLoans.filter(l => l.isActive && (!l.endDate || new Date(l.endDate) >= refDate));

    const monthlyVehicleCosts = activeVehicles.reduce((s, v) => {
      return s + Number(v.monthlyLeaseCost || 0) + Number(v.monthlyInsurance || 0) + Number(v.monthlyMaintenance || 0) + calcMonthlyDepreciation(v.purchaseCost, v.depreciationYears);
    }, 0);
    const monthlyEmployeeCosts = activeEmployees.reduce((s, e) => s + Number(e.monthlySalary || 0) + Number(e.taxFreeAllowance || 0), 0);
    const monthlyOperatingCosts = allVariables.filter(v => v.unit === 'per_month').reduce((s, v) => s + Number(v.value), 0);
    const monthlyLoanCosts = activeLoans.reduce((s, l) => s + calcMonthlyLoanCost(l), 0);
    return monthlyVehicleCosts + monthlyEmployeeCosts + monthlyOperatingCosts + monthlyLoanCosts;
  }

  const SUBI_REVENUE_PER_TRIP = params.subiRevenuePerTrip ?? 80;

  function computePricesForVolume(monthlyFixedCosts: number, containersPerMonth: number) {
    const activeMats = allMaterials.filter(m => m.isActive);
    const fixedCostPerCont = containersPerMonth > 0 ? monthlyFixedCosts / containersPerMonth : 0;

    let totalBaseCost = 0;
    let totalListPrice = 0;
    let totalMarketPrice = 0;
    let totalVariableCost = 0;
    let countBase = 0;
    let countList = 0;
    let countMarket = 0;

    for (const size of [7, 10]) {
      for (const mat of activeMats) {
        const density = Number(mat.density || 0);
        const weight = size * density;
        const disposalRate = Number(mat.disposalCostPerTonne || 0);
        const matchingSP = allSalesPrices.find(sp => normalizeAvv(sp.avvCode) === normalizeAvv(mat.avvNumber));
        const isDangerous = matchingSP?.isDangerous || false;
        const purchSurcharge = calcPurchaseSurchargeTotal(mat.purchaseSurchargeIds, allPurchaseSurcharges, "m3", weight, size, isDangerous);
        const disposalCost = (weight * disposalRate) + purchSurcharge;
        const variableCost = transportCostPerTrip + disposalCost;
        const baseCost = variableCost + fixedCostPerCont;

        totalVariableCost += variableCost;
        totalBaseCost += baseCost;
        countBase++;

        const sSurchargeTonne = calcSalesSurchargeTotal(matchingSP?.salesSurchargeIds, allSalesSurcharges, "tonne", weight, size, isDangerous);
        const sSurchargeM3 = calcSalesSurchargeTotal(matchingSP?.salesSurchargeIds, allSalesSurcharges, "m3", weight, size, isDangerous);
        let listPriceM3: number | null = null;
        if (matchingSP?.pricePerCubicMeter && size > 0) {
          listPriceM3 = Number(matchingSP.pricePerCubicMeter) * size + sSurchargeM3 + containerPickupPrice;
        }
        let listPriceTonne: number | null = null;
        if (matchingSP?.pricePerTonne && weight > 0) {
          listPriceTonne = Number(matchingSP.pricePerTonne) * weight + sSurchargeTonne + containerPickupPrice;
        }
        const listPrice = listPriceM3 ?? listPriceTonne ?? null;
        if (listPrice !== null && listPrice > 0) {
          totalListPrice += listPrice;
          countList++;
        }

        const matchingMPs = allMarketPrices.filter(p => p.materialCategory === mat.name && p.containerSizeM3 === size);
        if (matchingMPs.length > 0) {
          const nets = matchingMPs.map(p => Number(p.priceNet || p.priceGross)).filter(n => n > 0);
          if (nets.length > 0) {
            const avgMarketNet = nets.reduce((a, b) => a + b, 0) / nets.length;
            totalMarketPrice += avgMarketNet;
            countMarket++;
          }
        }
      }
    }

    const avgBaseCost = countBase > 0 ? totalBaseCost / countBase : 0;
    const avgListPrice = countList > 0 ? totalListPrice / countList : 0;
    const avgMarketPrice = countMarket > 0 ? totalMarketPrice / countMarket : 0;
    const avgVariableCost = countBase > 0 ? totalVariableCost / countBase : 0;

    const marginAtListPrice = avgListPrice - avgBaseCost;
    const marginAtMarketPrice = avgMarketPrice > 0 ? avgMarketPrice - avgBaseCost : 0;
    const marginPercentAtListPrice = avgBaseCost > 0 ? (marginAtListPrice / avgBaseCost) * 100 : 0;
    const marginPercentAtMarketPrice = avgBaseCost > 0 && avgMarketPrice > 0 ? (marginAtMarketPrice / avgBaseCost) * 100 : 0;

    return {
      fixedCostPerContainer: fixedCostPerCont,
      avgBaseCost,
      avgListPrice,
      avgMarketPrice,
      avgVariableCost,
      marginAtListPrice,
      marginAtMarketPrice,
      marginPercentAtListPrice,
      marginPercentAtMarketPrice,
    };
  }

  function computeScenarioMonths(addSecondDriver: boolean): { months: RealisticMonthCalc[], containerEvents: ContainerStockEvent[] } {
    let containerStock = initialContainerStock;
    let cumulativeProfit = 0;
    let cumulativeProfitAtMarketPrice = 0;
    let cumulativeContainerInvestment = 0;
    const containerEvents: ContainerStockEvent[] = [];
    const months: RealisticMonthCalc[] = [];

    for (let m = 0; m < 12; m++) {
      const refDate = new Date(year, m, 15);
      const fixedCosts = computeMonthlyFixed(refDate);
      const totalWorkDays = getWorkDaysInMonth(m);
      const vacDays = vacationPerMonth[m];
      const sickDays = sickPerMonth[m];

      const expansionYear = params.expansionStartYear ?? year;
      const expansionDate = `${expansionYear}-${String(params.expansionStartMonth + 1).padStart(2, '0')}-01`;
      const activeDriverCount = addSecondDriver && hasStarted(expansionDate, refDate) ? 2 : 1;
      const effectiveWorkDays = Math.max(totalWorkDays - vacDays - sickDays, 0);

      const seasonalFactor = params.seasonalFactors[m];
      const growthFactor = params.growthFactors[m];
      const subiShare = params.subiShare[m];

      const maxPerDay = maxContainersPerDayPerDriver * activeDriverCount;
      const actualContainersPerDay = maxPerDay * growthFactor * seasonalFactor;

      const totalTripsRaw = Math.round(effectiveWorkDays * actualContainersPerDay);
      const ownContainers = Math.round(totalTripsRaw * (1 - subiShare));
      const subiTrips = totalTripsRaw - ownContainers;

      const containersNeededInCirculation = Math.ceil(actualContainersPerDay * containerTurnaroundDays);

      let containersPurchased = 0;
      let containerPurchaseCost = 0;
      if (containersNeededInCirculation > containerStock) {
        const deficit = containersNeededInCirculation - containerStock;
        containersPurchased = Math.ceil(deficit / 10) * 10;
        containerPurchaseCost = containersPurchased * containerPricePerUnit;
        const stockBefore = containerStock;
        containerStock += containersPurchased;
        containerEvents.push({
          month: m,
          monthName: MONTH_NAMES[m],
          stockBefore,
          purchased: containersPurchased,
          stockAfter: containerStock,
          reason: `${fmtNum(actualContainersPerDay)} Cnt/Tag × ${containerTurnaroundDays} Tage Standzeit = ${containersNeededInCirculation} benötigt (Bestand: ${stockBefore})`,
          cost: containerPurchaseCost,
        });
        cumulativeContainerInvestment += containerPurchaseCost;
      }

      const prices = computePricesForVolume(fixedCosts, totalTripsRaw);

      const revenueOwn = ownContainers * prices.avgListPrice;
      const revenueSubi = subiTrips * SUBI_REVENUE_PER_TRIP;
      const totalRevenue = revenueOwn + revenueSubi;

      const revenueOwnAtMarketPrice = prices.avgMarketPrice > 0 ? ownContainers * prices.avgMarketPrice : revenueOwn;
      const totalRevenueAtMarketPrice = revenueOwnAtMarketPrice + revenueSubi;

      const variableCostsOwn = ownContainers * prices.avgVariableCost;
      const variableCostsSubi = subiTrips * (transportCostPerTrip * 0.8);
      const totalVariableCosts = variableCostsOwn + variableCostsSubi;

      const monthlyProfit = totalRevenue - totalVariableCosts - fixedCosts - containerPurchaseCost;
      const monthlyProfitAtMarketPrice = totalRevenueAtMarketPrice - totalVariableCosts - fixedCosts - containerPurchaseCost;
      cumulativeProfit += monthlyProfit;
      cumulativeProfitAtMarketPrice += monthlyProfitAtMarketPrice;

      const containersPerDayRounded = Math.round(actualContainersPerDay * 10) / 10;
      const calculationHint = `${MONTH_NAMES[m]}: ${containersPerDayRounded} Cnt/Tag × ${containerTurnaroundDays}T Standzeit = ${containersNeededInCirculation} Container nötig (Bestand: ${containerStock}). ${totalTripsRaw} Fahrten → Fixk. ${fmt(prices.fixedCostPerContainer)}/Cnt, Basis ${fmt(prices.avgBaseCost)}, LP ${fmt(prices.avgListPrice)} (${fmtPct(prices.marginPercentAtListPrice)}), MP ${fmt(prices.avgMarketPrice)} (${fmtPct(prices.marginPercentAtMarketPrice)})${containersPurchased > 0 ? `. Nachkauf: ${containersPurchased} Stk. (${fmt(containerPurchaseCost)})` : ''}`;

      months.push({
        month: m,
        monthName: MONTH_NAMES[m],
        totalWorkDays,
        vacationDaysLost: vacDays,
        sickDaysLost: sickDays,
        effectiveWorkDays,
        seasonalFactor,
        growthFactor,
        driverCount: activeDriverCount,
        maxContainersPerDay: maxPerDay,
        actualContainersPerDay: containersPerDayRounded,
        ownContainersTotal: ownContainers,
        subiTripsTotal: subiTrips,
        totalTrips: totalTripsRaw,
        subiSharePercent: subiShare * 100,
        containerStock,
        containersPurchased,
        containerPurchaseCost,
        fixedCosts,
        fixedCostPerContainer: prices.fixedCostPerContainer,
        avgBaseCostPerContainer: prices.avgBaseCost,
        avgListPricePerContainer: prices.avgListPrice,
        avgMarketPricePerContainer: prices.avgMarketPrice,
        marginAtListPrice: prices.marginAtListPrice,
        marginAtMarketPrice: prices.marginAtMarketPrice,
        marginPercentAtListPrice: prices.marginPercentAtListPrice,
        marginPercentAtMarketPrice: prices.marginPercentAtMarketPrice,
        avgRevenuePerOwnContainer: prices.avgListPrice,
        avgRevenuePerSubiTrip: SUBI_REVENUE_PER_TRIP,
        avgVariableCostPerContainer: prices.avgVariableCost,
        revenueOwn,
        revenueSubi,
        totalRevenue,
        revenueOwnAtMarketPrice,
        totalRevenueAtMarketPrice,
        variableCostsOwn,
        variableCostsSubi,
        totalVariableCosts,
        monthlyProfit,
        monthlyProfitAtMarketPrice,
        cumulativeProfit,
        cumulativeProfitAtMarketPrice,
        cumulativeContainerInvestment,
        calculationHint,
      });
    }

    return { months, containerEvents };
  }

  const scenarioAResult = computeScenarioMonths(false);
  const scenarioBResult = computeScenarioMonths(true);

  const tripsByMonth: Map<number, { total: number; own: number; subi: number; revenue: number; ownRevenue: number; subiRevenue: number }> = new Map();
  const today = new Date();
  for (const trip of allTrips) {
    if (!trip.tripDate) continue;
    const td = new Date(trip.tripDate);
    if (td.getFullYear() !== year) continue;
    const m = td.getMonth();
    if (!tripsByMonth.has(m)) {
      tripsByMonth.set(m, { total: 0, own: 0, subi: 0, revenue: 0, ownRevenue: 0, subiRevenue: 0 });
    }
    const entry = tripsByMonth.get(m)!;
    const price = Number(trip.actualPrice || 0);
    entry.total++;
    entry.revenue += price;
    const otLower = (trip.orderType || '').toLowerCase();
    if (otLower === 'subi' || otLower === 'subunternehmer') {
      entry.subi++;
      entry.subiRevenue += price;
    } else {
      entry.own++;
      entry.ownRevenue += price;
    }
  }

  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    const hasActualData = tripsByMonth.has(m) && monthStart <= today;
    if (hasActualData) {
      const td = tripsByMonth.get(m)!;
      const actualRevenue = Math.round(td.revenue * 100) / 100;
      const actualOwnRevenue = Math.round(td.ownRevenue * 100) / 100;
      const actualSubiRevenue = Math.round(td.subiRevenue * 100) / 100;

      for (const scenario of [scenarioAResult.months[m], scenarioBResult.months[m]]) {
        const planTrips = scenario.totalTrips;
        const planRevenue = scenario.totalRevenue;
        const planProfit = scenario.monthlyProfit;
        const planProfitAtMarket = scenario.monthlyProfitAtMarketPrice;

        const fixedCosts = scenario.fixedCosts;
        const planTotalTrips = Math.max(planTrips, 1);
        const varCostPerOwnTrip = scenario.ownContainersTotal > 0
          ? scenario.variableCostsOwn / scenario.ownContainersTotal
          : scenario.totalVariableCosts / planTotalTrips;
        const varCostPerSubiTrip = scenario.subiTripsTotal > 0
          ? scenario.variableCostsSubi / scenario.subiTripsTotal
          : 0;
        const estimatedVariableCostsOwn = varCostPerOwnTrip * td.own;
        const estimatedVariableCostsSubi = varCostPerSubiTrip * td.subi;
        const estimatedVariableCosts = estimatedVariableCostsOwn + estimatedVariableCostsSubi;
        const actualProfit = actualRevenue - fixedCosts - estimatedVariableCosts - scenario.containerPurchaseCost;

        scenario.isActual = true;
        scenario.planTrips = planTrips;
        scenario.planRevenue = planRevenue;
        scenario.planProfit = planProfit;
        scenario.actualTrips = td.total;
        scenario.actualOwnTrips = td.own;
        scenario.actualSubiTrips = td.subi;
        scenario.actualRevenue = actualRevenue;
        scenario.actualOwnRevenue = actualOwnRevenue;
        scenario.actualSubiRevenue = actualSubiRevenue;
        scenario.actualAvgRevenuePerTrip = td.total > 0 ? Math.round(td.revenue / td.total * 100) / 100 : 0;

        scenario.totalTrips = td.total;
        scenario.ownContainersTotal = td.own;
        scenario.subiTripsTotal = td.subi;
        scenario.revenueOwn = actualOwnRevenue;
        scenario.revenueSubi = actualSubiRevenue;
        scenario.totalRevenue = actualRevenue;
        scenario.variableCostsOwn = estimatedVariableCostsOwn;
        scenario.variableCostsSubi = estimatedVariableCostsSubi;
        scenario.totalVariableCosts = estimatedVariableCosts;
        scenario.monthlyProfit = actualProfit;
        scenario.monthlyProfitAtMarketPrice = actualProfit;
      }
    }
  }

  let cumProfitA = 0, cumProfitB = 0;
  let cumProfitMktA = 0, cumProfitMktB = 0;
  for (let m = 0; m < 12; m++) {
    cumProfitA += scenarioAResult.months[m].monthlyProfit;
    cumProfitB += scenarioBResult.months[m].monthlyProfit;
    cumProfitMktA += scenarioAResult.months[m].monthlyProfitAtMarketPrice;
    cumProfitMktB += scenarioBResult.months[m].monthlyProfitAtMarketPrice;
    scenarioAResult.months[m].cumulativeProfit = cumProfitA;
    scenarioBResult.months[m].cumulativeProfit = cumProfitB;
    scenarioAResult.months[m].cumulativeProfitAtMarketPrice = cumProfitMktA;
    scenarioBResult.months[m].cumulativeProfitAtMarketPrice = cumProfitMktB;
  }

  const driver2MonthlyCost = params.driver2MonthlySalary + params.driver2MonthlySpesen;
  const newVehicleMonthlyCost = params.newVehicleMonthlyLease + params.newVehicleMonthlyInsurance + params.newVehicleMonthlyMaintenance + (params.newVehicleMonthlyDepreciation || 0);

  const additionalMonthlyCost = driver2MonthlyCost + newVehicleMonthlyCost;
  const driver2StartMonth = params.expansionStartMonth;

  let breakEvenMonth: number | null = null;
  let cumulativeDiff = 0;
  const additionalMonthlyRevenue: number[] = [];
  for (let m = 0; m < 12; m++) {
    const diff = scenarioBResult.months[m].monthlyProfit - scenarioAResult.months[m].monthlyProfit;
    additionalMonthlyRevenue.push(diff);
    if (m >= driver2StartMonth) {
      cumulativeDiff += diff;
      if (cumulativeDiff > 0 && breakEvenMonth === null) {
        breakEvenMonth = m;
      }
    }
  }

  const driver2YearProfit = scenarioBResult.months.reduce((s, m) => s + m.monthlyProfit, 0);
  const withoutDriver2YearProfit = scenarioAResult.months.reduce((s, m) => s + m.monthlyProfit, 0);
  const profitDifference = driver2YearProfit - withoutDriver2YearProfit;

  let recommendation: string;
  if (profitDifference > 20000) {
    recommendation = `Die Erweiterung um den zweiten Fahrer + Fahrzeug bringt ${fmt(profitDifference, 0)} mehr Jahresgewinn. Klare Empfehlung: Expansion lohnt sich ab dem geplanten Startmonat.`;
  } else if (profitDifference > 0) {
    recommendation = `Die Erweiterung bringt ${fmt(profitDifference, 0)} mehr Jahresgewinn. Die Investition rechnet sich knapp – es empfiehlt sich, erst den Kundenstamm weiter auszubauen, bevor die Expansion startet.`;
  } else {
    recommendation = `Die Erweiterung würde im ersten Jahr ${fmt(Math.abs(profitDifference), 0)} weniger Gewinn bedeuten. Empfehlung: Erst den Kundenstamm und die Auslastung mit einem Fahrer maximieren, bevor ein zweiter Fahrer dazukommt.`;
  }

  const sumField = (months: RealisticMonthCalc[], field: keyof RealisticMonthCalc) =>
    months.reduce((s, m) => s + (m[field] as number), 0);

  return {
    generatedAt: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    year,
    customerName: customer?.companyName || 'Referenzkunde',
    customerNumber: customer?.customerNumber || '',
    distance: params.distance,
    vacationDaysPerDriver,
    sickDaysPerDriver,
    bwaBaselineMonthlyRevenue,
    initialContainerStock,
    containerPricePerUnit,
    scenarioA: scenarioAResult.months,
    scenarioB: scenarioBResult.months,
    containerEvents: scenarioBResult.containerEvents.length > 0 ? scenarioBResult.containerEvents : scenarioAResult.containerEvents,
    breakEven: {
      driver2StartMonth,
      driver2StartMonthName: MONTH_NAMES[driver2StartMonth],
      additionalMonthlyCost,
      additionalMonthlyRevenue,
      breakEvenMonth,
      breakEvenMonthName: breakEvenMonth !== null ? MONTH_NAMES[breakEvenMonth] : null,
      monthsToBreakEven: breakEvenMonth !== null ? breakEvenMonth - driver2StartMonth + 1 : null,
      driver2YearProfit,
      withoutDriver2YearProfit,
      profitDifference,
      recommendation,
    },
    scenarioATotalRevenue: sumField(scenarioAResult.months, 'totalRevenue'),
    scenarioATotalCosts: sumField(scenarioAResult.months, 'totalVariableCosts') + sumField(scenarioAResult.months, 'fixedCosts'),
    scenarioATotalProfit: sumField(scenarioAResult.months, 'monthlyProfit'),
    scenarioATotalOwnContainers: sumField(scenarioAResult.months, 'ownContainersTotal'),
    scenarioATotalSubiTrips: sumField(scenarioAResult.months, 'subiTripsTotal'),
    scenarioATotalTrips: sumField(scenarioAResult.months, 'totalTrips'),
    scenarioBTotalRevenue: sumField(scenarioBResult.months, 'totalRevenue'),
    scenarioBTotalCosts: sumField(scenarioBResult.months, 'totalVariableCosts') + sumField(scenarioBResult.months, 'fixedCosts'),
    scenarioBTotalProfit: sumField(scenarioBResult.months, 'monthlyProfit'),
    scenarioBTotalOwnContainers: sumField(scenarioBResult.months, 'ownContainersTotal'),
    scenarioBTotalSubiTrips: sumField(scenarioBResult.months, 'subiTripsTotal'),
    scenarioBTotalTrips: sumField(scenarioBResult.months, 'totalTrips'),
    avgOwnContainerRevenue: scenarioBResult.months[6]?.avgListPricePerContainer || scenarioAResult.months[6]?.avgListPricePerContainer || 0,
    avgSubiTripRevenue: SUBI_REVENUE_PER_TRIP,
    monthlyFixedA: scenarioAResult.months[0]?.fixedCosts || 0,
    monthlyFixedB: scenarioBResult.months[6]?.fixedCosts || 0,
    driver2MonthlyCost,
    newVehicleMonthlyCost,
    calculationMethod: `Berechnung nutzt die Rechner-Logik der App: Für jeden Monat wird die Container-Menge/Tag angepasst, was die Fixkosten pro Container verändert (mehr Fahrten = niedrigere Stückkosten). Eigene Container werden zu Listenpreisen berechnet, Subi-Fahrten bringen pauschal ${fmt(SUBI_REVENUE_PER_TRIP)} netto/Fahrt. Zusätzlich wird die Marktpreis-Marge berechnet (was bei Marktpreisen möglich wäre).`,
  };
}

export function generateAnnualReportHTML(data: AnnualReportData): string {
  const profitColor = (val: number) => val >= 0 ? '#16a34a' : '#dc2626';
  const seasonLabel = (f: number) => {
    if (f >= 1.0) return '🟢 Hochsaison';
    if (f >= 0.75) return '🟡 Normal';
    if (f >= 0.55) return '🟠 Schwach';
    return '🔴 Winterflaute';
  };

  function renderMonthlyOverview(months: RealisticMonthCalc[], label: string, color: string): string {
    const totalOwn = months.reduce((s, m) => s + m.ownContainersTotal, 0);
    const totalSubi = months.reduce((s, m) => s + m.subiTripsTotal, 0);
    const totalTrips = months.reduce((s, m) => s + m.totalTrips, 0);
    const totalRevenue = months.reduce((s, m) => s + m.totalRevenue, 0);
    const totalVarCosts = months.reduce((s, m) => s + m.totalVariableCosts, 0);
    const totalFixed = months.reduce((s, m) => s + m.fixedCosts, 0);
    const totalProfit = months.reduce((s, m) => s + m.monthlyProfit, 0);
    const totalEffDays = months.reduce((s, m) => s + m.effectiveWorkDays, 0);

    return `
      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid ${color}; padding-bottom: 8px; margin-bottom: 8px;">${label} – Monatsübersicht ${data.year}</h2>
        <p style="color: #666; font-size: 11px; margin-bottom: 12px;">Wachstumskurve mit saisonalen Schwankungen | Subi-Anteil sinkt von ${SUBI_SHARE[0]*100}% auf ${SUBI_SHARE[11]*100}% | Urlaub/Krankheit berücksichtigt</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
          <thead>
            <tr style="background: ${color}; color: white;">
              <th style="padding: 5px 3px; text-align: left; border: 1px solid rgba(0,0,0,0.2);">Monat</th>
              <th style="padding: 5px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">Saison</th>
              <th style="padding: 5px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">Wachst.</th>
              <th style="padding: 5px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">Eff.Tage</th>
              <th style="padding: 5px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">Fahrten</th>
              <th style="padding: 5px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">Eigen</th>
              <th style="padding: 5px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">Subi</th>
              <th style="padding: 5px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">Subi %</th>
              <th style="padding: 5px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2);">Umsatz</th>
              <th style="padding: 5px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2);">Var.Kost.</th>
              <th style="padding: 5px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2);">Fixkost.</th>
              <th style="padding: 5px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2); font-weight: 700;">Gewinn</th>
              <th style="padding: 5px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2);">Kum.Gew.</th>
            </tr>
          </thead>
          <tbody>
            ${months.map((m, i) => `
              <tr style="background: ${m.monthlyProfit >= 0 ? (i % 2 === 0 ? '#f0fdf4' : '#ffffff') : (i % 2 === 0 ? '#fef2f2' : '#fff5f5')};">
                <td style="padding: 4px 3px; border: 1px solid #e5e7eb; font-weight: 600;">${m.monthName}${m.driverCount > 1 ? ' <span style="color:#f59e0b;font-size:8px;">2F</span>' : ''}</td>
                <td style="padding: 4px 3px; text-align: center; border: 1px solid #e5e7eb; font-size: 8px;">${seasonLabel(m.seasonalFactor)}</td>
                <td style="padding: 4px 3px; text-align: center; border: 1px solid #e5e7eb;">${fmtPct(m.growthFactor * 100)}</td>
                <td style="padding: 4px 3px; text-align: center; border: 1px solid #e5e7eb;">${m.effectiveWorkDays}</td>
                <td style="padding: 4px 3px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700;">${m.totalTrips}</td>
                <td style="padding: 4px 3px; text-align: center; border: 1px solid #e5e7eb; color: #2563eb; font-weight: 600;">${m.ownContainersTotal}</td>
                <td style="padding: 4px 3px; text-align: center; border: 1px solid #e5e7eb; color: #9333ea;">${m.subiTripsTotal}</td>
                <td style="padding: 4px 3px; text-align: center; border: 1px solid #e5e7eb; color: ${m.subiSharePercent > 35 ? '#dc2626' : '#666'};">${fmtPct(m.subiSharePercent)}</td>
                <td style="padding: 4px 3px; text-align: right; border: 1px solid #e5e7eb;">${fmt(m.totalRevenue, 0)}</td>
                <td style="padding: 4px 3px; text-align: right; border: 1px solid #e5e7eb;">${fmt(m.totalVariableCosts, 0)}</td>
                <td style="padding: 4px 3px; text-align: right; border: 1px solid #e5e7eb;">${fmt(m.fixedCosts, 0)}</td>
                <td style="padding: 4px 3px; text-align: right; border: 1px solid #e5e7eb; font-weight: 700; color: ${profitColor(m.monthlyProfit)};">${fmt(m.monthlyProfit, 0)}</td>
                <td style="padding: 4px 3px; text-align: right; border: 1px solid #e5e7eb; color: ${profitColor(m.cumulativeProfit)};">${fmt(m.cumulativeProfit, 0)}</td>
              </tr>
            `).join('')}
            <tr style="background: ${color}; color: white; font-weight: 700;">
              <td style="padding: 6px 3px; border: 1px solid rgba(0,0,0,0.2);">GESAMT</td>
              <td style="padding: 6px 3px; border: 1px solid rgba(0,0,0,0.2);">—</td>
              <td style="padding: 6px 3px; border: 1px solid rgba(0,0,0,0.2);">—</td>
              <td style="padding: 6px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">${totalEffDays}</td>
              <td style="padding: 6px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">${totalTrips}</td>
              <td style="padding: 6px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">${totalOwn}</td>
              <td style="padding: 6px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">${totalSubi}</td>
              <td style="padding: 6px 3px; text-align: center; border: 1px solid rgba(0,0,0,0.2);">${fmtPct(totalSubi / Math.max(totalTrips, 1) * 100)}</td>
              <td style="padding: 6px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2);">${fmt(totalRevenue, 0)}</td>
              <td style="padding: 6px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2);">${fmt(totalVarCosts, 0)}</td>
              <td style="padding: 6px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2);">${fmt(totalFixed, 0)}</td>
              <td style="padding: 6px 3px; text-align: right; border: 1px solid rgba(0,0,0,0.2);">${fmt(totalProfit, 0)}</td>
              <td style="padding: 6px 3px; border: 1px solid rgba(0,0,0,0.2);">—</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 6px; font-size: 9px; color: #666;">
          <strong>Eigen</strong> = Fahrten mit eigenen Containern (Ø-Listenpreis, mengenabhängige Fixkosten) | <strong>Subi</strong> = Subunternehmer-Fahrten (pauschal ${fmt(data.avgSubiTripRevenue)} netto/Fahrt) | <strong>2F</strong> = 2 Fahrer aktiv | Kum.Gew. = kumulierter Gewinn seit Jahresbeginn
        </div>
      </div>
    `;
  }

  function renderGrowthChart(): string {
    const maxTrips = Math.max(
      ...data.scenarioA.map(m => m.totalTrips),
      ...data.scenarioB.map(m => m.totalTrips)
    );
    return `
      <div style="margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">Wachstumsverlauf & Szenarien-Vergleich ${data.year}</h2>
        <div style="display: flex; gap: 4px; align-items: flex-end; height: 180px; margin-bottom: 8px;">
          ${data.scenarioA.map((m, i) => {
            const hA = maxTrips > 0 ? (m.totalTrips / maxTrips) * 160 : 0;
            const hB = maxTrips > 0 ? (data.scenarioB[i].totalTrips / maxTrips) * 160 : 0;
            const hOwn = maxTrips > 0 ? (m.ownContainersTotal / maxTrips) * 160 : 0;
            return `
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;">
                <div style="display: flex; gap: 1px; align-items: flex-end; width: 100%; height: 160px;">
                  <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
                    <div style="height: ${hOwn}px; background: #2563eb; border-radius: 2px 2px 0 0;" title="Eigen: ${m.ownContainersTotal}"></div>
                    <div style="height: ${hA - hOwn}px; background: #93c5fd; border-radius: 2px 2px 0 0;" title="Subi: ${m.subiTripsTotal}"></div>
                  </div>
                  <div style="flex: 1; height: ${hB}px; background: #f59e0b; border-radius: 2px 2px 0 0;" title="Szenario B: ${data.scenarioB[i].totalTrips}"></div>
                </div>
                <div style="font-size: 8px; color: #666; text-align: center;">${m.monthName.slice(0, 3)}</div>
              </div>`;
          }).join('')}
        </div>
        <div style="display: flex; gap: 16px; justify-content: center; margin-top: 4px; font-size: 10px; flex-wrap: wrap;">
          <span><span style="display: inline-block; width: 12px; height: 12px; background: #2563eb; border-radius: 2px; vertical-align: middle;"></span> Szenario A: Eigen</span>
          <span><span style="display: inline-block; width: 12px; height: 12px; background: #93c5fd; border-radius: 2px; vertical-align: middle;"></span> Szenario A: Subi</span>
          <span><span style="display: inline-block; width: 12px; height: 12px; background: #f59e0b; border-radius: 2px; vertical-align: middle;"></span> Szenario B: Gesamt (2 Fahrer ab Jul)</span>
        </div>
      </div>
    `;
  }

  function renderContainerStock(): string {
    if (data.containerEvents.length === 0) {
      return `
        <div style="margin-top: 30px;">
          <h3 style="color: #1a1a1a; font-size: 16px; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; margin-bottom: 12px;">Container-Bestand</h3>
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 14px; font-size: 12px; color: #166534;">
            Der aktuelle Bestand von <strong>${data.initialContainerStock} Containern</strong> reicht für das gesamte Planjahr aus. Kein Nachkauf erforderlich.
          </div>
        </div>
      `;
    }
    const totalInvest = data.containerEvents.reduce((s, e) => s + e.cost, 0);
    return `
      <div style="margin-top: 30px;">
        <h3 style="color: #1a1a1a; font-size: 16px; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; margin-bottom: 12px;">Container-Bestand & Nachkäufe</h3>
        <p style="color: #666; font-size: 11px; margin-bottom: 8px;">Start: ${data.initialContainerStock} Container | Preis: ${fmt(data.containerPricePerUnit)} / Stück | Nachkauf in 10er-Paketen bei > 80% Auslastung</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #374151; color: white;">
              <th style="padding: 6px; text-align: left; border: 1px solid #555;">Monat</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555;">Bestand vorher</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555;">Nachkauf</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555;">Bestand nachher</th>
              <th style="padding: 6px; text-align: right; border: 1px solid #555;">Investition</th>
              <th style="padding: 6px; text-align: left; border: 1px solid #555;">Grund</th>
            </tr>
          </thead>
          <tbody>
            ${data.containerEvents.map((e, i) => `
              <tr style="background: ${i % 2 === 0 ? '#fef3c7' : '#fffbeb'};">
                <td style="padding: 5px 6px; border: 1px solid #e5e7eb; font-weight: 600;">${e.monthName}</td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb;">${e.stockBefore}</td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb; color: #16a34a; font-weight: 700;">+${e.purchased}</td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700;">${e.stockAfter}</td>
                <td style="padding: 5px 6px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">${fmt(e.cost, 0)}</td>
                <td style="padding: 5px 6px; border: 1px solid #e5e7eb; font-size: 10px;">${e.reason}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 6px; font-size: 11px; font-weight: 600;">
          Gesamtinvestition Container-Nachkauf: <span style="color: #dc2626;">${fmt(totalInvest, 0)}</span>
        </div>
      </div>
    `;
  }

  function renderBreakEvenAnalysis(): string {
    const be = data.breakEven;
    return `
      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #dc2626; padding-bottom: 8px; margin-bottom: 16px;">Break-Even-Analyse: Zweiter Fahrer + Fahrzeug</h2>
        
        <div style="display: flex; gap: 16px; margin-bottom: 20px;">
          <div style="flex: 1; background: #fef2f2; border: 2px solid #fca5a5; border-radius: 10px; padding: 16px;">
            <h4 style="margin: 0 0 10px 0; color: #991b1b; font-size: 13px;">Zusätzliche monatliche Kosten</h4>
            <div style="font-size: 11px; color: #7f1d1d;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Fahrer 2 (Gehalt + Spesen):</span>
                <strong>${fmt(data.driver2MonthlyCost)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Neues Fahrzeug (Leasing + Vers. + Wartung):</span>
                <strong>${fmt(data.newVehicleMonthlyCost)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid #fca5a5; font-weight: 700; font-size: 13px;">
                <span>Gesamte Mehrkosten/Monat:</span>
                <span>${fmt(be.additionalMonthlyCost)}</span>
              </div>
            </div>
          </div>

          <div style="flex: 1; background: ${be.profitDifference > 0 ? '#f0fdf4' : '#fef2f2'}; border: 2px solid ${be.profitDifference > 0 ? '#86efac' : '#fca5a5'}; border-radius: 10px; padding: 16px;">
            <h4 style="margin: 0 0 10px 0; color: ${be.profitDifference > 0 ? '#166534' : '#991b1b'}; font-size: 13px;">Jahresvergleich ${data.year}</h4>
            <div style="font-size: 11px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Szenario A (1 Fahrer):</span>
                <strong style="color: #2563eb;">${fmt(be.withoutDriver2YearProfit, 0)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Szenario B (2 Fahrer ab Jul):</span>
                <strong style="color: #f59e0b;">${fmt(be.driver2YearProfit, 0)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid ${be.profitDifference > 0 ? '#86efac' : '#fca5a5'}; font-weight: 700; font-size: 13px;">
                <span>Differenz:</span>
                <span style="color: ${profitColor(be.profitDifference)};">${fmt(be.profitDifference, 0)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="color: #1a1a1a; margin: 0 0 8px 0; font-size: 14px;">Monatlicher Gewinnvergleich A vs B</h4>
          <div style="display: flex; gap: 2px; align-items: flex-end; height: 140px; margin-bottom: 6px;">
            ${data.scenarioA.map((mA, i) => {
              const mB = data.scenarioB[i];
              const maxP = Math.max(...data.scenarioA.map(x => Math.abs(x.monthlyProfit)), ...data.scenarioB.map(x => Math.abs(x.monthlyProfit)));
              const hA = maxP > 0 ? Math.abs(mA.monthlyProfit) / maxP * 120 : 0;
              const hB = maxP > 0 ? Math.abs(mB.monthlyProfit) / maxP * 120 : 0;
              return `
                <div style="flex: 1; display: flex; gap: 1px; align-items: flex-end;">
                  <div style="flex: 1; height: ${hA}px; background: ${mA.monthlyProfit >= 0 ? '#3b82f6' : '#ef4444'}; border-radius: 2px 2px 0 0;" title="A: ${Math.round(mA.monthlyProfit)}€"></div>
                  <div style="flex: 1; height: ${hB}px; background: ${mB.monthlyProfit >= 0 ? '#f59e0b' : '#f87171'}; border-radius: 2px 2px 0 0;" title="B: ${Math.round(mB.monthlyProfit)}€"></div>
                </div>`;
            }).join('')}
          </div>
          <div style="display: flex; gap: 2px; font-size: 8px; text-align: center; color: #666;">
            ${MONTH_NAMES.map(n => `<div style="flex: 1;">${n.slice(0, 3)}</div>`).join('')}
          </div>
          <div style="display: flex; gap: 16px; justify-content: center; margin-top: 6px; font-size: 10px;">
            <span><span style="display: inline-block; width: 10px; height: 10px; background: #3b82f6; border-radius: 2px; vertical-align: middle;"></span> Szenario A</span>
            <span><span style="display: inline-block; width: 10px; height: 10px; background: #f59e0b; border-radius: 2px; vertical-align: middle;"></span> Szenario B</span>
          </div>
        </div>

        ${be.breakEvenMonth !== null ? `
          <div style="background: #eff6ff; border: 2px solid #60a5fa; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 14px; font-weight: 700; color: #1e40af; margin-bottom: 4px;">Break-Even erreicht: ${be.breakEvenMonthName}</div>
            <div style="font-size: 12px; color: #1e3a8a;">Ab diesem Monat erwirtschaftet der zweite Fahrer mehr als er kostet. Dauer bis Break-Even: ${be.monthsToBreakEven} Monat(e) nach Start.</div>
          </div>
        ` : `
          <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 14px; font-weight: 700; color: #991b1b;">Kein Break-Even im Planjahr ${data.year}</div>
            <div style="font-size: 12px; color: #7f1d1d;">Der zweite Fahrer erreicht im ersten Jahr keinen Break-Even. Die zusätzlichen Kosten übersteigen den Mehrertrag.</div>
          </div>
        `}

        <div style="background: ${be.profitDifference > 0 ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${be.profitDifference > 0 ? '#86efac' : '#fcd34d'}; border-radius: 6px; padding: 14px; font-size: 12px; color: ${be.profitDifference > 0 ? '#166534' : '#92400e'};">
          <strong>Empfehlung:</strong> ${be.recommendation}
        </div>
      </div>
    `;
  }

  function renderAnnualSummary(): string {
    const aProfitMonths = data.scenarioA.filter(m => m.monthlyProfit >= 0).length;
    const bProfitMonths = data.scenarioB.filter(m => m.monthlyProfit >= 0).length;
    const aAvgMonthly = data.scenarioATotalProfit / 12;
    const bAvgMonthly = data.scenarioBTotalProfit / 12;
    const worstA = data.scenarioA.reduce((min, m) => m.monthlyProfit < min.monthlyProfit ? m : min);
    const bestA = data.scenarioA.reduce((max, m) => m.monthlyProfit > max.monthlyProfit ? m : max);
    const worstB = data.scenarioB.reduce((min, m) => m.monthlyProfit < min.monthlyProfit ? m : min);
    const bestB = data.scenarioB.reduce((max, m) => m.monthlyProfit > max.monthlyProfit ? m : max);
    const subiShareA = data.scenarioATotalSubiTrips / Math.max(data.scenarioATotalTrips, 1) * 100;

    return `
      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">Jahresübersicht & Fazit ${data.year}</h2>
        
        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
          <div style="flex: 1; background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border-radius: 12px; padding: 20px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; opacity: 0.9;">Szenario A – 1 Fahrer (ganzes Jahr)</h3>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${fmt(data.scenarioATotalProfit, 0)}</div>
            <div style="font-size: 12px; opacity: 0.8;">Jahresgewinn</div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 11px;">
              <div>Umsatz: <strong>${fmt(data.scenarioATotalRevenue, 0)}</strong></div>
              <div>Fahrten gesamt: <strong>${data.scenarioATotalTrips}</strong> (davon ${data.scenarioATotalOwnContainers} eigen, ${data.scenarioATotalSubiTrips} subi)</div>
              <div>Subi-Anteil Ø: <strong>${fmtPct(subiShareA)}</strong></div>
              <div>Profitable Monate: <strong>${aProfitMonths} / 12</strong></div>
              <div>Ø Gewinn/Monat: <strong>${fmt(aAvgMonthly, 0)}</strong></div>
              <div>Bester: <strong>${bestA.monthName}</strong> (${fmt(bestA.monthlyProfit, 0)})</div>
              <div>Schwächster: <strong>${worstA.monthName}</strong> (${fmt(worstA.monthlyProfit, 0)})</div>
            </div>
          </div>
          <div style="flex: 1; background: linear-gradient(135deg, #92400e, #f59e0b); color: white; border-radius: 12px; padding: 20px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; opacity: 0.9;">Szenario B – 2 Fahrer (ab Juli ${data.year})</h3>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${fmt(data.scenarioBTotalProfit, 0)}</div>
            <div style="font-size: 12px; opacity: 0.8;">Jahresgewinn</div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 11px;">
              <div>Umsatz: <strong>${fmt(data.scenarioBTotalRevenue, 0)}</strong></div>
              <div>Fahrten gesamt: <strong>${data.scenarioBTotalTrips}</strong> (davon ${data.scenarioBTotalOwnContainers} eigen, ${data.scenarioBTotalSubiTrips} subi)</div>
              <div>Mehrkosten Fahrer+Fzg: <strong>${fmt(data.breakEven.additionalMonthlyCost)}/Monat</strong></div>
              <div>Profitable Monate: <strong>${bProfitMonths} / 12</strong></div>
              <div>Ø Gewinn/Monat: <strong>${fmt(bAvgMonthly, 0)}</strong></div>
              <div>Bester: <strong>${bestB.monthName}</strong> (${fmt(bestB.monthlyProfit, 0)})</div>
              <div>Schwächster: <strong>${worstB.monthName}</strong> (${fmt(worstB.monthlyProfit, 0)})</div>
            </div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h4 style="color: #1a1a1a; margin: 0 0 8px 0;">Kernerkenntnisse</h4>
          <ul style="font-size: 12px; color: #475569; padding-left: 20px; margin: 0;">
            <li style="margin-bottom: 6px;">Das Geschäft startet mit <strong>${fmtPct(GROWTH_FACTORS[0]*100)} Auslastung</strong> im Januar und wächst auf <strong>${fmtPct(GROWTH_FACTORS[11]*100)}</strong> bis Dezember – eine realistische Aufbaukurve basierend auf den BWA-2025-Zahlen.</li>
            <li style="margin-bottom: 6px;">Der <strong>Subi-Anteil</strong> sinkt von ${fmtPct(SUBI_SHARE[0]*100)} auf ${fmtPct(SUBI_SHARE[11]*100)}. Subi-Fahrten bringen pauschal ${fmt(data.avgSubiTripRevenue)} netto/Fahrt – je mehr Eigenkunden, desto besser die Marge.</li>
            <li style="margin-bottom: 6px;">Die <strong>BWA-2025-Baseline</strong> (Ø ${fmt(data.bwaBaselineMonthlyRevenue, 0)}/Monat in den letzten 3 aktiven Monaten) dient als realistischer Ausgangspunkt.</li>
            <li style="margin-bottom: 6px;">Der zweite Fahrer bringt im Vergleich <strong style="color: ${profitColor(data.breakEven.profitDifference)};">${fmt(data.breakEven.profitDifference, 0)}</strong> mehr/weniger Jahresgewinn.</li>
            <li style="margin-bottom: 6px;">Containerbestand: Start ${data.initialContainerStock} Stück${data.containerEvents.length > 0 ? `, ${data.containerEvents.reduce((s, e) => s + e.purchased, 0)} nachgekauft (${fmt(data.containerEvents.reduce((s, e) => s + e.cost, 0), 0)})` : ' – kein Nachkauf nötig'}.</li>
          </ul>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 14px; font-size: 12px; color: #166534;">
          <strong>Fazit:</strong> ${data.breakEven.recommendation}
        </div>
      </div>
    `;
  }

  function renderAbsenceTable(): string {
    const vacPerMonth = getVacationDaysPerMonth();
    const sickPerMonth = getSickDaysPerMonth();
    return `
      <div style="margin-top: 40px;">
        <h2 style="color: #1a1a1a; font-size: 20px; border-bottom: 3px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px;">Personalausfälle & Arbeitstage ${data.year}</h2>
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 12px; color: #92400e;">
          <strong>Annahmen:</strong> Jeder Fahrer hat ${data.vacationDaysPerDriver} Urlaubstage und ca. ${data.sickDaysPerDriver} Krankheitstage pro Jahr. 
          Urlaub wird saisonal verteilt (Schwerpunkt Sommer/Weihnachten). Krankheitstage konzentrieren sich auf die Wintermonate.
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #374151; color: white;">
              <th style="padding: 6px; text-align: left; border: 1px solid #555;">Monat</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555;">Kalender-Arb.tage</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555;">Urlaub (Tage)</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555;">Krank (Tage)</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555; font-weight: 700;">Effektive Arb.tage</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555;">Saisonfaktor</th>
              <th style="padding: 6px; text-align: center; border: 1px solid #555;">Wachstumsfaktor</th>
            </tr>
          </thead>
          <tbody>
            ${data.scenarioA.map((m, i) => `
              <tr style="background: ${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
                <td style="padding: 5px 6px; border: 1px solid #e5e7eb; font-weight: 500;">${m.monthName}</td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb;">${m.totalWorkDays}</td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb; color: #2563eb;">${vacPerMonth[i]}</td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb; color: #dc2626;">${sickPerMonth[i]}</td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700;">${m.effectiveWorkDays}</td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb;">${seasonLabel(m.seasonalFactor)} <span style="color: #999; font-size: 9px;">(×${fmtNum(m.seasonalFactor, 2)})</span></td>
                <td style="padding: 5px 6px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700;">${fmtPct(m.growthFactor * 100)}</td>
              </tr>
            `).join('')}
            <tr style="background: #374151; color: white; font-weight: 700;">
              <td style="padding: 6px; border: 1px solid #555;">GESAMT</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #555;">${data.scenarioA.reduce((s, m) => s + m.totalWorkDays, 0)}</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #555;">${vacPerMonth.reduce((s, v) => s + v, 0)}</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #555;">${sickPerMonth.reduce((s, v) => s + v, 0)}</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #555;">${data.scenarioA.reduce((s, m) => s + m.effectiveWorkDays, 0)}</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #555;">—</td>
              <td style="padding: 6px; text-align: center; border: 1px solid #555;">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Realistische Jahresplanung ${data.year} - Rieprecht GmbH</title>
  <style>
    @page { size: landscape; margin: 10mm; }
    @media print {
      body { margin: 0; padding: 0; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 1000px; margin: 0 auto; padding: 20px; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>
  <!-- Cover -->
  <div style="text-align: center; padding: 40px 20px; border-bottom: 4px solid #1a1a1a;">
    <div style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px;">Rieprecht GmbH · Containerdienst Hamburg</div>
    <h1 style="font-size: 28px; color: #1a1a1a; margin: 16px 0 8px 0; font-weight: 800;">Realistische Jahresplanung ${data.year}</h1>
    <h2 style="font-size: 15px; color: #64748b; font-weight: 400; margin: 0 0 6px 0;">Wachstumskurve · Eigen vs. Subi · Container-Bestand · Break-Even</h2>
    <h3 style="font-size: 13px; color: #64748b; font-weight: 400; margin: 0 0 20px 0;">Szenario A (1 Fahrer) vs. Szenario B (2 Fahrer ab Juli) · Basierend auf BWA 2025</h3>
    <div style="background: #f8fafc; border-radius: 8px; padding: 14px; display: inline-block; text-align: left; font-size: 12px;">
      <table style="border-collapse: collapse;">
        <tr><td style="padding: 2px 14px 2px 0; color: #64748b;">Erstellt am:</td><td style="font-weight: 600;">${data.generatedAt}</td></tr>
        <tr><td style="padding: 2px 14px 2px 0; color: #64748b;">Planungsjahr:</td><td style="font-weight: 600;">01.01.${data.year} – 31.12.${data.year}</td></tr>
        <tr><td style="padding: 2px 14px 2px 0; color: #64748b;">BWA-Baseline (Ø letzte 3 Mon.):</td><td style="font-weight: 600;">${fmt(data.bwaBaselineMonthlyRevenue, 0)}</td></tr>
        <tr><td style="padding: 2px 14px 2px 0; color: #64748b;">Container-Bestand Start:</td><td style="font-weight: 600;">${data.initialContainerStock} Stück</td></tr>
        <tr><td style="padding: 2px 14px 2px 0; color: #64748b;">Ø Erlös Eigen-Container:</td><td style="font-weight: 600;">${fmt(data.avgOwnContainerRevenue)}</td></tr>
        <tr><td style="padding: 2px 14px 2px 0; color: #64748b;">Ø Erlös Subi-Fahrt:</td><td style="font-weight: 600;">${fmt(data.avgSubiTripRevenue)} netto (pauschal)</td></tr>
        <tr><td style="padding: 2px 14px 2px 0; color: #64748b;">Entfernung:</td><td style="font-weight: 600;">${data.distance} km (einfach)</td></tr>
        <tr><td style="padding: 2px 14px 2px 0; color: #64748b;">Urlaub/Krankheit:</td><td style="font-weight: 600;">${data.vacationDaysPerDriver} + ${data.sickDaysPerDriver} Tage pro Fahrer</td></tr>
      </table>
    </div>
  </div>

  <!-- Methodik -->
  <div style="margin-top: 30px;">
    <h2 style="color: #1a1a1a; font-size: 18px; border-bottom: 3px solid #1a1a1a; padding-bottom: 6px; margin-bottom: 12px;">Berechnungsmethodik – Realistisches Wachstumsmodell</h2>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px;">
      <p style="margin: 0 0 10px 0;">Diese Planung basiert auf den <strong>realen BWA-2025-Zahlen</strong> und modelliert ein realistisches Wachstum:</p>
      <ol style="padding-left: 20px; margin: 0;">
        <li style="margin-bottom: 6px;"><strong>Wachstumskurve:</strong> Start bei ${fmtPct(GROWTH_FACTORS[0]*100)} Auslastung (Jan), wachsend auf ${fmtPct(GROWTH_FACTORS[11]*100)} (Dez). Die Kapazität steigt durch Kundengewinnung und Marketing.</li>
        <li style="margin-bottom: 6px;"><strong>Saisonale Schwankungen:</strong> Überlagern die Wachstumskurve. Winter (Dez–Feb): 45–55%, Sommer (Jun–Jul): 110%.</li>
        <li style="margin-bottom: 6px;"><strong>Eigen vs. Subi:</strong> Subi-Anteil sinkt von ${fmtPct(SUBI_SHARE[0]*100)} (Jan) auf ${fmtPct(SUBI_SHARE[11]*100)} (Dez). Subi bringt pauschal ${fmt(data.avgSubiTripRevenue)} netto pro Fahrt.</li>
        <li style="margin-bottom: 6px;"><strong>Container-Bestand:</strong> Start: ${data.initialContainerStock} Container. Nachkauf in 10er-Paketen (${fmt(data.containerPricePerUnit)}/Stk.) sobald > 80% Auslastung.</li>
        <li style="margin-bottom: 6px;"><strong>Personalausfälle:</strong> 30 Urlaubstage + 10 Krankheitstage pro Fahrer, saisonal verteilt.</li>
        <li style="margin-bottom: 6px;"><strong>Zwei Szenarien:</strong> A = 1 Fahrer ganzes Jahr | B = 2 Fahrer + neues Fahrzeug ab Juli ${data.year}.</li>
      </ol>
      <div style="background: #dbeafe; border-radius: 6px; padding: 10px; margin-top: 12px; font-size: 11px;">
        <strong>Preiskalkulation je Monat (Rechner-Logik):</strong> Die Fixkosten pro Container ändern sich monatlich, weil die Container-Menge/Tag schwankt. Mehr Fahrten = niedrigere Stückkosten = bessere Marge. Eigene Container werden zum Ø-Listenpreis bewertet, zusätzlich wird die Marktpreis-Marge berechnet. Subi-Fahrten bringen pauschal ${fmt(data.avgSubiTripRevenue)} netto unabhängig vom Material.
      </div>
    </div>
  </div>

  ${renderAbsenceTable()}
  ${renderGrowthChart()}
  ${renderContainerStock()}
  ${renderMonthlyOverview(data.scenarioA, 'Szenario A – 1 Fahrer (Stefan)', '#1e40af')}
  ${renderMonthlyOverview(data.scenarioB, 'Szenario B – 2 Fahrer (ab Juli ' + data.year + ')', '#92400e')}
  ${renderBreakEvenAnalysis()}
  ${renderAnnualSummary()}

  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 16px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8;">
    <p>Rieprecht GmbH · Containerdienst Hamburg</p>
    <p>Realistische Jahresplanung ${data.year} · Erstellt am ${data.generatedAt} · Alle Preise in EUR netto</p>
    <p style="color: #cbd5e1; font-size: 9px;">Berechnungsgrundlage: BWA 2025, aktuelle Betriebskosten, Wachstumsmodell mit saisonalen Schwankungen, Marktpreise Region Hamburg</p>
  </div>
</body>
</html>`;
}

export function generateAnnualReportCSV(data: AnnualReportData): string {
  const sep = ';';
  const lines: string[] = [];
  const de = (v: number, d = 2) => v.toFixed(d).replace('.', ',');

  lines.push(`Rieprecht GmbH - Jahresplanung ${data.year}`);
  lines.push(`Erstellt am${sep}${data.generatedAt}`);
  lines.push(`Entfernung${sep}${data.distance} km`);
  lines.push('');

  lines.push(`Szenario A - Nur 1 Fahrer`);
  lines.push(['Monat', 'Eff.Tage', 'Wachst.%', 'Saison', 'Fahrten', 'Eigen', 'Subi', 'Subi%', 'Umsatz', 'Var.Kosten', 'Fixkosten', 'Gewinn', 'Kum.Gewinn'].join(sep));
  for (const m of data.scenarioA) {
    lines.push([
      m.monthName, m.effectiveWorkDays, de(m.growthFactor * 100, 1), de(m.seasonalFactor),
      m.totalTrips, m.ownContainersTotal, m.subiTripsTotal, de(m.subiSharePercent, 1),
      de(m.totalRevenue), de(m.totalVariableCosts), de(m.fixedCosts),
      de(m.monthlyProfit), de(m.cumulativeProfit)
    ].join(sep));
  }
  lines.push(['GESAMT', '', '', '',
    data.scenarioATotalTrips, data.scenarioATotalOwnContainers, data.scenarioATotalSubiTrips, '',
    de(data.scenarioATotalRevenue), '', '', de(data.scenarioATotalProfit), ''
  ].join(sep));
  lines.push('');

  lines.push(`Szenario B - 2 Fahrer ab ${MONTH_NAMES[data.breakEven.driver2StartMonth]}`);
  lines.push(['Monat', 'Eff.Tage', 'Wachst.%', 'Saison', 'Fahrten', 'Eigen', 'Subi', 'Subi%', 'Umsatz', 'Var.Kosten', 'Fixkosten', 'Gewinn', 'Kum.Gewinn'].join(sep));
  for (const m of data.scenarioB) {
    lines.push([
      m.monthName, m.effectiveWorkDays, de(m.growthFactor * 100, 1), de(m.seasonalFactor),
      m.totalTrips, m.ownContainersTotal, m.subiTripsTotal, de(m.subiSharePercent, 1),
      de(m.totalRevenue), de(m.totalVariableCosts), de(m.fixedCosts),
      de(m.monthlyProfit), de(m.cumulativeProfit)
    ].join(sep));
  }
  lines.push(['GESAMT', '', '', '',
    data.scenarioBTotalTrips, data.scenarioBTotalOwnContainers, data.scenarioBTotalSubiTrips, '',
    de(data.scenarioBTotalRevenue), '', '', de(data.scenarioBTotalProfit), ''
  ].join(sep));
  lines.push('');

  lines.push('Margenanalyse (Szenario A)');
  lines.push(['Monat', 'Container/Tag', 'Basiskosten', 'Ø Listenpreis', 'Listenpreis-Marge %', 'Ø Marktpreis', 'Marktpreis-Marge %'].join(sep));
  for (const m of data.scenarioA) {
    lines.push([
      m.monthName, de(m.actualContainersPerDay, 1),
      de(m.avgBaseCostPerContainer), de(m.avgListPricePerContainer), de(m.marginPercentAtListPrice, 1),
      de(m.avgMarketPricePerContainer), de(m.marginPercentAtMarketPrice, 1)
    ].join(sep));
  }
  lines.push('');

  lines.push('Break-Even-Analyse');
  lines.push(`Jahresgewinn Szenario A${sep}${de(data.breakEven.withoutDriver2YearProfit)}`);
  lines.push(`Jahresgewinn Szenario B${sep}${de(data.breakEven.driver2YearProfit)}`);
  lines.push(`Gewinn-Differenz${sep}${de(data.breakEven.profitDifference)}`);
  lines.push(`Break-Even Monat${sep}${data.breakEven.breakEvenMonthName || 'Nicht erreicht'}`);
  lines.push(`Empfehlung${sep}${data.breakEven.recommendation}`);

  return lines.join('\n');
}
