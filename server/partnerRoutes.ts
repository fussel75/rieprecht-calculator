import { Router, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { 
  partnerApiKeys, partnerProducts, partnerVariants, partnerOrders,
  partnerCalendar, partnerGeoZones, partnerPlzExceptions, partnerSettings,
  customers, materials, salesPrices, costVariables, salesSurcharges, purchaseSurcharges, marketPrices,
  planningSettings, vehicles, employees, loans
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

interface PartnerRequest extends Request {
  apiKeyRecord?: {
    id: number;
    name: string;
    permissions: string[];
  };
}

async function requireApiKey(req: PartnerRequest, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"] as string;
  if (!key) {
    return res.status(401).json({ error: "Kein API-Key angegeben" });
  }

  const [record] = await db.select().from(partnerApiKeys).where(
    and(eq(partnerApiKeys.apiKey, key), eq(partnerApiKeys.isActive, true))
  );

  if (!record) {
    return res.status(401).json({ error: "Ungültiger oder deaktivierter API-Key" });
  }

  await db.update(partnerApiKeys).set({ lastUsedAt: new Date() }).where(eq(partnerApiKeys.id, record.id));

  req.apiKeyRecord = { id: record.id, name: record.name, permissions: record.permissions };
  next();
}

function requirePerm(perm: string) {
  return (req: PartnerRequest, res: Response, next: NextFunction) => {
    const perms = req.apiKeyRecord?.permissions || [];
    if (!perms.includes(perm) && !perms.includes("admin")) {
      return res.status(403).json({ error: `Berechtigung '${perm}' fehlt` });
    }
    next();
  };
}

router.use(requireApiKey as any);
router.use(requirePerm("read") as any);

// ─── PRODUKTE ───────────────────────────────────────────────────────────────

router.get("/products", async (_req, res) => {
  const products = await db.select().from(partnerProducts).orderBy(partnerProducts.sortOrder);
  const variants = await db.select().from(partnerVariants).where(eq(partnerVariants.isActive, true));
  const result = products.map(p => ({
    ...p,
    variants: variants.filter(v => v.productId === p.id),
  }));
  res.json(result);
});

router.get("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [product] = await db.select().from(partnerProducts).where(eq(partnerProducts.id, id));
  if (!product) return res.status(404).json({ error: "Produkt nicht gefunden" });
  const vars = await db.select().from(partnerVariants).where(eq(partnerVariants.productId, id));
  res.json({ ...product, variants: vars });
});

router.post("/products", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const { name, slug, description, category, imageUrl, materialId, isActive, sortOrder } = req.body;
  if (!name || !category) return res.status(400).json({ error: "Name und Kategorie sind Pflichtfelder" });
  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const [product] = await db.insert(partnerProducts).values({
    name, slug: finalSlug, description, category, imageUrl, materialId, isActive, sortOrder,
  }).returning();
  res.status(201).json(product);
});

router.put("/products/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(partnerProducts).where(eq(partnerProducts.id, id));
  if (!existing) return res.status(404).json({ error: "Produkt nicht gefunden" });
  const [updated] = await db.update(partnerProducts).set({ ...req.body, updatedAt: new Date() }).where(eq(partnerProducts.id, id)).returning();
  res.json(updated);
});

router.delete("/products/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [deleted] = await db.delete(partnerProducts).where(eq(partnerProducts.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Produkt nicht gefunden" });
  res.json({ success: true, deleted });
});

// ─── VARIANTEN ──────────────────────────────────────────────────────────────

router.get("/variants", async (_req, res) => {
  const all = await db.select().from(partnerVariants).orderBy(partnerVariants.sortOrder);
  res.json(all);
});

router.get("/variants/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [v] = await db.select().from(partnerVariants).where(eq(partnerVariants.id, id));
  if (!v) return res.status(404).json({ error: "Variante nicht gefunden" });
  res.json(v);
});

