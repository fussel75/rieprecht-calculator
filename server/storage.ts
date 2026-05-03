import { db } from "./db";
import {
  materials, costVariables, planningSettings, quotes, vehicles, employees, containers, trips, users, loans, loanPayments, customers, marketPrices, salesPrices, salesFixedPrices, offerCounters, forecastScenarios, bwaReports, articles, purchaseSurcharges, salesSurcharges,
  tasks, taskAssignees, taskComments, taskAttachments, taskReminderLog, notes, noteAttachments, userNotificationSettings,
  type Material, type InsertMaterial,
  type PurchaseSurcharge, type InsertPurchaseSurcharge,
  type SalesSurcharge, type InsertSalesSurcharge,
  type CostVariable, type InsertCostVariable,
  type PlanningSettings, type InsertPlanningSettings,
  type Quote, type InsertQuote,
  type Vehicle, type InsertVehicle,
  type Employee, type InsertEmployee,
  type Container, type InsertContainer,
  type Trip, type InsertTrip,
  type User, type InsertUser,
  type Loan, type InsertLoan,
  type LoanPayment, type InsertLoanPayment,
  type Customer, type InsertCustomer,
  type MarketPrice, type InsertMarketPrice,
  type SalesPrice, type InsertSalesPrice,
  type SalesFixedPrice, type InsertSalesFixedPrice,
  type ForecastScenario, type InsertForecastScenario,
  type BwaReport, type InsertBwaReport,
  type Article, type InsertArticle,
  type Task, type InsertTask,
  type TaskComment, type InsertTaskComment,
  type TaskAssignee, type TaskAttachment,
  type Note, type InsertNote,
  type NoteAttachment,
  type UserNotificationSettings, type InsertUserNotificationSettings,
} from "@shared/schema";
import { eq, desc, asc, and, or, ilike, sql, gte, lte, inArray, isNull, isNotNull } from "drizzle-orm";

export type TaskWithRelations = Task & {
  assigneeIds: number[];
  attachments: Array<Pick<TaskAttachment, "id" | "filename" | "mimeType" | "size" | "uploadedById" | "uploadedAt">>;
  commentCount: number;
};

export type NoteWithAttachments = Note & {
  attachments: Array<Pick<NoteAttachment, "id" | "filename" | "mimeType" | "size" | "uploadedById" | "uploadedAt">>;
};

export interface IStorage {
  // Vehicles
  getVehicles(): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle>;
  deleteVehicle(id: number): Promise<void>;

  // Employees
  getEmployees(): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;

  // Containers
  getContainers(): Promise<Container[]>;
  createContainer(container: InsertContainer): Promise<Container>;
  updateContainer(id: number, container: Partial<InsertContainer>): Promise<Container>;
  deleteContainer(id: number): Promise<void>;

