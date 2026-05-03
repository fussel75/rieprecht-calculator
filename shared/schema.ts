import { pgTable, text, serial, integer, numeric, boolean, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Benutzer (Login-System)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("mitarbeiter"), // 'admin', 'manager', 'mitarbeiter'
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Fahrzeuge (LKWs, Anhänger)
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'lkw', 'anhaenger'
  licensePlate: text("license_plate"),
  purchaseDate: text("purchase_date"), // Kaufdatum als Text (YYYY-MM-DD)
  purchaseCost: numeric("purchase_cost").default("0"), // Kaufpreis
  depreciationYears: integer("depreciation_years").default(10), // Abschreibungsdauer in Jahren
  monthlyLeaseCost: numeric("monthly_lease_cost").default("0"),
  monthlyInsurance: numeric("monthly_insurance").default("0"),
  monthlyMaintenance: numeric("monthly_maintenance").default("0"),
  fuelConsumption: numeric("fuel_consumption").default("30"),
  isActive: boolean("is_active").default(true),
});

// Personal/Mitarbeiter
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'geschaeftsfuehrer', 'fahrer', 'buero'
  hireDate: text("hire_date"), // Einstellungsdatum als Text (YYYY-MM-DD)
  monthlySalary: numeric("monthly_salary").notNull(),
  taxFreeAllowance: numeric("tax_free_allowance").default("0"), // Steuerfreie Zulagen
  workHoursPerWeek: numeric("work_hours_per_week").default("40"),
  isActive: boolean("is_active").default(true),
});

// Container (Abrollcontainer, Absetzcontainer)
export const containers = pgTable("containers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // z.B. "7m³ Absetzcontainer #1"
  type: text("type").notNull(), // 'absetz', 'abroll'
  sizeM3: integer("size_m3").notNull(), // 7, 10, etc.
  quantity: integer("quantity").default(1), // Stückzahl beim Kauf
  purchaseDate: text("purchase_date"), // Kaufdatum
  purchaseCost: numeric("purchase_cost").default("0"), // Anschaffungskosten pro Stück
  depreciationYears: integer("depreciation_years").default(10), // Abschreibungsdauer in Jahren
  isActive: boolean("is_active").default(true),
});

// Material Typen (für Umrechnung und Entsorgungskosten)
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  articleNumber: text("article_number"), // Eigene Artikelnummer (z.B. "P-001")
  avvNumber: text("avv_number"), // AVV-Katalog Artikelnummer (z.B. "17 01 01")
  density: numeric("density").notNull(),
  disposalCostPerTonne: numeric("disposal_cost_per_tonne").notNull(),
  surchargeAmount: numeric("surcharge_amount").default("0"), // Zulagen in € (legacy)
  surchargeUnit: text("surcharge_unit").default("tonne"), // 'tonne' oder 'm3' (legacy)
  purchaseSurchargeIds: integer("purchase_surcharge_ids").array(),
  materialType: text("material_type").default("entsorgung"), // 'entsorgung' oder 'lieferung'
  purchaseCostPerTonne: numeric("purchase_cost_per_tonne").default("0"), // Einkaufspreis für Schüttgüter
  grainSize: text("grain_size"), // Körnung z.B. "0-2 mm", "8-32 mm"
  isActive: boolean("is_active").default(true),
});

// Einkaufs-Pauschalen (Zuschläge die auf den Entsorgungspreis aufgeschlagen werden)
export const purchaseSurcharges = pgTable("purchase_surcharges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: numeric("amount").notNull(),
  unit: text("unit").notNull().default("tonne"),
  appliesToDangerous: boolean("applies_to_dangerous").default(false),
  isActive: boolean("is_active").default(true),
});

export const insertPurchaseSurchargeSchema = createInsertSchema(purchaseSurcharges).omit({ id: true });
export type PurchaseSurcharge = typeof purchaseSurcharges.$inferSelect;
export type InsertPurchaseSurcharge = z.infer<typeof insertPurchaseSurchargeSchema>;

// Betriebliche Kostenvariablen
export const costVariables = pgTable("cost_variables", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  value: numeric("value").notNull(),
  unit: text("unit").notNull(),
  description: text("description"),
});

// Darlehen (Finanzierungskosten)
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // z.B. "Fahrzeugfinanzierung"
  amount: numeric("amount").notNull(), // Ursprungsbetrag (Darlehensbetrag)
  startDate: text("start_date"), // Anfangsdatum der Zinsberechnung (YYYY-MM-DD)
  endDate: text("end_date"), // Enddatum des Darlehens (YYYY-MM-DD)
  interestPercent: numeric("interest_percent").notNull(), // Zinsen in % p.a.
  repaymentPercent: numeric("repayment_percent").default("0"), // Geplante Tilgung in % (optional, zur Info)
  isActive: boolean("is_active").default(true),
});