router.post("/variants", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const { productId, label, volume, weight, unit, priceNet, priceGross, taxRate, containerSize, isActive, sortOrder } = req.body;
  if (!productId || !label || priceNet == null || priceGross == null) {
    return res.status(400).json({ error: "productId, label, priceNet und priceGross sind Pflichtfelder" });
  }
  const [v] = await db.insert(partnerVariants).values({
    productId, label, volume, weight, unit, priceNet: String(priceNet), priceGross: String(priceGross), taxRate, containerSize, isActive, sortOrder,
  }).returning();
  res.status(201).json(v);
});

router.put("/variants/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const updates: any = { ...req.body };
  if (updates.priceNet != null) updates.priceNet = String(updates.priceNet);
  if (updates.priceGross != null) updates.priceGross = String(updates.priceGross);
  const [updated] = await db.update(partnerVariants).set(updates).where(eq(partnerVariants.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Variante nicht gefunden" });
  res.json(updated);
});

router.delete("/variants/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [deleted] = await db.delete(partnerVariants).where(eq(partnerVariants.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Variante nicht gefunden" });
  res.json({ success: true, deleted });
});

// ─── BESTELLUNGEN ───────────────────────────────────────────────────────────

async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const r = crypto.randomInt(1000, 9999);
    const orderNumber = `RP-${d}-${r}`;
    const [exists] = await db.select({ id: partnerOrders.id }).from(partnerOrders).where(eq(partnerOrders.orderNumber, orderNumber));
    if (!exists) return orderNumber;
  }
  const fallback = crypto.randomBytes(4).toString("hex");
  return `RP-${d}-${fallback}`;
}

router.get("/orders", async (req, res) => {
  const status = req.query.status as string | undefined;
  let query = db.select().from(partnerOrders).orderBy(desc(partnerOrders.createdAt));
  if (status) {
    const rows = await db.select().from(partnerOrders).where(eq(partnerOrders.status, status)).orderBy(desc(partnerOrders.createdAt));
    return res.json(rows);
  }
  const rows = await query;
  res.json(rows);
});

router.get("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [order] = await db.select().from(partnerOrders).where(eq(partnerOrders.id, id));
  if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden" });
  res.json(order);
});

router.post("/orders", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const { variantId, deliveryDate, deliveryStreet, deliveryHouseNr, deliveryZip, deliveryCity, deliveryNotes,
    guestName, guestEmail, guestPhone, customerId, paymentMethod, quantity } = req.body;

  if (!variantId) return res.status(400).json({ error: "variantId ist ein Pflichtfeld" });

  const [variant] = await db.select().from(partnerVariants).where(eq(partnerVariants.id, variantId));
  if (!variant) return res.status(400).json({ error: "Variante nicht gefunden" });

  const [product] = variant.productId
    ? await db.select().from(partnerProducts).where(eq(partnerProducts.id, variant.productId))
    : [null];

  const qty = quantity || 1;
  const netTotal = Number(variant.priceNet) * qty;
  const grossTotal = Number(variant.priceGross) * qty;

  const [order] = await db.insert(partnerOrders).values({
    orderNumber: await generateOrderNumber(),
    variantId,
    productName: product?.name || null,
    variantLabel: variant.label,
    quantity: qty,
    priceNet: String(netTotal),
    priceGross: String(grossTotal),
    taxRate: variant.taxRate,
    status: "PENDING",
    deliveryDate, deliveryStreet, deliveryHouseNr, deliveryZip, deliveryCity, deliveryNotes,
    guestName, guestEmail, guestPhone, customerId,
    paymentMethod: paymentMethod || "RECHNUNG",
  }).returning();

  res.status(201).json(order);
});

router.put("/orders/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(partnerOrders).where(eq(partnerOrders.id, id));
  if (!existing) return res.status(404).json({ error: "Bestellung nicht gefunden" });
  const [updated] = await db.update(partnerOrders).set({ ...req.body, updatedAt: new Date() }).where(eq(partnerOrders.id, id)).returning();
  res.json(updated);
});