  // Materials
  getMaterials(): Promise<Material[]>;
  getMaterial(id: number): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: number, material: Partial<InsertMaterial>): Promise<Material>;
  deleteMaterial(id: number): Promise<void>;

  // Cost Variables
  getCostVariables(): Promise<CostVariable[]>;
  createCostVariable(variable: InsertCostVariable): Promise<CostVariable>;
  updateCostVariable(id: number, variable: Partial<InsertCostVariable>): Promise<CostVariable>;
  deleteCostVariable(id: number): Promise<void>;

  // Settings
  getPlanningSettings(): Promise<PlanningSettings | undefined>;
  updatePlanningSettings(settings: Partial<InsertPlanningSettings>): Promise<PlanningSettings>;

  // Quotes
  getQuotes(): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;

  // Articles
  getArticles(): Promise<Article[]>;
  createArticle(article: InsertArticle): Promise<Article>;
  updateArticle(id: number, article: Partial<InsertArticle>): Promise<Article>;
  deleteArticle(id: number): Promise<void>;

  // Trips
  getTrips(): Promise<Trip[]>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: number, trip: Partial<InsertTrip>): Promise<Trip>;
  deleteTrip(id: number): Promise<void>;

  // Loans
  getLoans(): Promise<Loan[]>;
  createLoan(loan: InsertLoan): Promise<Loan>;
  updateLoan(id: number, loan: Partial<InsertLoan>): Promise<Loan>;
  deleteLoan(id: number): Promise<void>;

  // Loan Payments
  getLoanPayments(loanId: number): Promise<LoanPayment[]>;
  getAllLoanPayments(): Promise<LoanPayment[]>;
  createLoanPayment(payment: InsertLoanPayment): Promise<LoanPayment>;
  updateLoanPayment(id: number, payment: Partial<InsertLoanPayment>): Promise<LoanPayment>;
  deleteLoanPayment(id: number): Promise<void>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: number): Promise<void>;

  // Users
  getUsersCount(): Promise<number>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserResetToken(id: number, token: string | null, expiry: Date | null): Promise<void>;
  updateUserPassword(id: number, password: string): Promise<void>;
  updateUser(id: number, updates: { username?: string; name?: string; role?: string; password?: string }): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  updateUserVerificationToken(id: number, token: string | null, expiry: Date | null): Promise<void>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  verifyUserEmail(id: number): Promise<void>;

  // Market Prices
  getMarketPrices(): Promise<MarketPrice[]>;
  getMarketPricesForMaterial(materialCategory: string, containerSize: number): Promise<MarketPrice[]>;
  createMarketPrice(price: InsertMarketPrice): Promise<MarketPrice>;
  deleteAllMarketPrices(): Promise<void>;

  // Sales Prices (eigene Verkaufspreise)
  getSalesPrices(): Promise<SalesPrice[]>;
  getSalesPriceByAvv(avvCode: string): Promise<SalesPrice | undefined>;
  createSalesPrice(price: InsertSalesPrice): Promise<SalesPrice>;
  updateSalesPrice(id: number, price: Partial<InsertSalesPrice>): Promise<SalesPrice>;
  deleteSalesPrice(id: number): Promise<void>;

  // Sales Fixed Prices (Pauschalen)
  getSalesFixedPrices(): Promise<SalesFixedPrice[]>;
  createSalesFixedPrice(price: InsertSalesFixedPrice): Promise<SalesFixedPrice>;
  updateSalesFixedPrice(id: number, price: Partial<InsertSalesFixedPrice>): Promise<SalesFixedPrice>;
  deleteSalesFixedPrice(id: number): Promise<void>;

  // Offer Counter (Angebotsnummern)
  getNextOfferNumber(): Promise<string>;

  // Forecast Scenarios
  getForecastScenarios(): Promise<ForecastScenario[]>;
  getForecastScenario(id: number): Promise<ForecastScenario | undefined>;
  createForecastScenario(scenario: InsertForecastScenario): Promise<ForecastScenario>;
  updateForecastScenario(id: number, scenario: Partial<InsertForecastScenario>): Promise<ForecastScenario>;
  deleteForecastScenario(id: number): Promise<void>;

  // BWA Reports
  getBwaReports(year?: number): Promise<BwaReport[]>;
  getBwaReport(id: number): Promise<BwaReport | undefined>;
  createBwaReport(report: InsertBwaReport): Promise<BwaReport>;
  updateBwaReport(id: number, report: Partial<InsertBwaReport>): Promise<BwaReport>;
  deleteBwaReport(id: number): Promise<void>;
  upsertBwaReport(report: InsertBwaReport): Promise<BwaReport>;
}