// Darlehen-Zahlungen (Tilgungen und Zinszahlungen)
export const loanPayments = pgTable("loan_payments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").references(() => loans.id).notNull(),
  paymentDate: text("payment_date").notNull(), // Datum der Zahlung (YYYY-MM-DD)
  paymentType: text("payment_type").notNull(), // 'tilgung' oder 'zinsen'
  amount: numeric("amount").notNull(), // Betrag in €
  year: integer("year"), // Jahr (für Zinszahlungen)
  isPaid: boolean("is_paid").default(false), // Wurde die Zahlung durchgeführt?
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Planungs-/Prognose-Einstellungen
export const planningSettings = pgTable("planning_settings", {
  id: serial("id").primaryKey(),
  containersPerDay: integer("containers_per_day").default(5),
  workDaysPerMonth: integer("work_days_per_month").default(20),
  targetMarginPercent: numeric("target_margin_percent").default("15"),
  activeTrucks: integer("active_trucks").default(1),
  plannedTrucksDate: timestamp("planned_trucks_date"),
  monthlyRent: numeric("monthly_rent").default("0"), // Miete (Betriebsplatz, Büro, etc.)
});

// Artikelstamm (aus Auftragssoftware)
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  articleNumber: text("article_number").notNull().unique(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("t"),
  category: text("category").notNull().default("entsorgung"),
  avvNumber: text("avv_number"),
  isActive: boolean("is_active").default(true),
});

export const insertArticleSchema = createInsertSchema(articles).omit({ id: true });
export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;