// ─── KUNDEN ─────────────────────────────────────────────────────────────────

router.get("/customers", async (_req, res) => {
  const all = await db.select().from(customers);
  res.json(all);
});

router.get("/customers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) return res.status(404).json({ error: "Kunde nicht gefunden" });
  res.json(c);
});

router.post("/customers", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const [c] = await db.insert(customers).values(req.body).returning();
  res.status(201).json(c);
});

router.put("/customers/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(customers).set(req.body).where(eq(customers.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Kunde nicht gefunden" });
  res.json(updated);
});

// ─── KALENDER ───────────────────────────────────────────────────────────────

router.get("/calendar", async (req, res) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  let rows;
  if (from && to) {
    rows = await db.select().from(partnerCalendar)
      .where(and(sql`${partnerCalendar.date} >= ${from}`, sql`${partnerCalendar.date} <= ${to}`));
  } else {
    rows = await db.select().from(partnerCalendar);
  }
  res.json(rows);
});

router.post("/calendar", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const { date, type, orderId, title, description, timeSlot, maxCapacity, isBlocked } = req.body;
  if (!date) return res.status(400).json({ error: "Datum ist ein Pflichtfeld" });
  const [entry] = await db.insert(partnerCalendar).values({
    date, type: type || "DELIVERY", orderId, title, description, timeSlot, maxCapacity, isBlocked,
  }).returning();
  res.status(201).json(entry);
});

router.put("/calendar/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(partnerCalendar).set(req.body).where(eq(partnerCalendar.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Kalendereintrag nicht gefunden" });
  res.json(updated);
});

router.delete("/calendar/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [deleted] = await db.delete(partnerCalendar).where(eq(partnerCalendar.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Kalendereintrag nicht gefunden" });
  res.json({ success: true, deleted });
});

// ─── GEO / LIEFERGEBIETE ───────────────────────────────────────────────────

router.get("/geo", async (_req, res) => {
  const all = await db.select().from(partnerGeoZones).where(eq(partnerGeoZones.isActive, true));
  res.json(all);
});

router.post("/geo", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const { zipFrom, zipTo, zoneName, deliverySurcharge } = req.body;
  if (!zipFrom || !zipTo) return res.status(400).json({ error: "zipFrom und zipTo sind Pflichtfelder" });
  const [zone] = await db.insert(partnerGeoZones).values({
    zipFrom, zipTo, zoneName, deliverySurcharge: deliverySurcharge ? String(deliverySurcharge) : "0",
  }).returning();
  res.status(201).json(zone);
});

router.delete("/geo/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [deleted] = await db.delete(partnerGeoZones).where(eq(partnerGeoZones.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Liefergebiet nicht gefunden" });
  res.json({ success: true, deleted });
});

// ─── PLZ-AUSNAHMEN ──────────────────────────────────────────────────────────

router.get("/plz-exceptions", async (_req, res) => {
  const all = await db.select().from(partnerPlzExceptions).where(eq(partnerPlzExceptions.isActive, true));
  res.json(all);
});

router.get("/plz-exceptions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [exc] = await db.select().from(partnerPlzExceptions).where(eq(partnerPlzExceptions.id, id));
  if (!exc) return res.status(404).json({ error: "PLZ-Ausnahme nicht gefunden" });
  res.json(exc);
});

router.post("/plz-exceptions", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const { zip, rule, surcharge, minOrderValue, note } = req.body;
  if (!zip || !rule) return res.status(400).json({ error: "PLZ und Regel sind Pflichtfelder" });
  const [exc] = await db.insert(partnerPlzExceptions).values({
    zip, rule, surcharge: surcharge ? String(surcharge) : "0", minOrderValue: minOrderValue ? String(minOrderValue) : null, note,
  }).returning();
  res.status(201).json(exc);
});