export class DatabaseStorage implements IStorage {
  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(vehicles.name);
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(insertVehicle).returning();
    return vehicle;
  }

  async updateVehicle(id: number, updates: Partial<InsertVehicle>): Promise<Vehicle> {
    const [updated] = await db.update(vehicles).set(updates).where(eq(vehicles.id, id)).returning();
    return updated;
  }

  async deleteVehicle(id: number): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  // Employees
  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees).orderBy(employees.name);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(insertEmployee).returning();
    return employee;
  }

  async updateEmployee(id: number, updates: Partial<InsertEmployee>): Promise<Employee> {
    const [updated] = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();
    return updated;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Containers
  async getContainers(): Promise<Container[]> {
    return await db.select().from(containers).orderBy(containers.name);
  }

  async createContainer(insertContainer: InsertContainer): Promise<Container> {
    const [container] = await db.insert(containers).values(insertContainer).returning();
    return container;
  }

  async updateContainer(id: number, updates: Partial<InsertContainer>): Promise<Container> {
    const [updated] = await db.update(containers).set(updates).where(eq(containers.id, id)).returning();
    return updated;
  }

  async deleteContainer(id: number): Promise<void> {
    await db.delete(containers).where(eq(containers.id, id));
  }

  // Materials
  async getMaterials(): Promise<Material[]> {
    return await db.select().from(materials).orderBy(materials.name);
  }

  async getMaterial(id: number): Promise<Material | undefined> {
    const [material] = await db.select().from(materials).where(eq(materials.id, id));
    return material;
  }

  async createMaterial(insertMaterial: InsertMaterial): Promise<Material> {
    const [material] = await db.insert(materials).values(insertMaterial).returning();
    return material;
  }

  async updateMaterial(id: number, updates: Partial<InsertMaterial>): Promise<Material> {
    const [updated] = await db.update(materials).set(updates).where(eq(materials.id, id)).returning();
    return updated;
  }

  async deleteMaterial(id: number): Promise<void> {
    await db.delete(materials).where(eq(materials.id, id));
  }

  // Purchase Surcharges (Einkaufs-Pauschalen)
  async getPurchaseSurcharges(): Promise<PurchaseSurcharge[]> {
    return await db.select().from(purchaseSurcharges).orderBy(purchaseSurcharges.name);
  }

  async createPurchaseSurcharge(data: InsertPurchaseSurcharge): Promise<PurchaseSurcharge> {
    const [surcharge] = await db.insert(purchaseSurcharges).values(data).returning();
    return surcharge;
  }

  async updatePurchaseSurcharge(id: number, data: Partial<InsertPurchaseSurcharge>): Promise<PurchaseSurcharge> {
    const [surcharge] = await db.update(purchaseSurcharges).set(data).where(eq(purchaseSurcharges.id, id)).returning();
    return surcharge;
  }

  async deletePurchaseSurcharge(id: number): Promise<void> {
    await db.delete(purchaseSurcharges).where(eq(purchaseSurcharges.id, id));
  }

  // Cost Variables
  async getCostVariables(): Promise<CostVariable[]> {
    return await db.select().from(costVariables).orderBy(costVariables.category);
  }

  async createCostVariable(insertVariable: InsertCostVariable): Promise<CostVariable> {
    const [variable] = await db.insert(costVariables).values(insertVariable).returning();
    return variable;
  }

  async updateCostVariable(id: number, updates: Partial<InsertCostVariable>): Promise<CostVariable> {
    const [updated] = await db.update(costVariables).set(updates).where(eq(costVariables.id, id)).returning();
    return updated;
  }

  async deleteCostVariable(id: number): Promise<void> {
    await db.delete(costVariables).where(eq(costVariables.id, id));
  }

  // Settings
  async getPlanningSettings(): Promise<PlanningSettings | undefined> {
    const [settings] = await db.select().from(planningSettings).limit(1);
    return settings;
  }

  async updatePlanningSettings(updates: Partial<InsertPlanningSettings>): Promise<PlanningSettings> {
    const existing = await this.getPlanningSettings();
    
    if (!existing) {
      const [newSettings] = await db.insert(planningSettings)
        .values({ ...updates } as InsertPlanningSettings)
        .returning();
      return newSettings;
    }

    const [updated] = await db.update(planningSettings)
      .set(updates)
      .where(eq(planningSettings.id, existing.id))
      .returning();
    return updated;
  }

  // Quotes
  async getQuotes(): Promise<Quote[]> {
    return await db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const [quote] = await db.insert(quotes).values(insertQuote).returning();
    return quote;
  }

  // Articles
  async getArticles(): Promise<Article[]> {
    return await db.select().from(articles).orderBy(articles.articleNumber);
  }

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const [article] = await db.insert(articles).values(insertArticle).returning();
    return article;
  }

  async updateArticle(id: number, data: Partial<InsertArticle>): Promise<Article> {
    const [article] = await db.update(articles).set(data).where(eq(articles.id, id)).returning();
    return article;
  }

  async deleteArticle(id: number): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  }

  // Trips
  async getTrips(): Promise<Trip[]> {
    return await db.select().from(trips).orderBy(desc(trips.tripDate));
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const [trip] = await db.insert(trips).values(insertTrip).returning();
    return trip;
  }

  async updateTrip(id: number, data: Partial<InsertTrip>): Promise<Trip> {
    const [trip] = await db.update(trips).set(data).where(eq(trips.id, id)).returning();
    return trip;
  }

  async deleteTrip(id: number): Promise<void> {
    await db.delete(trips).where(eq(trips.id, id));
  }

  async deleteTrips(from: string | null, to: string | null): Promise<number> {
    if (from && to) {
      const result = await db.delete(trips).where(and(gte(trips.tripDate, from), lte(trips.tripDate, to))).returning();
      return result.length;
    }
    const result = await db.delete(trips).returning();
    return result.length;
  }

  // Loans
  async getLoans(): Promise<Loan[]> {
    return await db.select().from(loans).orderBy(loans.name);
  }

  async createLoan(insertLoan: InsertLoan): Promise<Loan> {
    const [loan] = await db.insert(loans).values(insertLoan).returning();
    return loan;
  }

  async updateLoan(id: number, updates: Partial<InsertLoan>): Promise<Loan> {
    const [updated] = await db.update(loans).set(updates).where(eq(loans.id, id)).returning();
    return updated;
  }

  async deleteLoan(id: number): Promise<void> {
    // First delete all associated payments
    await db.delete(loanPayments).where(eq(loanPayments.loanId, id));
    await db.delete(loans).where(eq(loans.id, id));
  }

  // Loan Payments
  async getLoanPayments(loanId: number): Promise<LoanPayment[]> {
    return await db.select().from(loanPayments).where(eq(loanPayments.loanId, loanId)).orderBy(desc(loanPayments.paymentDate));
  }

  async getAllLoanPayments(): Promise<LoanPayment[]> {
    return await db.select().from(loanPayments).orderBy(desc(loanPayments.paymentDate));
  }

  async createLoanPayment(payment: InsertLoanPayment): Promise<LoanPayment> {
    const [created] = await db.insert(loanPayments).values(payment).returning();
    return created;
  }

  async updateLoanPayment(id: number, updates: Partial<InsertLoanPayment>): Promise<LoanPayment> {
    const [updated] = await db.update(loanPayments).set(updates).where(eq(loanPayments.id, id)).returning();
    return updated;
  }

  async deleteLoanPayment(id: number): Promise<void> {
    await db.delete(loanPayments).where(eq(loanPayments.id, id));
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: number, updates: Partial<InsertCustomer>): Promise<Customer> {
    const [updated] = await db.update(customers).set(updates).where(eq(customers.id, id)).returning();
    return updated;
  }

  async deleteCustomer(id: number): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Users
  async getUsersCount(): Promise<number> {
    const result = await db.select().from(users);
    return result.length;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserResetToken(id: number, token: string | null, expiry: Date | null): Promise<void> {
    await db.update(users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(users.id, id));
  }

  async updateUserPassword(id: number, password: string): Promise<void> {
    await db.update(users).set({ password, resetToken: null, resetTokenExpiry: null }).where(eq(users.id, id));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.name);
  }

  async updateUser(id: number, updates: { username?: string; name?: string; role?: string; password?: string }): Promise<User | undefined> {
    const updateData: Record<string, any> = {};
    if (updates.username) updateData.username = updates.username;
    if (updates.name) updateData.name = updates.name;
    if (updates.role) updateData.role = updates.role;
    if (updates.password) updateData.password = updates.password;
    
    if (Object.keys(updateData).length === 0) {
      return this.getUserById(id);
    }
    
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserVerificationToken(id: number, token: string | null, expiry: Date | null): Promise<void> {
    await db.update(users).set({ verificationToken: token, verificationTokenExpiry: expiry }).where(eq(users.id, id));
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user;
  }

  async verifyUserEmail(id: number): Promise<void> {
    await db.update(users).set({ emailVerified: true, verificationToken: null, verificationTokenExpiry: null }).where(eq(users.id, id));
  }

  // Market Prices
  async getMarketPrices(): Promise<MarketPrice[]> {
    return await db.select().from(marketPrices).orderBy(desc(marketPrices.updatedAt));
  }

  async getMarketPricesForMaterial(materialCategory: string, containerSize: number): Promise<MarketPrice[]> {
    // First try exact match
    let results = await db.select().from(marketPrices)
      .where(and(
        eq(marketPrices.materialCategory, materialCategory),
        eq(marketPrices.containerSizeM3, containerSize)
      ))
      .orderBy(marketPrices.priceGross);
    
    // If no exact match, try fuzzy matching (case-insensitive partial match)
    if (results.length === 0) {
      results = await db.select().from(marketPrices)
        .where(and(
          ilike(marketPrices.materialCategory, `%${materialCategory}%`),
          eq(marketPrices.containerSizeM3, containerSize)
        ))
        .orderBy(marketPrices.priceGross);
    }
    
    // Also try if the search term is contained in stored material names
    if (results.length === 0) {
      const allPrices = await db.select().from(marketPrices)
        .where(eq(marketPrices.containerSizeM3, containerSize))
        .orderBy(marketPrices.priceGross);
      
      // Filter by partial match in either direction
      const searchLower = materialCategory.toLowerCase();
      results = allPrices.filter(p => {
        const storedLower = p.materialCategory.toLowerCase();
        return storedLower.includes(searchLower) || searchLower.includes(storedLower);
      });
    }
    
    return results;
  }

  async createMarketPrice(insertPrice: InsertMarketPrice): Promise<MarketPrice> {
    const [price] = await db.insert(marketPrices).values(insertPrice).returning();
    return price;
  }

  async deleteAllMarketPrices(): Promise<void> {
    await db.delete(marketPrices);
  }

  async ensureRequiredCostVariables(): Promise<void> {
    const costVars = await this.getCostVariables();
    const existingNames = costVars.map(v => v.name);
    
    const requiredCostVars = [
      // Kraftstoff & Fahrzeug
      { category: "fuel", name: "Diesel Preis", value: "1.70", unit: "per_liter", description: "Aktueller Tankstellenpreis" },
      { category: "fuel", name: "Verbrauch (L/100km)", value: "35", unit: "fixed", description: "Durchschnittsverbrauch LKW" },
      { category: "fuel", name: "Kraftstoff (Schätzung)", value: "1911", unit: "per_month", description: "Laufende Fahrzeug-Betriebskosten (Diesel etc.) - BWA 2025" },
      { category: "overhead", name: "Maut / Gebühren", value: "0.19", unit: "per_km", description: "LKW-Maut pro Kilometer" },
      { category: "overhead", name: "Maut (Schätzung)", value: "244", unit: "per_month", description: "Durchschnittliche Mautkosten - BWA 2025" },
      { category: "overhead", name: "Sonstige Fahrzeugkosten", value: "399", unit: "per_month", description: "Sonstige Fahrzeugkosten (nicht Diesel/Reparatur) - BWA 2025" },
      { category: "vehicle_tax", name: "Kfz-Steuer", value: "77", unit: "per_month", description: "Jährliche Kfz-Steuer umgelegt auf Monate - BWA 2025" },
      // Steuerberater & Buchhaltung
      { category: "accountant", name: "Steuerberater Pauschale", value: "539", unit: "per_month", description: "Buchführung (289€) + Jahresabschluss (250€) - BWA 2025" },
      { category: "accountant", name: "Lohnabrechnung", value: "100", unit: "per_month", description: "Monatliche Kosten für Lohnabrechnung" },
      // Versicherungen
      { category: "insurance", name: "Allgemeine Versicherungen", value: "346", unit: "per_month", description: "Betriebshaftpflicht und sonstige Versicherungen - BWA 2025" },
      { category: "insurance", name: "Beiträge/Abgaben", value: "55", unit: "per_month", description: "IHK, BG und sonstige Abgaben - BWA 2025" },
      // Marketing
      { category: "marketing", name: "Werbung", value: "401", unit: "per_month", description: "Marketing und Werbemaßnahmen - BWA 2025" },
      { category: "marketing", name: "Reisekosten", value: "50", unit: "per_month", description: "Geschäftsreisen - BWA 2025" },
      // Verwaltung & Büro
      { category: "admin", name: "Miete/Raumkosten", value: "474", unit: "per_month", description: "Miete (450€) + Reinigung (24€) - BWA 2025" },
      { category: "admin", name: "Rechts-/Beratungskosten", value: "375", unit: "per_month", description: "Anwalt, Unternehmensberatung - BWA 2025" },
      { category: "admin", name: "Internet", value: "13", unit: "per_month", description: "Internetkosten - BWA 2025" },
      { category: "admin", name: "Bürobedarf", value: "94", unit: "per_month", description: "Büromaterial und Verbrauchsmaterialien - BWA 2025" },
      { category: "admin", name: "Bankgebühren", value: "33", unit: "per_month", description: "Kontoführung und Geldverkehr - BWA 2025" },
      { category: "admin", name: "Fortbildung", value: "75", unit: "per_month", description: "Weiterbildungskosten - BWA 2025" },
      { category: "admin", name: "Lizenzen/Konzessionen", value: "30", unit: "per_month", description: "Software-Lizenzen und Konzessionen - BWA 2025" },
      { category: "admin", name: "Werkzeuge/Kleingeräte", value: "17", unit: "per_month", description: "Werkzeug und kleine Geräte - BWA 2025" },
      { category: "admin", name: "Sonstiger Betriebsbedarf", value: "337", unit: "per_month", description: "Diverse sonstige Betriebskosten - BWA 2025" },
    ];
    
    const requiredNames = requiredCostVars.map(cv => cv.name);

    for (const cv of requiredCostVars) {
      const existing = costVars.find(v => v.name === cv.name);
      if (!existing) {
        await this.createCostVariable(cv as InsertCostVariable);
        console.log(`[storage] Created missing cost variable: ${cv.name}`);
      } else if (existing.value !== cv.value || existing.category !== cv.category || existing.unit !== cv.unit) {
        await db.update(costVariables)
          .set({ value: cv.value, category: cv.category, unit: cv.unit, description: cv.description })
          .where(eq(costVariables.id, existing.id));
        console.log(`[storage] Updated cost variable: ${cv.name} (${existing.value} → ${cv.value})`);
      }
    }

    const deprecatedNames = [
      "Buchhaltung Software",
      "Bürokosten",
      "Betriebshaftpflichtvers.",
    ];
    for (const name of deprecatedNames) {
      const deprecated = costVars.find(v => v.name === name);
      if (deprecated) {
        await db.delete(costVariables).where(eq(costVariables.id, deprecated.id));
        console.log(`[storage] Removed deprecated cost variable: ${name}`);
      }
    }
  }

  // Sales Prices (eigene Verkaufspreise)
  async getSalesPrices(): Promise<SalesPrice[]> {
    return await db.select().from(salesPrices).orderBy(salesPrices.avvCode);
  }

  async getSalesPriceByAvv(avvCode: string): Promise<SalesPrice | undefined> {
    const normalizedCode = avvCode.replace(/\s/g, '').replace('*', '');
    const allPrices = await db.select().from(salesPrices).where(eq(salesPrices.isActive, true));
    return allPrices.find(p => {
      const storedCode = p.avvCode.replace(/\s/g, '').replace('*', '');
      return storedCode === normalizedCode;
    });
  }

  async createSalesPrice(insertPrice: InsertSalesPrice): Promise<SalesPrice> {
    const [price] = await db.insert(salesPrices).values(insertPrice).returning();
    return price;
  }

  async updateSalesPrice(id: number, updates: Partial<InsertSalesPrice>): Promise<SalesPrice> {
    const [updated] = await db.update(salesPrices).set({ ...updates, updatedAt: new Date() }).where(eq(salesPrices.id, id)).returning();
    return updated;
  }

  async deleteSalesPrice(id: number): Promise<void> {
    await db.delete(salesPrices).where(eq(salesPrices.id, id));
  }

  // Sales Surcharges (Verkaufs-Zuschläge)
  async getSalesSurcharges(): Promise<SalesSurcharge[]> {
    return await db.select().from(salesSurcharges).orderBy(salesSurcharges.name);
  }

  async createSalesSurcharge(data: InsertSalesSurcharge): Promise<SalesSurcharge> {
    const [surcharge] = await db.insert(salesSurcharges).values(data).returning();
    return surcharge;
  }

  async updateSalesSurcharge(id: number, data: Partial<InsertSalesSurcharge>): Promise<SalesSurcharge> {
    const [surcharge] = await db.update(salesSurcharges).set(data).where(eq(salesSurcharges.id, id)).returning();
    return surcharge;
  }

  async deleteSalesSurcharge(id: number): Promise<void> {
    await db.delete(salesSurcharges).where(eq(salesSurcharges.id, id));
  }

  // Sales Fixed Prices (Pauschalen)
  async getSalesFixedPrices(): Promise<SalesFixedPrice[]> {
    return await db.select().from(salesFixedPrices).orderBy(salesFixedPrices.name);
  }

  async createSalesFixedPrice(insertPrice: InsertSalesFixedPrice): Promise<SalesFixedPrice> {
    const [price] = await db.insert(salesFixedPrices).values(insertPrice).returning();
    return price;
  }

  async updateSalesFixedPrice(id: number, updates: Partial<InsertSalesFixedPrice>): Promise<SalesFixedPrice> {
    const [updated] = await db.update(salesFixedPrices).set({ ...updates, updatedAt: new Date() }).where(eq(salesFixedPrices.id, id)).returning();
    return updated;
  }

  async deleteSalesFixedPrice(id: number): Promise<void> {
    await db.delete(salesFixedPrices).where(eq(salesFixedPrices.id, id));
  }

  // Offer Counter (Angebotsnummern)
  async getNextOfferNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    
    // Get or create counter for current year
    let counter = await db.select().from(offerCounters).where(eq(offerCounters.year, year)).limit(1);
    
    let nextNumber: number;
    if (counter.length === 0) {
      // Create new counter for this year starting at 1
      const [newCounter] = await db.insert(offerCounters).values({ year, counter: 1 }).returning();
      nextNumber = 1;
    } else {
      // Increment existing counter
      nextNumber = counter[0].counter + 1;
      await db.update(offerCounters).set({ counter: nextNumber }).where(eq(offerCounters.year, year));
    }
    
    // Format: A-YYYY-QQ-NNNN
    const offerNumber = `A-${year}-${quarter.toString().padStart(2, '0')}-${nextNumber.toString().padStart(4, '0')}`;
    return offerNumber;
  }

  // Forecast Scenarios
  async getForecastScenarios(): Promise<ForecastScenario[]> {
    return await db.select().from(forecastScenarios).orderBy(desc(forecastScenarios.updatedAt));
  }

  async getForecastScenario(id: number): Promise<ForecastScenario | undefined> {
    const [scenario] = await db.select().from(forecastScenarios).where(eq(forecastScenarios.id, id));
    return scenario;
  }

  async createForecastScenario(scenario: InsertForecastScenario): Promise<ForecastScenario> {
    const [created] = await db.insert(forecastScenarios).values(scenario).returning();
    return created;
  }

  async updateForecastScenario(id: number, updates: Partial<InsertForecastScenario>): Promise<ForecastScenario> {
    const [updated] = await db.update(forecastScenarios).set({ ...updates, updatedAt: new Date() }).where(eq(forecastScenarios.id, id)).returning();
    return updated;
  }

  async deleteForecastScenario(id: number): Promise<void> {
    await db.delete(forecastScenarios).where(eq(forecastScenarios.id, id));
  }

  async getBwaReports(year?: number): Promise<BwaReport[]> {
    if (year) {
      return await db.select().from(bwaReports).where(eq(bwaReports.year, year)).orderBy(bwaReports.month);
    }
    return await db.select().from(bwaReports).orderBy(desc(bwaReports.year), bwaReports.month);
  }

  async getBwaReport(id: number): Promise<BwaReport | undefined> {
    const [report] = await db.select().from(bwaReports).where(eq(bwaReports.id, id));
    return report;
  }

  async createBwaReport(report: InsertBwaReport): Promise<BwaReport> {
    const [created] = await db.insert(bwaReports).values(report).returning();
    return created;
  }

  async updateBwaReport(id: number, updates: Partial<InsertBwaReport>): Promise<BwaReport> {
    const [updated] = await db.update(bwaReports).set(updates).where(eq(bwaReports.id, id)).returning();
    return updated;
  }

  async deleteBwaReport(id: number): Promise<void> {
    await db.delete(bwaReports).where(eq(bwaReports.id, id));
  }

  async upsertBwaReport(report: InsertBwaReport): Promise<BwaReport> {
    const existing = await db.select().from(bwaReports)
      .where(and(eq(bwaReports.year, report.year), eq(bwaReports.month, report.month)));
    if (existing.length > 0) {
      const [updated] = await db.update(bwaReports).set(report).where(eq(bwaReports.id, existing[0].id)).returning();
      return updated;
    }
    return this.createBwaReport(report);
  }

  // ============================================================
  // Aufgaben & Notizen
  // ============================================================

  private async hydrateTasks(rows: Task[]): Promise<TaskWithRelations[]> {
    if (rows.length === 0) return [];
    const ids = rows.map(t => t.id);
    const [assignees, attachmentRows, commentRows] = await Promise.all([
      db.select().from(taskAssignees).where(inArray(taskAssignees.taskId, ids)),
      db.select({
        id: taskAttachments.id, taskId: taskAttachments.taskId,
        filename: taskAttachments.filename, mimeType: taskAttachments.mimeType,
        size: taskAttachments.size, uploadedById: taskAttachments.uploadedById,
        uploadedAt: taskAttachments.uploadedAt,
      }).from(taskAttachments).where(inArray(taskAttachments.taskId, ids)),
      db.select({ taskId: taskComments.taskId, n: sql<number>`count(*)::int` })
        .from(taskComments).where(inArray(taskComments.taskId, ids)).groupBy(taskComments.taskId),
    ]);
    return rows.map(t => ({
      ...t,
      assigneeIds: assignees.filter(a => a.taskId === t.id).map(a => a.userId),
      attachments: attachmentRows.filter(a => a.taskId === t.id).map(({ taskId, ...rest }) => rest),
      commentCount: commentRows.find(c => c.taskId === t.id)?.n ?? 0,
    }));
  }

  async getTasksForUser(userId: number): Promise<TaskWithRelations[]> {
    const assigneeRows = await db.select({ taskId: taskAssignees.taskId })
      .from(taskAssignees).where(eq(taskAssignees.userId, userId));
    const assignedIds = assigneeRows.map(r => r.taskId);
    const rows = await db.select().from(tasks).where(
      assignedIds.length > 0
        ? or(eq(tasks.createdById, userId), inArray(tasks.id, assignedIds))!
        : eq(tasks.createdById, userId)
    ).orderBy(desc(tasks.createdAt));
    return this.hydrateTasks(rows);
  }

  async getAllTasks(): Promise<TaskWithRelations[]> {
    const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    return this.hydrateTasks(rows);
  }

  async getTaskById(id: number): Promise<TaskWithRelations | undefined> {
    const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!row) return undefined;
    const [hydrated] = await this.hydrateTasks([row]);
    return hydrated;
  }

  async createTask(input: InsertTask, createdById: number, assigneeIds: number[] = []): Promise<TaskWithRelations> {
    const [task] = await db.insert(tasks).values({ ...input, createdById }).returning();
    const uniqueAssignees = Array.from(new Set(assigneeIds));
    if (uniqueAssignees.length > 0) {
      await db.insert(taskAssignees).values(uniqueAssignees.map(uid => ({ taskId: task.id, userId: uid })));
    }
    const result = await this.getTaskById(task.id);
    return result!;
  }

  async updateTask(id: number, updates: Partial<InsertTask>, assigneeIds?: number[]): Promise<TaskWithRelations | undefined> {
    await db.update(tasks).set({ ...updates, updatedAt: new Date() }).where(eq(tasks.id, id));
    if (assigneeIds) {
      await db.delete(taskAssignees).where(eq(taskAssignees.taskId, id));
      const uniqueAssignees = Array.from(new Set(assigneeIds));
      if (uniqueAssignees.length > 0) {
        await db.insert(taskAssignees).values(uniqueAssignees.map(uid => ({ taskId: id, userId: uid })));
      }
      // Status changed: clear reminder log so new escalations can fire later
      await db.delete(taskReminderLog).where(eq(taskReminderLog.taskId, id));
    }
    return this.getTaskById(id);
  }

  async completeTask(id: number, userId: number): Promise<TaskWithRelations | undefined> {
    await db.update(tasks).set({
      status: "erledigt",
      completedAt: new Date(),
      completedById: userId,
      updatedAt: new Date(),
    }).where(eq(tasks.id, id));
    return this.getTaskById(id);
  }

  async reopenTask(id: number): Promise<TaskWithRelations | undefined> {
    await db.update(tasks).set({
      status: "offen",
      completedAt: null,
      completedById: null,
      updatedAt: new Date(),
    }).where(eq(tasks.id, id));
    await db.delete(taskReminderLog).where(eq(taskReminderLog.taskId, id));
    return this.getTaskById(id);
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Comments
  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    return db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(asc(taskComments.createdAt));
  }

  async createTaskComment(input: InsertTaskComment): Promise<TaskComment> {
    const [created] = await db.insert(taskComments).values(input).returning();
    return created;
  }

  async deleteTaskComment(id: number): Promise<void> {
    await db.delete(taskComments).where(eq(taskComments.id, id));
  }

  // Attachments
  async createTaskAttachment(input: { taskId: number; filename: string; mimeType: string; size: number; data: string; uploadedById: number; }): Promise<TaskAttachment> {
    const [created] = await db.insert(taskAttachments).values(input).returning();
    return created;
  }

  async getTaskAttachment(id: number): Promise<TaskAttachment | undefined> {
    const [row] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id));
    return row;
  }

  async deleteTaskAttachment(id: number): Promise<void> {
    await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
  }

  // Reminder log
  async hasReminderBeenSent(taskId: number, type: "reminder" | "escalation"): Promise<boolean> {
    const rows = await db.select().from(taskReminderLog)
      .where(and(eq(taskReminderLog.taskId, taskId), eq(taskReminderLog.type, type)));
    return rows.length > 0;
  }

  async logReminderSent(taskId: number, type: "reminder" | "escalation"): Promise<void> {
    await db.insert(taskReminderLog).values({ taskId, type });
  }

  async getTasksDueWithinHours(hours: number): Promise<TaskWithRelations[]> {
    const now = new Date();
    const horizon = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const rows = await db.select().from(tasks).where(and(
      isNotNull(tasks.dueDate),
      gte(tasks.dueDate, now),
      lte(tasks.dueDate, horizon),
      sql`${tasks.status} != 'erledigt'`,
    ));
    return this.hydrateTasks(rows);
  }

  async getOverdueTasks(): Promise<TaskWithRelations[]> {
    const now = new Date();
    const rows = await db.select().from(tasks).where(and(
      isNotNull(tasks.dueDate),
      lte(tasks.dueDate, now),
      sql`${tasks.status} != 'erledigt'`,
    ));
    return this.hydrateTasks(rows);
  }

  // Notes
  private async hydrateNotes(rows: Note[]): Promise<NoteWithAttachments[]> {
    if (rows.length === 0) return [];
    const ids = rows.map(n => n.id);
    const attachmentRows = await db.select({
      id: noteAttachments.id, noteId: noteAttachments.noteId,
      filename: noteAttachments.filename, mimeType: noteAttachments.mimeType,
      size: noteAttachments.size, uploadedById: noteAttachments.uploadedById,
      uploadedAt: noteAttachments.uploadedAt,
    }).from(noteAttachments).where(inArray(noteAttachments.noteId, ids));
    return rows.map(n => ({
      ...n,
      attachments: attachmentRows.filter(a => a.noteId === n.id).map(({ noteId, ...rest }) => rest),
    }));
  }

  async getNotesForUser(userId: number): Promise<NoteWithAttachments[]> {
    const rows = await db.select().from(notes).where(
      or(eq(notes.createdById, userId), eq(notes.visibility, "public"))!
    ).orderBy(desc(notes.updatedAt));
    return this.hydrateNotes(rows);
  }

  async getNoteById(id: number): Promise<NoteWithAttachments | undefined> {
    const [row] = await db.select().from(notes).where(eq(notes.id, id));
    if (!row) return undefined;
    const [hydrated] = await this.hydrateNotes([row]);
    return hydrated;
  }

  async createNote(input: InsertNote): Promise<NoteWithAttachments> {
    const [created] = await db.insert(notes).values(input).returning();
    return (await this.getNoteById(created.id))!;
  }

  async updateNote(id: number, updates: Partial<InsertNote>): Promise<NoteWithAttachments | undefined> {
    await db.update(notes).set({ ...updates, updatedAt: new Date() }).where(eq(notes.id, id));
    return this.getNoteById(id);
  }

  async completeNote(id: number): Promise<NoteWithAttachments | undefined> {
    await db.update(notes).set({ completedAt: new Date(), updatedAt: new Date() }).where(eq(notes.id, id));
    return this.getNoteById(id);
  }

  async reopenNote(id: number): Promise<NoteWithAttachments | undefined> {
    await db.update(notes).set({ completedAt: null, updatedAt: new Date() }).where(eq(notes.id, id));
    return this.getNoteById(id);
  }

  async deleteNote(id: number): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  async createNoteAttachment(input: { noteId: number; filename: string; mimeType: string; size: number; data: string; uploadedById: number; }): Promise<NoteAttachment> {
    const [created] = await db.insert(noteAttachments).values(input).returning();
    return created;
  }

  async getNoteAttachment(id: number): Promise<NoteAttachment | undefined> {
    const [row] = await db.select().from(noteAttachments).where(eq(noteAttachments.id, id));
    return row;
  }

  async deleteNoteAttachment(id: number): Promise<void> {
    await db.delete(noteAttachments).where(eq(noteAttachments.id, id));
  }

  // Notification settings
  async getNotificationSettings(userId: number): Promise<UserNotificationSettings> {
    const [row] = await db.select().from(userNotificationSettings).where(eq(userNotificationSettings.userId, userId));
    if (row) return row;
    const [created] = await db.insert(userNotificationSettings).values({ userId, emailRemindersEnabled: true }).returning();
    return created;
  }

  async updateNotificationSettings(userId: number, updates: Partial<InsertUserNotificationSettings>): Promise<UserNotificationSettings> {
    const existing = await this.getNotificationSettings(userId);
    const [updated] = await db.update(userNotificationSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userNotificationSettings.id, existing.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
