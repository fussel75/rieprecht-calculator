import type { PurchaseSurcharge, SalesSurcharge } from "@shared/schema";

export function calcPurchaseSurchargeTotal(
  purchaseSurchargeIds: number[] | null | undefined,
  allSurcharges: PurchaseSurcharge[],
  _billingUnit: "tonne" | "m3",
  weightT: number,
  volumeM3: number,
  isDangerous: boolean
): number {
  const ids = purchaseSurchargeIds || [];
  if (ids.length === 0) return 0;
  return allSurcharges
    .filter(s => ids.includes(s.id) && s.isActive)
    .filter(s => !s.appliesToDangerous || isDangerous)
    .reduce((sum, s) => {
      const amt = Number(s.amount);
      if (s.unit === "tonne") return sum + amt * weightT;
      if (s.unit === "m3") return sum + amt * volumeM3;
      if (s.unit === "stueck") return sum + amt;
      return sum;
    }, 0);
}

export function calcSalesSurchargeTotal(
  salesSurchargeIds: number[] | null | undefined,
  allSurcharges: SalesSurcharge[],
  unit: "tonne" | "m3",
  weightT: number,
  volumeM3: number,
  isDangerous: boolean
): number {
  const ids = salesSurchargeIds || [];
  if (ids.length === 0) return 0;
  return allSurcharges
    .filter(s => ids.includes(s.id) && s.isActive)
    .filter(s => !s.appliesToDangerous || isDangerous)
    .filter(s => s.unit === unit || s.unit === "stueck")
    .reduce((sum, s) => {
      const amt = Number(s.amount);
      if (s.unit === "tonne") return sum + amt * weightT;
      if (s.unit === "m3") return sum + amt * volumeM3;
      if (s.unit === "stueck") return sum + amt;
      return sum;
    }, 0);
}

export function getSalesSurchargeLines(
  salesSurchargeIds: number[] | null | undefined,
  allSurcharges: SalesSurcharge[],
  unit: "tonne" | "m3",
  weightT: number,
  volumeM3: number,
  isDangerous: boolean
): { name: string; amount: number; unit: string; total: number }[] {
  const ids = salesSurchargeIds || [];
  if (ids.length === 0) return [];
  return allSurcharges
    .filter(s => ids.includes(s.id) && s.isActive)
    .filter(s => !s.appliesToDangerous || isDangerous)
    .filter(s => s.unit === unit || s.unit === "stueck")
    .map(s => {
      const amt = Number(s.amount);
      let total = 0;
      if (s.unit === "tonne") total = amt * weightT;
      else if (s.unit === "m3") total = amt * volumeM3;
      else if (s.unit === "stueck") total = amt;
      return { name: s.name, amount: amt, unit: s.unit, total };
    });
}