router.put("/plz-exceptions/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const updates: any = { ...req.body };
  if (updates.surcharge != null) updates.surcharge = String(updates.surcharge);
  if (updates.minOrderValue != null) updates.minOrderValue = String(updates.minOrderValue);
  const [updated] = await db.update(partnerPlzExceptions).set(updates).where(eq(partnerPlzExceptions.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "PLZ-Ausnahme nicht gefunden" });
  res.json(updated);
});

router.delete("/plz-exceptions/:id", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [deleted] = await db.delete(partnerPlzExceptions).where(eq(partnerPlzExceptions.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "PLZ-Ausnahme nicht gefunden" });
  res.json({ success: true, deleted });
});

// ─── EINSTELLUNGEN ──────────────────────────────────────────────────────────

router.get("/settings", async (_req, res) => {
  const [s] = await db.select().from(partnerSettings).where(eq(partnerSettings.id, 1));
  res.json(s || {});
});

router.put("/settings", requirePerm("admin") as any, async (req: PartnerRequest, res: Response) => {
  const [existing] = await db.select().from(partnerSettings).where(eq(partnerSettings.id, 1));
  if (existing) {
    const [updated] = await db.update(partnerSettings).set({ ...req.body, updatedAt: new Date() }).where(eq(partnerSettings.id, 1)).returning();
    return res.json(updated);
  }
  const [created] = await db.insert(partnerSettings).values({ ...req.body, id: 1 }).returning();
  res.json(created);
});

// ─── DASHBOARD ──────────────────────────────────────────────────────────────