// Fahrten-Protokoll (tatsächlich gefahrene Container)
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  tripDate: text("trip_date").notNull(),
  materialId: integer("material_id").references(() => materials.id),
  containerSize: integer("container_size").notNull(),
  distanceKm: numeric("distance_km").notNull(),
  actualPrice: numeric("actual_price").notNull(),
  notes: text("notes"),
  vehicleId: integer("vehicle_id"),
  vehiclePlate: text("vehicle_plate"),
  customerId: integer("customer_id"),
  customerNumber: text("customer_number"),
  customerName: text("customer_name"),
  constructionSite: text("construction_site"),
  orderType: text("order_type"),
  aTyp: text("a_typ"),
  aArt: text("a_art"),
  articleId: integer("article_id"),
  articleNumber: text("article_number"),
  articleName: text("article_name"),
  avvNumber: text("avv_number"),
  quantity: numeric("quantity"),
  unit: text("unit"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Kunden (Kundendatenbank)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  customerNumber: text("customer_number"), // Kundennummer (optional)
  customerType: text("customer_type").notNull().default("privat"), // 'gewerblich' oder 'privat'
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  companyName: text("company_name"), // Optional, meist für gewerbliche Kunden
  street: text("street").notNull(), // Straße + Hausnummer
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  phone: text("phone"),
  mobile: text("mobile"),
  email1: text("email1"),
  email2: text("email2"),
  skontoPercent: integer("skonto_percent").default(0), // 0, 1, oder 2
  discountPercent: integer("discount_percent").default(0), // 0, 3, 5, oder 7
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marktpreise von Wettbewerbern
export const marketPrices = pgTable("market_prices", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // z.B. "Buhck Hamburg", "Heinz Husen"
  providerUrl: text("provider_url"), // Link zur Preisliste/Website
  materialCategory: text("material_category").notNull(), // z.B. "Bauschutt", "Baumischabfall"
  containerSizeM3: integer("container_size_m3").notNull(), // 3, 5, 7, 10, etc.
  priceGross: numeric("price_gross").notNull(), // Bruttopreis in €
  priceNet: numeric("price_net"), // Nettopreis in €
  includesTransport: boolean("includes_transport").default(true),
  includesDisposal: boolean("includes_disposal").default(true),
  notes: text("notes"), // Zusätzliche Infos
  sourceDate: text("source_date"), // Datum der Preisliste
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Verkaufspreise (eigene Preisliste)
export const salesPrices = pgTable("sales_prices", {
  id: serial("id").primaryKey(),
  avvCode: text("avv_code").notNull(), // AVV-Nummer z.B. "170201", "170204*"
  materialName: text("material_name").notNull(), // Bezeichnung z.B. "Bau und Abbruchholz (A1-A3)"
  pricePerTonne: numeric("price_per_tonne"), // Preis pro Tonne in € netto
  pricePerCubicMeter: numeric("price_per_cubic_meter"), // Preis pro m³ in € netto
  behgSurcharge: numeric("behg_surcharge").default("0"), // BEHG Zuschlag in € (legacy)
  salesSurchargeIds: integer("sales_surcharge_ids").array(),
  isDangerous: boolean("is_dangerous").default(false), // Gefährlicher Abfall (*)
  validFrom: text("valid_from"), // Gültig ab (YYYY-MM-DD)
  notes: text("notes"),
  priceType: text("price_type").default("entsorgung"), // 'entsorgung' oder 'lieferung'
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Verkaufs-Zuschläge (Zuschläge auf den Verkaufspreis)
export const salesSurcharges = pgTable("sales_surcharges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: numeric("amount").notNull(),
  unit: text("unit").notNull().default("tonne"),
  appliesToDangerous: boolean("applies_to_dangerous").default(false),
  isActive: boolean("is_active").default(true),
});

export const insertSalesSurchargeSchema = createInsertSchema(salesSurcharges).omit({ id: true });
export type SalesSurcharge = typeof salesSurcharges.$inferSelect;
export type InsertSalesSurcharge = z.infer<typeof insertSalesSurchargeSchema>;

// Fixpreise (Container-Pauschalen)
export const salesFixedPrices = pgTable("sales_fixed_prices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // z.B. "Container Abholung/Tausch", "EANV-Gebühr"
  price: numeric("price").notNull(), // Preis in € netto
  unit: text("unit").notNull(), // z.B. "Stück", "pro Container"
  appliesToDangerous: boolean("applies_to_dangerous").default(false), // Nur für gefährliche Abfälle
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Historie der Angebote/Berechnungen
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name"),
  materialId: integer("material_id").references(() => materials.id),
  containerSize: integer("container_size").notNull(),
  distanceKm: numeric("distance_km").notNull(),
  estimatedWeightT: numeric("estimated_weight_t").notNull(),
  calculatedCost: numeric("calculated_cost").notNull(),
  finalPrice: numeric("final_price").notNull(),
  margin: numeric("margin").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod Schemas
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertContainerSchema = createInsertSchema(containers).omit({ id: true });
export const insertMaterialSchema = createInsertSchema(materials).omit({ id: true });
export const insertCostVariableSchema = createInsertSchema(costVariables).omit({ id: true });
export const insertLoanSchema = createInsertSchema(loans).omit({ id: true });
export const insertLoanPaymentSchema = createInsertSchema(loanPayments).omit({ id: true, createdAt: true });
export const insertPlanningSettingsSchema = createInsertSchema(planningSettings).omit({ id: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export const insertTripSchema = createInsertSchema(trips).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Container = typeof containers.$inferSelect;
export type InsertContainer = z.infer<typeof insertContainerSchema>;

export type Material = typeof materials.$inferSelect;
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;

export type CostVariable = typeof costVariables.$inferSelect;
export type InsertCostVariable = z.infer<typeof insertCostVariableSchema>;

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;

export type LoanPayment = typeof loanPayments.$inferSelect;
export type InsertLoanPayment = z.infer<typeof insertLoanPaymentSchema>;

export type PlanningSettings = typeof planningSettings.$inferSelect;
export type InsertPlanningSettings = z.infer<typeof insertPlanningSettingsSchema>;

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, resetToken: true, resetTokenExpiry: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertMarketPriceSchema = createInsertSchema(marketPrices).omit({ id: true, updatedAt: true });
export type MarketPrice = typeof marketPrices.$inferSelect;
export type InsertMarketPrice = z.infer<typeof insertMarketPriceSchema>;

export const insertSalesPriceSchema = createInsertSchema(salesPrices).omit({ id: true, updatedAt: true });
export type SalesPrice = typeof salesPrices.$inferSelect;
export type InsertSalesPrice = z.infer<typeof insertSalesPriceSchema>;

export const insertSalesFixedPriceSchema = createInsertSchema(salesFixedPrices).omit({ id: true, updatedAt: true });
export type SalesFixedPrice = typeof salesFixedPrices.$inferSelect;
export type InsertSalesFixedPrice = z.infer<typeof insertSalesFixedPriceSchema>;

// Angebotsnummern-Zähler (pro Jahr)
export const offerCounters = pgTable("offer_counters", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull().unique(), // z.B. 2026
  counter: integer("counter").notNull().default(0), // aktueller Zählerstand
});

export const insertOfferCounterSchema = createInsertSchema(offerCounters).omit({ id: true });
export type OfferCounter = typeof offerCounters.$inferSelect;
export type InsertOfferCounter = z.infer<typeof insertOfferCounterSchema>;

export const forecastParamsSchema = z.object({
  growthFactors: z.array(z.number()).length(12),
  subiShare: z.array(z.number()).length(12),
  seasonalFactors: z.array(z.number()).length(12),
  maxContainersPerDayPerDriver: z.number().min(1).max(15),
  initialContainerStock: z.number().min(10).max(500),
  containerPricePerUnit: z.number().min(500).max(10000),
  containerTurnaroundDays: z.number().min(1).max(30),
  containerUtilizationThreshold: z.number().min(0.5).max(1.0),
  containers7Count: z.number().min(0).max(500).optional(),
  containers10Count: z.number().min(0).max(500).optional(),
  containers7Price: z.number().min(0).optional(),
  containers10Price: z.number().min(0).optional(),
  vacationDaysPerDriver: z.number().min(0).max(60),
  sickDaysPerDriver: z.number().min(0).max(60),
  distance: z.number().min(1).max(200),
  year: z.number().min(2024).max(2035),
  subiRevenuePerTrip: z.number().min(0).max(500),
  driver2MonthlySalary: z.number().min(0),
  driver2MonthlySpesen: z.number().min(0),
  driver2Name: z.string().optional(),
  newVehicleMonthlyLease: z.number().min(0),
  newVehicleMonthlyInsurance: z.number().min(0),
  newVehicleMonthlyMaintenance: z.number().min(0),
  newVehicleMonthlyDepreciation: z.number().min(0).optional(),
  newVehicleName: z.string().optional(),
  expansionStartMonth: z.number().min(0).max(11),
  expansionStartYear: z.number().min(2024).max(2035).optional(),
  startMonth: z.number().min(0).max(11).optional(),
  endMonth: z.number().min(0).max(11).optional(),
});

export type ForecastParams = z.infer<typeof forecastParamsSchema>;

export const forecastScenarios = pgTable("forecast_scenarios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  params: jsonb("params").notNull(),
  isDefault: boolean("is_default").default(false),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertForecastScenarioSchema = createInsertSchema(forecastScenarios).omit({ id: true, createdAt: true, updatedAt: true });
export type ForecastScenario = typeof forecastScenarios.$inferSelect;
export type InsertForecastScenario = z.infer<typeof insertForecastScenarioSchema>;

export const savedPlans = pgTable("saved_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  scenario: text("scenario").notNull(),
  year: integer("year").notNull(),
  monthlyData: jsonb("monthly_data").notNull(),
  params: jsonb("params"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export type SavedPlan = typeof savedPlans.$inferSelect;

export const bwaReports = pgTable("bwa_reports", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  revenue: text("revenue"),
  materialCosts: text("material_costs"),
  personnelCosts: text("personnel_costs"),
  vehicleCosts: text("vehicle_costs"),
  operatingCosts: text("operating_costs"),
  depreciation: text("depreciation"),
  interestCosts: text("interest_costs"),
  otherCosts: text("other_costs"),
  totalCosts: text("total_costs"),
  operatingResult: text("operating_result"),
  cumulativeResult: text("cumulative_result"),
  rawData: jsonb("raw_data"),
  sourceFileName: text("source_file_name"),
  importedAt: timestamp("imported_at").defaultNow(),
  importedBy: integer("imported_by"),
});

export const insertBwaReportSchema = createInsertSchema(bwaReports).omit({ id: true, importedAt: true });
export type BwaReport = typeof bwaReports.$inferSelect;
export type InsertBwaReport = z.infer<typeof insertBwaReportSchema>;

export const partnerApiKeys = pgTable("partner_api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  apiKey: text("api_key").notNull().unique(),
  permissions: text("permissions").array().notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

export const insertPartnerApiKeySchema = createInsertSchema(partnerApiKeys).omit({ id: true, createdAt: true, lastUsedAt: true });
export type PartnerApiKey = typeof partnerApiKeys.$inferSelect;
export type InsertPartnerApiKey = z.infer<typeof insertPartnerApiKeySchema>;

export const partnerProducts = pgTable("partner_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  materialId: integer("material_id"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPartnerProductSchema = createInsertSchema(partnerProducts).omit({ id: true, createdAt: true, updatedAt: true });
export type PartnerProduct = typeof partnerProducts.$inferSelect;
export type InsertPartnerProduct = z.infer<typeof insertPartnerProductSchema>;

export const partnerVariants = pgTable("partner_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  label: text("label").notNull(),
  volume: numeric("volume"),
  weight: numeric("weight"),
  unit: text("unit").default("m3"),
  priceNet: numeric("price_net").notNull(),
  priceGross: numeric("price_gross").notNull(),
  taxRate: integer("tax_rate").default(19),
  containerSize: text("container_size"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPartnerVariantSchema = createInsertSchema(partnerVariants).omit({ id: true, createdAt: true });
export type PartnerVariant = typeof partnerVariants.$inferSelect;
export type InsertPartnerVariant = z.infer<typeof insertPartnerVariantSchema>;

export const partnerOrders = pgTable("partner_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  variantId: integer("variant_id").notNull(),
  productName: text("product_name"),
  variantLabel: text("variant_label"),
  quantity: integer("quantity").default(1),
  priceNet: numeric("price_net"),
  priceGross: numeric("price_gross"),
  taxRate: integer("tax_rate").default(19),
  status: text("status").notNull().default("PENDING"),
  deliveryDate: text("delivery_date"),
  deliveryStreet: text("delivery_street"),
  deliveryHouseNr: text("delivery_house_nr"),
  deliveryZip: text("delivery_zip"),
  deliveryCity: text("delivery_city"),
  deliveryNotes: text("delivery_notes"),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  customerId: integer("customer_id"),
  paymentMethod: text("payment_method").default("RECHNUNG"),
  paymentStatus: text("payment_status").default("PENDING"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPartnerOrderSchema = createInsertSchema(partnerOrders).omit({ id: true, orderNumber: true, createdAt: true, updatedAt: true });
export type PartnerOrder = typeof partnerOrders.$inferSelect;
export type InsertPartnerOrder = z.infer<typeof insertPartnerOrderSchema>;

export const partnerCalendar = pgTable("partner_calendar", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  type: text("type").notNull().default("DELIVERY"),
  orderId: integer("order_id"),
  title: text("title"),
  description: text("description"),
  timeSlot: text("time_slot"),
  maxCapacity: integer("max_capacity"),
  currentBookings: integer("current_bookings").default(0),
  isBlocked: boolean("is_blocked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPartnerCalendarSchema = createInsertSchema(partnerCalendar).omit({ id: true, createdAt: true });
export type PartnerCalendar = typeof partnerCalendar.$inferSelect;
export type InsertPartnerCalendar = z.infer<typeof insertPartnerCalendarSchema>;

export const partnerGeoZones = pgTable("partner_geo_zones", {
  id: serial("id").primaryKey(),
  zipFrom: text("zip_from").notNull(),
  zipTo: text("zip_to").notNull(),
  zoneName: text("zone_name"),
  deliverySurcharge: numeric("delivery_surcharge").default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPartnerGeoZoneSchema = createInsertSchema(partnerGeoZones).omit({ id: true, createdAt: true });
export type PartnerGeoZone = typeof partnerGeoZones.$inferSelect;
export type InsertPartnerGeoZone = z.infer<typeof insertPartnerGeoZoneSchema>;

export const partnerPlzExceptions = pgTable("partner_plz_exceptions", {
  id: serial("id").primaryKey(),
  zip: text("zip").notNull(),
  rule: text("rule").notNull(),
  surcharge: numeric("surcharge").default("0"),
  minOrderValue: numeric("min_order_value"),
  note: text("note"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPartnerPlzExceptionSchema = createInsertSchema(partnerPlzExceptions).omit({ id: true, createdAt: true });
export type PartnerPlzException = typeof partnerPlzExceptions.$inferSelect;
export type InsertPartnerPlzException = z.infer<typeof insertPartnerPlzExceptionSchema>;

export const partnerSettings = pgTable("partner_settings", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").default("Rieprecht GmbH"),
  shopEmail: text("shop_email"),
  shopPhone: text("shop_phone"),
  shopAddress: text("shop_address"),
  currency: text("currency").default("EUR"),
  taxRate: integer("tax_rate").default(19),
  minOrderValue: numeric("min_order_value").default("0"),
  maxDeliveryRadiusKm: integer("max_delivery_radius_km").default(50),
  orderConfirmationEmail: boolean("order_confirmation_email").default(true),
  defaultPaymentMethod: text("default_payment_method").default("RECHNUNG"),
  maintenanceMode: boolean("maintenance_mode").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});