router.get("/dashboard", async (_req, res) => {
  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(partnerProducts);
  const [variantCount] = await db.select({ count: sql<number>`count(*)` }).from(partnerVariants);
  const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(partnerOrders);
  const [pendingOrders] = await db.select({ count: sql<number>`count(*)` }).from(partnerOrders).where(eq(partnerOrders.status, "PENDING"));
  const [customerCount] = await db.select({ count: sql<number>`count(*)` }).from(customers);

  const recentOrders = await db.select().from(partnerOrders).orderBy(desc(partnerOrders.createdAt)).limit(10);

  const [revenueResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(price_gross AS NUMERIC)), 0)`,
  }).from(partnerOrders).where(
    and(eq(partnerOrders.status, "CONFIRMED"), sql`${partnerOrders.paymentStatus} != 'REFUNDED'`)
  );

  res.json({
    products: Number(productCount.count),
    variants: Number(variantCount.count),
    orders: Number(orderCount.count),
    pendingOrders: Number(pendingOrders.count),
    customers: Number(customerCount.count),
    totalRevenue: Number(revenueResult.total),
    recentOrders,
  });
});

// ─── API-KEYS (nur Admin) ──────────────────────────────────────────────────

router.get("/keys", requirePerm("admin") as any, async (_req: PartnerRequest, res: Response) => {
  const all = await db.select({
    id: partnerApiKeys.id,
    name: partnerApiKeys.name,
    apiKey: partnerApiKeys.apiKey,
    permissions: partnerApiKeys.permissions,
    isActive: partnerApiKeys.isActive,
    createdAt: partnerApiKeys.createdAt,
    lastUsedAt: partnerApiKeys.lastUsedAt,
  }).from(partnerApiKeys);
  const masked = all.map(k => ({
    ...k,
    apiKey: k.apiKey.slice(0, 6) + "..." + k.apiKey.slice(-4),
  }));
  res.json(masked);
});

router.post("/keys", requirePerm("admin") as any, async (req: PartnerRequest, res: Response) => {
  const { name, permissions } = req.body;
  if (!name) return res.status(400).json({ error: "Name ist ein Pflichtfeld" });
  const apiKey = `rp_${crypto.randomBytes(32).toString("hex")}`;
  const [key] = await db.insert(partnerApiKeys).values({
    name,
    apiKey,
    permissions: permissions || ["read"],
  }).returning();
  res.status(201).json(key);
});

router.delete("/keys/:id", requirePerm("admin") as any, async (req: PartnerRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const [deleted] = await db.update(partnerApiKeys).set({ isActive: false }).where(eq(partnerApiKeys.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "API-Key nicht gefunden" });
  res.json({ success: true, deactivated: deleted });
});

// ─── KALKULATOR (interne Preisberechnung mit allen Details – nur Admin/Write) ─

router.post("/calculate-price", requirePerm("write") as any, async (req: PartnerRequest, res: Response) => {
  const { materialId, containerSize, distanceKm, quantity, inputType, inputValue } = req.body;

  if (!materialId || !containerSize || distanceKm == null) {
    return res.status(400).json({ error: "materialId, containerSize und distanceKm sind Pflichtfelder" });
  }

  const [material] = await db.select().from(materials).where(eq(materials.id, materialId));
  if (!material) return res.status(404).json({ error: "Material nicht gefunden" });

  const allSalesPrices = await db.select().from(salesPrices).where(eq(salesPrices.isActive, true));
  const normalizeAvv = (code: string | null) => (code || "").replace(/[\s\-\.]/g, "").replace(/\*$/, "").toLowerCase();
  const matAvv = normalizeAvv(material.avvNumber);
  const isLieferung = (material as any).materialType === 'lieferung';

  let sp;
  if (isLieferung) {
    sp = allSalesPrices.find(s => s.priceType === 'lieferung' && s.materialName.toLowerCase().includes(material.name.toLowerCase()))
      || allSalesPrices.find(s => s.priceType === 'lieferung' && material.name.toLowerCase().includes(s.materialName.split(' ')[0].toLowerCase()));
  } else {
    sp = allSalesPrices.find(s => normalizeAvv(s.avvCode) === matAvv)
      || allSalesPrices.find(s => normalizeAvv(s.avvCode).startsWith(matAvv) || matAvv.startsWith(normalizeAvv(s.avvCode)));
  }

  const allVars = await db.select().from(costVariables);
  const dieselPrice = Number(allVars.find(v => v.name === "Diesel Preis")?.value || 1.70);
  const fuelConsumption = Number(allVars.find(v => v.name === "Verbrauch (L/100km)")?.value || 35);
  const tollPerKm = Number(allVars.find(v => v.name === "Maut / Gebühren")?.value || 0.19);

  const allSettings = await db.select().from(planningSettings);
  const sett = allSettings[0];
  const workDays = sett?.workDaysPerMonth || 20;
  const containersPerDay = sett?.containersPerDay || 6;
  const containersPerMonth = workDays * containersPerDay;

  const allVehicles = await db.select().from(vehicles);
  const allEmployees = await db.select().from(employees);
  const allLoans = await db.select().from(loans);

  const today = new Date();
  const hasStarted = (dateStr: string | null | undefined) => {
    if (!dateStr) return true;
    return new Date(dateStr) <= today;
  };
  const activeVehicles = allVehicles.filter(v => v.isActive && hasStarted(v.purchaseDate));
  const activeEmployees = allEmployees.filter(e => e.isActive && hasStarted(e.hireDate));
  const activeLoans = allLoans.filter(l => l.isActive && (!l.endDate || new Date(l.endDate) >= today));

  const monthlyVehicleCosts = activeVehicles.reduce((s, v) => {
    return s + Number(v.monthlyLeaseCost || 0) + Number(v.monthlyInsurance || 0) + Number(v.monthlyMaintenance || 0) + (Number(v.purchaseCost || 0) / ((v.depreciationYears || 10) * 12));
  }, 0);
  const monthlyEmployeeCosts = activeEmployees.reduce((s, e) => s + Number(e.monthlySalary || 0) + Number(e.taxFreeAllowance || 0), 0);
  const monthlyOperatingCosts = allVars.filter(v => v.unit === 'per_month').reduce((s, v) => s + Number(v.value), 0);
  const monthlyLoanCosts = activeLoans.reduce((s, l) => {
    const amount = Number(l.amount || 0);
    const repayment = Number(l.repaymentPercent || 0);
    const interest = Number(l.interestPercent || 0);
    return s + ((amount * repayment / 100) + (amount * interest / 100)) / 12;
  }, 0);
  const totalMonthlyFixed = monthlyVehicleCosts + monthlyEmployeeCosts + monthlyOperatingCosts + monthlyLoanCosts;
  const fixedCostPerContainer = containersPerMonth > 0 ? totalMonthlyFixed / containersPerMonth : 0;

  const distance = Number(distanceKm);
  const size = Number(containerSize);
  const qty = quantity || 1;
  const fuelCostPerKm = (fuelConsumption / 100) * dieselPrice;
  const transportCost = (fuelCostPerKm + tollPerKm) * distance * 2;

  const density = Number(material.density || 1);
  const disposalRate = isLieferung ? Number((material as any).purchaseCostPerTonne || 0) : Number(material.disposalCostPerTonne || 0);
  const containerPickupPrice = 135;

  let weightT: number;
  let volumeM3: number;

  if (inputType === "weight") {
    weightT = Number(inputValue || size * density);
    volumeM3 = weightT / density;
  } else {
    volumeM3 = Number(inputValue || size);
    weightT = volumeM3 * density;
  }

  const disposalCost = weightT * disposalRate;

  let allSalesSurcharges: any[] = [];
  if (sp?.salesSurchargeIds && (sp.salesSurchargeIds as number[]).length > 0) {
    allSalesSurcharges = await db.select().from(salesSurcharges);
    allSalesSurcharges = allSalesSurcharges.filter(s => (sp.salesSurchargeIds as number[]).includes(s.id));
  }

  const surchargePerTonne = allSalesSurcharges
    .filter(s => s.unit === "tonne")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const surchargePerM3 = allSalesSurcharges
    .filter(s => s.unit === "m3")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const pricePerTonne = Number(sp?.pricePerTonne || 0);
  const pricePerCubicMeter = Number(sp?.pricePerCubicMeter || 0);

  const netPriceTonne = (weightT * (pricePerTonne + surchargePerTonne)) + containerPickupPrice;
  const netPriceM3 = (volumeM3 * (pricePerCubicMeter + surchargePerM3)) + containerPickupPrice;

  const bestNet = Math.max(netPriceTonne, netPriceM3) * qty;
  const grossPrice = bestNet * 1.19;

  const variableCost = (transportCost + disposalCost) * qty;
  const fixedCostTotal = fixedCostPerContainer * qty;
  const costBase = variableCost + fixedCostTotal;
  const margin = bestNet - costBase;
  const marginPercent = bestNet > 0 ? (margin / bestNet) * 100 : 0;

  const matchingMPs = await db.select().from(marketPrices)
    .where(and(
      eq(marketPrices.materialCategory, material.name),
      eq(marketPrices.containerSizeM3, size)
    ));

  let marketPriceNet: number | null = null;
  let marketPriceGross: number | null = null;
  const competitors: { source: string; priceNet: number | null; priceGross: number | null }[] = [];

  if (matchingMPs.length > 0) {
    const nets = matchingMPs.map(p => Number(p.priceNet || 0)).filter(n => n > 0);
    const grosses = matchingMPs.map(p => Number(p.priceGross || 0)).filter(n => n > 0);
    marketPriceNet = nets.length > 0 ? Math.round((nets.reduce((a, b) => a + b, 0) / nets.length) * 100) / 100 : null;
    marketPriceGross = grosses.length > 0 ? Math.round((grosses.reduce((a, b) => a + b, 0) / grosses.length) * 100) / 100 : null;

    for (const mp of matchingMPs) {
      competitors.push({
        source: mp.source || "Unbekannt",
        priceNet: mp.priceNet ? Math.round(Number(mp.priceNet) * 100) / 100 : null,
        priceGross: mp.priceGross ? Math.round(Number(mp.priceGross) * 100) / 100 : null,
      });
    }
  }

  const roundedNet = Math.round(bestNet * 100) / 100;
  let marketComparison: string | null = null;
  if (marketPriceNet !== null) {
    const diff = roundedNet - marketPriceNet;
    const pct = Math.round((diff / marketPriceNet) * 100);
    if (pct < -5) {
      marketComparison = `${Math.abs(pct)}% unter Marktpreis – wettbewerbsfähig`;
    } else if (pct <= 5) {
      marketComparison = `Am Marktpreis (±${Math.abs(pct)}%)`;
    } else {
      marketComparison = `${pct}% über Marktpreis`;
    }
  }

  res.json({
    material: material.name,
    articleNumber: (material as any).articleNumber || null,
    avvCode: material.avvNumber,
    containerSize: size,
    distance,
    quantity: qty,
    weightTonnes: Math.round(weightT * 1000) / 1000,
    volumeM3: Math.round(volumeM3 * 1000) / 1000,
    pricePerTonne,
    pricePerCubicMeter,
    surchargePerTonne,
    surchargePerM3,
    containerPickupPrice,
    transportCost: Math.round(transportCost * 100) / 100,
    disposalCost: Math.round(disposalCost * 100) / 100,
    netPrice: roundedNet,
    grossPrice: Math.round(grossPrice * 100) / 100,
    taxRate: 19,
    costBreakdown: {
      baseCost: Math.round(costBase * 100) / 100,
      variableCost: Math.round(variableCost * 100) / 100,
      transportCost: Math.round(transportCost * 100) / 100,
      disposalCost: Math.round(disposalCost * 100) / 100,
      fixedCostShare: Math.round(fixedCostTotal * 100) / 100,
      fixedCostPerContainer: Math.round(fixedCostPerContainer * 100) / 100,
      totalMonthlyFixed: Math.round(totalMonthlyFixed * 100) / 100,
      containersPerMonth,
    },
    margin: Math.round(margin * 100) / 100,
    marginPercent: Math.round(marginPercent * 100) / 100,
    isDangerous: sp?.isDangerous || false,
    marketPriceNet,
    marketPriceGross,
    marketComparison,
    competitors,
  });
});

// ─── KUNDENPREIS (öffentliche Preisabfrage – nur Endpreis) ───────────────────

router.post("/quote", async (req, res) => {
  const { materialId, containerSize, distanceKm, quantity, inputType, inputValue } = req.body;

  if (!materialId || !containerSize || distanceKm == null) {
    return res.status(400).json({ error: "materialId, containerSize und distanceKm sind Pflichtfelder" });
  }

  const [material] = await db.select().from(materials).where(eq(materials.id, materialId));
  if (!material) return res.status(404).json({ error: "Material nicht gefunden" });

  const allSalesPrices = await db.select().from(salesPrices).where(eq(salesPrices.isActive, true));
  const normalizeAvv = (code: string | null) => (code || "").replace(/[\s\-\.]/g, "").replace(/\*$/, "").toLowerCase();
  const matAvv = normalizeAvv(material.avvNumber);
  const isLieferung = (material as any).materialType === 'lieferung';

  let sp;
  if (isLieferung) {
    sp = allSalesPrices.find(s => s.priceType === 'lieferung' && s.materialName.toLowerCase().includes(material.name.toLowerCase()))
      || allSalesPrices.find(s => s.priceType === 'lieferung' && material.name.toLowerCase().includes(s.materialName.split(' ')[0].toLowerCase()));
  } else {
    sp = allSalesPrices.find(s => normalizeAvv(s.avvCode) === matAvv)
      || allSalesPrices.find(s => normalizeAvv(s.avvCode).startsWith(matAvv) || matAvv.startsWith(normalizeAvv(s.avvCode)));
  }

  const containerPickupPrice = 135;
  const density = Number(material.density || 1);
  const size = Number(containerSize);
  const qty = quantity || 1;

  let weightT: number;
  let volumeM3: number;
  if (inputType === "weight") {
    weightT = Number(inputValue || size * density);
    volumeM3 = weightT / density;
  } else {
    volumeM3 = Number(inputValue || size);
    weightT = volumeM3 * density;
  }

  let allSalesSurchgs: any[] = [];
  if (sp?.salesSurchargeIds && (sp.salesSurchargeIds as number[]).length > 0) {
    allSalesSurchgs = await db.select().from(salesSurcharges);
    allSalesSurchgs = allSalesSurchgs.filter(s => (sp.salesSurchargeIds as number[]).includes(s.id));
  }

  const surchargePerTonne = allSalesSurchgs.filter(s => s.unit === "tonne").reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const surchargePerM3 = allSalesSurchgs.filter(s => s.unit === "m3").reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const pricePerTonne = Number(sp?.pricePerTonne || 0);
  const pricePerCubicMeter = Number(sp?.pricePerCubicMeter || 0);

  const netPriceTonne = (weightT * (pricePerTonne + surchargePerTonne)) + containerPickupPrice;
  const netPriceM3 = (volumeM3 * (pricePerCubicMeter + surchargePerM3)) + containerPickupPrice;

  const netPrice = Math.round(Math.max(netPriceTonne, netPriceM3) * qty * 100) / 100;
  const taxAmount = Math.round(netPrice * 0.19 * 100) / 100;
  const grossPrice = Math.round((netPrice + taxAmount) * 100) / 100;

  res.json({
    material: material.name,
    containerSize: size,
    quantity: qty,
    netPrice,
    taxRate: 19,
    taxAmount,
    grossPrice,
  });
});

// ─── MATERIALIEN & PREISLISTE (read-only) ───────────────────────────────────

router.get("/materials", async (_req, res) => {
  const mats = await db.select().from(materials).where(eq(materials.isActive, true));
  res.json(mats);
});

router.get("/price-list", async (_req, res) => {
  const prices = await db.select().from(salesPrices).where(eq(salesPrices.isActive, true));
  const mats = await db.select().from(materials).where(eq(materials.isActive, true));

  const result = prices.map(sp => {
    let mat;
    if (sp.priceType === 'lieferung') {
      mat = mats.find(m => (m as any).materialType === 'lieferung' && sp.materialName.toLowerCase().includes(m.name.toLowerCase()));
    } else {
      mat = mats.find(m => m.avvNumber === sp.avvCode);
    }
    return {
      materialName: sp.materialName,
      articleNumber: (mat as any)?.articleNumber || null,
      avvCode: sp.avvCode,
      materialId: mat?.id || null,
      pricePerTonne: Number(sp.pricePerTonne || 0),
      pricePerCubicMeter: Number(sp.pricePerCubicMeter || 0),
      isDangerous: sp.isDangerous || false,
      priceType: sp.priceType || 'entsorgung',
      validFrom: sp.validFrom,
    };
  });

  res.json(result);
});

// ─── MARKTPREISE (Vergleichspreise abrufen) ─────────────────────────────────

router.get("/market-prices", requirePerm("read") as any, async (req: PartnerRequest, res: Response) => {
  const { materialId, containerSize } = req.query;

  let prices = await db.select().from(marketPrices);

  if (materialId) {
    const [mat] = await db.select().from(materials).where(eq(materials.id, Number(materialId)));
    if (mat) {
      prices = prices.filter(p => p.materialCategory === mat.name);
    }
  }

  if (containerSize) {
    prices = prices.filter(p => p.containerSizeM3 === Number(containerSize));
  }

  const result = prices.map(p => ({
    id: p.id,
    provider: p.provider,
    providerUrl: p.providerUrl,
    material: p.materialCategory,
    containerSizeM3: p.containerSizeM3,
    priceNet: Number(p.priceNet || 0),
    priceGross: Number(p.priceGross || 0),
    includesTransport: p.includesTransport,
    includesDisposal: p.includesDisposal,
    notes: p.notes,
    sourceDate: p.sourceDate,
  }));

  res.json(result);
});

export default router;
