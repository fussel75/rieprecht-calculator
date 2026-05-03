import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendPasswordResetEmail, sendVerificationEmail, sendQuoteEmail, sendPriceCalculationEmail, sendReportEmail, sendPriceListEmail, sendTaskReminderEmail, sendTaskEscalationEmail, sendTaskAssignedEmail } from "./email";
import { insertTaskSchema, insertTaskCommentSchema, insertNoteSchema } from "@shared/schema";
import OpenAI from "openai";
import { generateReportData, generateReportHTML, generateAnnualReportData, generateAnnualReportHTML, generateAnnualReportCSV, getDefaultForecastParams, getDefaultForecastParamsFromDB } from "./report";
import { generatePdfFromHtml, generateCalculatorPdfHtml, generatePlanningPdfHtml, generateTripsPdfHtml, generateCustomersPdfHtml, generatePriceOptPdfHtml, generateCustomerPriceListHtml } from "./pdf";
import { forecastParamsSchema, savedPlans } from "@shared/schema";
import { calcPurchaseSurchargeTotal, calcSalesSurchargeTotal } from "./surchargeCalc";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { findBuhckPriceForMaterial, getAllBuhckPricesForContainerSizes } from "./buhck-prices";
import { findJunkbustersPriceForMaterial } from "./junkbusters-prices";
import { fetchWebMarketPrices } from "./web-market-prices";
import multer from "multer";

const SALT_ROUNDS = 12;

export async function refreshAllMarketPrices(): Promise<{ buhck: number; junkbusters: number; ai: number; total: number }> {
  const dbMaterials = await storage.getMaterials();
  const activeMaterials = dbMaterials.filter(m => m.isActive);
  const containerSizes = [3, 5, 7, 10];
  const today = new Date().toISOString().split('T')[0];

  await storage.deleteAllMarketPrices();

  const insertedPrices: Array<{ material: string; size: number; source: string }> = [];
  const coveredCombinations = new Set<string>();

  for (const material of activeMaterials) {
    for (const size of containerSizes) {
      const comboKey = `${material.name}::${size}`;

      const buhckPrice = findBuhckPriceForMaterial(material.name, size);
      if (buhckPrice) {
        await storage.createMarketPrice({
          provider: "BUHCK Hamburg",
          providerUrl: "https://buhck-hamburg.de",
          materialCategory: material.name,
          containerSizeM3: size,
          priceGross: buhckPrice.priceBrutto.toString(),
          priceNet: buhckPrice.priceNetto.toString(),
          includesTransport: true,
          includesDisposal: true,
          notes: `${buhckPrice.source} - inkl. Maut, CO₂-Pauschale, Behältergestellung`,
          sourceDate: today,
        });
        insertedPrices.push({ material: material.name, size, source: "BUHCK" });
        coveredCombinations.add(comboKey);
      }

      const density = Number(material.density || 0);
      const jbPrice = findJunkbustersPriceForMaterial(material.name, size, density > 0 ? density : undefined);
      if (jbPrice) {
        await storage.createMarketPrice({
          provider: "Junkbusters Hamburg",
          providerUrl: "https://junkbusters.de",
          materialCategory: material.name,
          containerSizeM3: size,
          priceGross: jbPrice.priceBrutto.toString(),
          priceNet: jbPrice.priceNetto.toString(),
          includesTransport: true,
          includesDisposal: true,
          notes: `${jbPrice.source} - inkl. Abholung/Wechsel`,
          sourceDate: today,
        });
        insertedPrices.push({ material: material.name, size, source: "Junkbusters" });
        coveredCombinations.add(comboKey);
      }
    }
  }

  const missingEntsorgung: Array<{ material: string; size: number }> = [];
  const missingLieferung: Array<{ material: string; size: number }> = [];
  for (const material of activeMaterials) {
    const isLieferung = (material as any).materialType === "lieferung";
    for (const size of containerSizes) {
      if (!coveredCombinations.has(`${material.name}::${size}`)) {
        if (isLieferung) {
          missingLieferung.push({ material: material.name, size });
        } else {
          missingEntsorgung.push({ material: material.name, size });
        }
      }
    }
  }

  const allMissingCombos = [...missingEntsorgung, ...missingLieferung];
  if (allMissingCombos.length > 0) {
    try {
      const materialNames = [...new Set(allMissingCombos.map((c) => c.material))];
      const webPrices = await fetchWebMarketPrices(materialNames, containerSizes);

      for (const wp of webPrices) {
        const matchedMaterial = activeMaterials.find(
          (m) => m.name.toLowerCase() === wp.material.toLowerCase() ||
            m.name.toLowerCase().includes(wp.material.toLowerCase()) ||
            wp.material.toLowerCase().includes(m.name.toLowerCase())
        );
        const matName = matchedMaterial?.name || wp.material;
        const sizes = wp.containerSize ? [wp.containerSize] : containerSizes;

        const gross = wp.priceGross;
        const net = wp.priceNet || Number((gross / 1.19).toFixed(2));

        for (const size of sizes) {
          const comboKey = `${matName}::${size}`;
          if (coveredCombinations.has(comboKey)) continue;

          await storage.createMarketPrice({
            provider: `${wp.provider} (Web)`,
            providerUrl: wp.sourceUrl || null,
            materialCategory: matName,
            containerSizeM3: size,
            priceGross: gross.toString(),
            priceNet: net.toString(),
            includesTransport: wp.includesTransport ?? true,
            includesDisposal: wp.includesDisposal ?? true,
            notes: wp.notes || "Echte Webpreise aus Hamburger Anbieter",
            sourceDate: today,
          });
          insertedPrices.push({ material: matName, size, source: "Web" });
          coveredCombinations.add(comboKey);
        }
      }
      console.log(`[market-prices] Web prices added: ${webPrices.length} found, ${insertedPrices.filter(p => p.source === "Web").length} inserted`);
    } catch (webErr) {
      console.error("[market-prices] Web price fetch failed:", webErr);
    }
  }

  for (const material of activeMaterials) {
    const isLieferung = (material as any).materialType === "lieferung";
    for (const size of containerSizes) {
      const comboKey = `${material.name}::${size}`;
      if (coveredCombinations.has(comboKey)) {
        const idx = isLieferung
          ? missingLieferung.findIndex((c) => c.material === material.name && c.size === size)
          : missingEntsorgung.findIndex((c) => c.material === material.name && c.size === size);
        if (idx >= 0) {
          if (isLieferung) missingLieferung.splice(idx, 1);
          else missingEntsorgung.splice(idx, 1);
        }
      }
    }
  }

  const marketPriceResponseSchema = z.object({
    prices: z.array(
      z.object({
        material: z.string(),
        containerSize: z.number(),
        priceGross: z.number(),
        notes: z.string().optional(),
      })
    ),
  });

  const processAiPrices = async (combinations: Array<{ material: string; size: number }>, prompt: string) => {
    if (combinations.length === 0) return;
    try {
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const rawData = JSON.parse(content);
        const validationResult = marketPriceResponseSchema.safeParse(rawData);

        if (validationResult.success) {
          for (const price of validationResult.data.prices) {
            await storage.createMarketPrice({
              provider: "KI-Schätzung Hamburg",
              providerUrl: null,
              materialCategory: price.material,
              containerSizeM3: price.containerSize,
              priceGross: price.priceGross.toString(),
              priceNet: (price.priceGross / 1.19).toFixed(2),
              includesTransport: true,
              includesDisposal: true,
              notes: price.notes || "KI-basierte Marktschätzung",
              sourceDate: today,
            });
            insertedPrices.push({ material: price.material, size: price.containerSize, source: "KI" });
          }
        }
      }
    } catch (aiErr) {
      console.error("AI market price fetch failed:", aiErr);
    }
  };

  if (missingEntsorgung.length > 0) {
    const entsorgungPrompt = `Du bist ein Experte für Container-Entsorgungspreise in Hamburg.

Schätze die Bruttopreise (inkl. 19% MwSt.) für folgende Material-Container-Kombinationen:

${missingEntsorgung.map((c) => `- ${c.material}: ${c.size}m³`).join("\n")}

Die Preise sollen für den Großraum Hamburg gelten und beinhalten:
- Container-Miete (ca. 2 Wochen)
- Transport (Hin- und Rückfahrt)  
- Entsorgung des Materials

Gib die Preise im JSON-Format zurück:
{
  "prices": [
    {"material": "Materialname", "containerSize": 7, "priceGross": 450, "notes": "KI-Schätzung"}
  ]
}

Wichtig: Verwende die exakten Materialnamen wie oben angegeben!`;
    await processAiPrices(missingEntsorgung, entsorgungPrompt);
  }

  if (missingLieferung.length > 0) {
    const lieferungPrompt = `Du bist ein Experte für Schüttgut- und Baustoffpreise im Großraum Hamburg.

Schätze die Bruttopreise (inkl. 19% MwSt.) für die Lieferung folgender Schüttgüter/Baustoffe per Container:

${missingLieferung.map((c) => `- ${c.material}: ${c.size}m³ Container`).join("\n")}

Die Preise sollen für den Großraum Hamburg gelten und beinhalten:
- Materialkosten (Schüttgut/Baustoff)
- Container-Bereitstellung
- Transport/Lieferung zum Kunden

Orientiere dich an aktuellen Marktpreisen von Hamburger Baustoffhändlern und Containerdiensten wie:
- Buhck, Otto Dörner, Eggers, Hamann, Tegel
- Online-Anbieter wie Schüttgut-Hamburg, Kieskontor

Gib die Preise im JSON-Format zurück:
{
  "prices": [
    {"material": "Materialname", "containerSize": 7, "priceGross": 650, "notes": "KI-Schätzung basierend auf Hamburger Baustoffmarkt"}
  ]
}

Wichtig: Verwende die exakten Materialnamen wie oben angegeben! Berücksichtige dass Schüttgüter typischerweise in Tonnen gehandelt werden, aber hier als Containerlieferung in m³ kalkuliert werden.`;
    await processAiPrices(missingLieferung, lieferungPrompt);
  }

  const updatedPrices = await storage.getMarketPrices();
  return {
    buhck: insertedPrices.filter((p) => p.source === "BUHCK").length,
    junkbusters: insertedPrices.filter((p) => p.source === "Junkbusters").length,
    web: insertedPrices.filter((p) => p.source === "Web").length,
    ai: insertedPrices.filter((p) => p.source === "KI").length,
    total: updatedPrices.length,
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Nicht angemeldet" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  // Vehicles
  app.get(api.vehicles.list.path, async (req, res) => {
    const vehicles = await storage.getVehicles();
    res.json(vehicles);
  });

  app.post(api.vehicles.create.path, async (req, res) => {
    try {
      const input = api.vehicles.create.input.parse(req.body);
      const vehicle = await storage.createVehicle(input);
      res.status(201).json(vehicle);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.vehicles.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.vehicles.update.input.parse(req.body);
      const vehicle = await storage.updateVehicle(id, input);
      if (!vehicle) {
        return res.status(404).json({ message: "Fahrzeug nicht gefunden" });
      }
      res.json(vehicle);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Fahrzeug nicht gefunden" });
    }
  });

  app.delete(api.vehicles.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVehicle(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Fahrzeug nicht gefunden" });
    }
  });

  // Employees
  app.get(api.employees.list.path, async (req, res) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.post(api.employees.create.path, async (req, res) => {
    try {
      const input = api.employees.create.input.parse(req.body);
      const employee = await storage.createEmployee(input);
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.employees.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.employees.update.input.parse(req.body);
      const employee = await storage.updateEmployee(id, input);
      if (!employee) {
        return res.status(404).json({ message: "Mitarbeiter nicht gefunden" });
      }
      res.json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Mitarbeiter nicht gefunden" });
    }
  });

  app.delete(api.employees.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEmployee(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Mitarbeiter nicht gefunden" });
    }
  });

  // Containers
  app.get(api.containers.list.path, async (req, res) => {
    const containers = await storage.getContainers();
    res.json(containers);
  });

  app.post(api.containers.create.path, async (req, res) => {
    try {
      const input = api.containers.create.input.parse(req.body);
      const container = await storage.createContainer(input);
      res.status(201).json(container);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.containers.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.containers.update.input.parse(req.body);
      const container = await storage.updateContainer(id, input);
      if (!container) {
        return res.status(404).json({ message: "Container nicht gefunden" });
      }
      res.json(container);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Container nicht gefunden" });
    }
  });

  app.delete(api.containers.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteContainer(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Container nicht gefunden" });
    }
  });

  // Materials
  app.get(api.materials.list.path, async (req, res) => {
    const materials = await storage.getMaterials();
    res.json(materials);
  });

  app.post(api.materials.create.path, async (req, res) => {
    try {
      const input = api.materials.create.input.parse(req.body);
      const material = await storage.createMaterial(input);
      res.status(201).json(material);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.put(api.materials.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.materials.update.input.parse(req.body);
      const material = await storage.updateMaterial(id, input);
      res.json(material);
    } catch (err) {
      res.status(404).json({ message: "Material nicht gefunden" });
    }
  });

  app.delete(api.materials.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMaterial(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Material nicht gefunden" });
    }
  });

  // Purchase Surcharges (Einkaufs-Pauschalen)
  app.get('/api/purchase-surcharges', async (_req, res) => {
    const surcharges = await storage.getPurchaseSurcharges();
    res.json(surcharges);
  });

  app.post('/api/purchase-surcharges', requireAuth, async (req, res) => {
    try {
      const { insertPurchaseSurchargeSchema } = await import("@shared/schema");
      const input = insertPurchaseSurchargeSchema.parse(req.body);
      const surcharge = await storage.createPurchaseSurcharge(input);
      res.status(201).json(surcharge);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Fehler beim Erstellen" });
    }
  });

  app.put('/api/purchase-surcharges/:id', requireAuth, async (req, res) => {
    try {
      const { insertPurchaseSurchargeSchema } = await import("@shared/schema");
      const id = parseInt(req.params.id);
      const input = insertPurchaseSurchargeSchema.partial().parse(req.body);
      const surcharge = await storage.updatePurchaseSurcharge(id, input);
      res.json(surcharge);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Fehler beim Aktualisieren" });
    }
  });

  app.delete('/api/purchase-surcharges/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allMaterials = await storage.getMaterials();
      for (const mat of allMaterials) {
        if (mat.purchaseSurchargeIds?.includes(id)) {
          const newIds = mat.purchaseSurchargeIds.filter(sid => sid !== id);
          await storage.updateMaterial(mat.id, { purchaseSurchargeIds: newIds });
        }
      }
      await storage.deletePurchaseSurcharge(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Pauschale nicht gefunden" });
    }
  });

  // Cost Variables
  app.get(api.costVariables.list.path, async (req, res) => {
    let variables = await storage.getCostVariables();
    
    // Ensure required cost variables exist
    const existingNames = variables.map(v => v.name);
    const requiredVars = [
      { category: "fuel", name: "Kraftstoff (Schätzung)", value: "2000", unit: "per_month", description: "Geschätzter monatlicher Kraftstoffverbrauch" },
      { category: "overhead", name: "Maut (Schätzung)", value: "500", unit: "per_month", description: "Geschätzte monatliche Mautkosten" },
    ];
    
    let added = false;
    for (const cv of requiredVars) {
      if (!existingNames.includes(cv.name)) {
        await storage.createCostVariable(cv);
        added = true;
      }
    }
    
    if (added) {
      variables = await storage.getCostVariables();
    }
    
    res.json(variables);
  });

  app.post(api.costVariables.create.path, async (req, res) => {
    try {
      const input = api.costVariables.create.input.parse(req.body);
      const variable = await storage.createCostVariable(input);
      res.status(201).json(variable);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.costVariables.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.costVariables.update.input.parse(req.body);
      const variable = await storage.updateCostVariable(id, input);
      res.json(variable);
    } catch (err) {
      res.status(404).json({ message: "Kostenvariable nicht gefunden" });
    }
  });

  app.delete(api.costVariables.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCostVariable(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Kostenvariable nicht gefunden" });
    }
  });

  // Settings
  app.get(api.settings.get.path, async (req, res) => {
    let settings = await storage.getPlanningSettings();
    if (!settings) {
      settings = await storage.updatePlanningSettings({
        containersPerDay: 5,
        workDaysPerMonth: 20,
        targetMarginPercent: "15",
        activeTrucks: 1
      });
    }
    res.json(settings);
  });

  app.post(api.settings.update.path, async (req, res) => {
    const input = api.settings.update.input.parse(req.body);
    const settings = await storage.updatePlanningSettings(input);
    res.json(settings);
  });

  // Quotes
  app.get(api.quotes.list.path, async (req, res) => {
    const quotes = await storage.getQuotes();
    res.json(quotes);
  });

  app.post(api.quotes.create.path, async (req, res) => {
    try {
      const input = api.quotes.create.input.parse(req.body);
      const quote = await storage.createQuote(input);
      res.status(201).json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Send quote email - with Zod validation (using finite() to reject NaN/Infinity)
  const sendQuoteEmailSchema = z.object({
    recipientEmails: z.array(z.string().email("Ungültige E-Mail-Adresse")).min(1),
    customerType: z.enum(["privat", "gewerblich"]),
    firstName: z.string().min(1).max(100),
    lastName: z.string().max(100).default(""),
    companyName: z.string().max(200).optional(),
    materialName: z.string().min(1).max(200),
    articleNumber: z.string().max(50).nullable().optional(),
    containerSize: z.number().finite().positive(),
    distanceKm: z.number().finite().nonnegative(),
    estimatedWeightT: z.number().finite().nonnegative(),
    finalPrice: z.number().finite().nonnegative(),
    grossPrice: z.number().finite().nonnegative(),
    volumeM3: z.number().finite().nonnegative(),
    quantity: z.number().int().min(1).max(2).default(1),
    withTrailer: z.boolean().default(false),
    // Container 2 info (when different material)
    material2Name: z.string().max(200).nullable().optional(),
    material2WeightT: z.number().finite().nonnegative().nullable().optional(),
    material2VolumeM3: z.number().finite().nonnegative().nullable().optional(),
  });

  app.post("/api/quotes/send-email", requireAuth, async (req, res) => {
    try {
      console.log('[Quote Email] Request body:', JSON.stringify(req.body));
      
      const parsed = sendQuoteEmailSchema.safeParse(req.body);
      
      if (!parsed.success) {
        console.error('[Quote Email] Validation failed:', parsed.error.errors);
        return res.status(400).json({ message: parsed.error.errors[0].message || "Ungültige Eingabedaten." });
      }
      
      const data = parsed.data;
      console.log('[Quote Email] Sending to:', data.recipientEmails);
      
      // Generate unique offer number
      const offerNumber = await storage.getNextOfferNumber();
      console.log('[Quote Email] Generated offer number:', offerNumber);
      
      const success = await sendQuoteEmail({
        recipientEmails: data.recipientEmails,
        customerType: data.customerType,
        firstName: data.firstName,
        lastName: data.lastName,
        companyName: data.companyName,
        materialName: data.materialName,
        articleNumber: data.articleNumber,
        containerSize: data.containerSize,
        distanceKm: data.distanceKm,
        estimatedWeightT: data.estimatedWeightT,
        finalPrice: data.finalPrice,
        grossPrice: data.grossPrice,
        volumeM3: data.volumeM3,
        quantity: data.quantity,
        withTrailer: data.withTrailer,
        material2Name: data.material2Name,
        material2WeightT: data.material2WeightT,
        material2VolumeM3: data.material2VolumeM3,
        offerNumber: offerNumber,
      });
      
      if (success) {
        const emailCount = data.recipientEmails.length;
        res.json({ success: true, message: `Angebot ${offerNumber} wurde an ${emailCount} E-Mail${emailCount > 1 ? 's' : ''} versendet.`, offerNumber });
      } else {
        res.status(500).json({ message: "E-Mail konnte nicht gesendet werden." });
      }
    } catch (err) {
      console.error("Error sending quote email:", err);
      res.status(500).json({ message: "Fehler beim Versenden des Angebots." });
    }
  });

  // Articles (Artikelstamm)
  app.get("/api/articles", async (req, res) => {
    const articles = await storage.getArticles();
    res.json(articles);
  });

  app.post("/api/articles", requireAuth, async (req, res) => {
    try {
      const article = await storage.createArticle(req.body);
      res.status(201).json(article);
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        return res.status(409).json({ message: "Artikelnummer existiert bereits" });
      }
      res.status(400).json({ message: "Fehler beim Erstellen des Artikels" });
    }
  });

  app.put("/api/articles/:id", requireAuth, async (req, res) => {
    try {
      const article = await storage.updateArticle(Number(req.params.id), req.body);
      res.json(article);
    } catch (err) {
      res.status(404).json({ message: "Artikel nicht gefunden" });
    }
  });

  app.delete("/api/articles/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteArticle(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Artikel nicht gefunden" });
    }
  });

  app.post("/api/articles/import-pdf", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Keine Datei hochgeladen" });

      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
      await parser.load();
      const pdfResult = await parser.getText();
      const pdfText = pdfResult.text || '';
      await parser.destroy();

      if (!pdfText || pdfText.trim().length < 20) {
        return res.status(400).json({ message: "PDF enthält keinen lesbaren Text" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Du bist ein Experte für die Analyse von Artikellisten aus Containerdienst-Software.

Extrahiere alle Artikel aus dem Text. Jeder Artikel hat:
- articleNumber: Die Artikelnummer (z.B. "170904/M³", "111111/B", "33336")
- name: Die Bezeichnung (z.B. "Baumisch", "Transport", "Schottertragschicht 0-32")
- unit: Die Einheit. Erkenne aus dem Stückmaß: "m³" für Kubikmeter, "t" für Tonnen, "Stück" für Stück, "Std" für Stunden. Wenn z.B. "1,00 m³" steht, ist die Einheit "m³". Wenn "1,00 t" steht, ist die Einheit "t".
- category: Kategorisiere den Artikel:
  - "entsorgung" = Abfallarten mit AVV-Nummer (170xxx, 200xxx, 150xxx)
  - "service" = Dienstleistungen (Transport, Gestellung, Wartezeit, Stundenlohn, Sortiertätigkeit)
  - "lieferung" = Materiallieferungen (Sande, Kiese, Schotter, Splitt - 33xxx, 44xxx Nummern)
  - "zuschlag" = Zuschläge und Gebühren (BEHG, EANV)
- avvNumber: Die AVV-Nummer falls erkennbar (die ersten 6 Ziffern der Artikelnummer wenn sie mit 1xxxxx oder 2xxxxx beginnt), sonst null

Antworte NUR mit einem JSON-Array:
[
  { "articleNumber": "170904/M³", "name": "Baumisch", "unit": "m³", "category": "entsorgung", "avvNumber": "170904" },
  { "articleNumber": "111111/B", "name": "Transport", "unit": "Stück", "category": "service", "avvNumber": null }
]`
          },
          { role: "user", content: pdfText.substring(0, 15000) }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return res.status(400).json({ message: "KI konnte keine Artikel erkennen" });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return res.status(400).json({ message: "Keine Artikel im Dokument erkannt" });
      }

      if (req.query.confirm === 'true') {
        let created = 0;
        let updated = 0;
        for (const a of parsed) {
          try {
            const existing = (await storage.getArticles()).find(ex => ex.articleNumber === a.articleNumber);
            if (existing) {
              await storage.updateArticle(existing.id, {
                name: a.name,
                unit: a.unit || 't',
                category: a.category || 'entsorgung',
                avvNumber: a.avvNumber || null,
              });
              updated++;
            } else {
              await storage.createArticle({
                articleNumber: a.articleNumber,
                name: a.name,
                unit: a.unit || 't',
                category: a.category || 'entsorgung',
                avvNumber: a.avvNumber || null,
              });
              created++;
            }
          } catch (e) {
            console.error('Article import error for:', a.articleNumber, e);
          }
        }
        return res.json({ message: `${created} Artikel erstellt, ${updated} aktualisiert`, created, updated });
      }

      res.json({ preview: parsed, fileName: req.file.originalname });
    } catch (err) {
      console.error("Article PDF import error:", err);
      res.status(500).json({ message: "Fehler beim Artikel-Import" });
    }
  });

  app.post("/api/articles/confirm-import", requireAuth, async (req, res) => {
    try {
      const { preview } = req.body;
      if (!Array.isArray(preview) || preview.length === 0) {
        return res.status(400).json({ message: "Keine Vorschaudaten" });
      }

      let created = 0;
      let updated = 0;
      const existingArticles = await storage.getArticles();

      for (const a of preview) {
        try {
          const existing = existingArticles.find(ex => ex.articleNumber === a.articleNumber);
          if (existing) {
            await storage.updateArticle(existing.id, {
              name: a.name,
              unit: a.unit || 't',
              category: a.category || 'entsorgung',
              avvNumber: a.avvNumber || null,
            });
            updated++;
          } else {
            await storage.createArticle({
              articleNumber: a.articleNumber,
              name: a.name,
              unit: a.unit || 't',
              category: a.category || 'entsorgung',
              avvNumber: a.avvNumber || null,
            });
            created++;
          }
        } catch (e) {
          console.error('Article confirm-import error for:', a.articleNumber, e);
        }
      }

      res.json({ message: `${created} Artikel erstellt, ${updated} aktualisiert`, created, updated });
    } catch (err) {
      console.error("Article confirm import error:", err);
      res.status(500).json({ message: "Fehler beim Speichern" });
    }
  });

  // Trips
  app.get(api.trips.list.path, async (req, res) => {
    const trips = await storage.getTrips();
    res.json(trips);
  });

  app.post(api.trips.create.path, async (req, res) => {
    try {
      const input = api.trips.create.input.parse(req.body);
      const trip = await storage.createTrip(input);
      res.status(201).json(trip);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.trips.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.trips.update.input.parse(req.body);
      const trip = await storage.updateTrip(id, input);
      res.json(trip);
    } catch (err) {
      res.status(404).json({ message: "Fahrt nicht gefunden" });
    }
  });

  app.delete(api.trips.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTrip(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Fahrt nicht gefunden" });
    }
  });

  app.delete('/api/trips', async (req, res) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const count = await storage.deleteTrips(from || null, to || null);
      const label = from && to ? `${count} Fahrten im Zeitraum gelöscht` : `${count} Fahrten gelöscht`;
      res.json({ message: label, count });
    } catch (err) {
      console.error("Error deleting trips:", err);
      res.status(500).json({ message: "Fehler beim Löschen" });
    }
  });

  // Loans (Darlehen)
  app.get(api.loans.list.path, async (req, res) => {
    const loans = await storage.getLoans();
    res.json(loans);
  });

  app.post(api.loans.create.path, async (req, res) => {
    try {
      const input = api.loans.create.input.parse(req.body);
      const loan = await storage.createLoan(input);
      res.status(201).json(loan);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.loans.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.loans.update.input.parse(req.body);
      const loan = await storage.updateLoan(id, input);
      res.json(loan);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Darlehen nicht gefunden" });
    }
  });

  app.delete(api.loans.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLoan(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Darlehen nicht gefunden" });
    }
  });

  // Loan Payments (Darlehen-Zahlungen)
  app.get(api.loanPayments.list.path, async (req, res) => {
    const loanId = parseInt(req.params.loanId);
    const payments = await storage.getLoanPayments(loanId);
    res.json(payments);
  });

  app.get(api.loanPayments.listAll.path, async (req, res) => {
    const payments = await storage.getAllLoanPayments();
    res.json(payments);
  });

  app.post(api.loanPayments.create.path, async (req, res) => {
    try {
      const input = api.loanPayments.create.input.parse(req.body);
      const payment = await storage.createLoanPayment(input);
      res.status(201).json(payment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.loanPayments.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.loanPayments.update.input.parse(req.body);
      const payment = await storage.updateLoanPayment(id, input);
      res.json(payment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Zahlung nicht gefunden" });
    }
  });

  app.delete(api.loanPayments.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLoanPayment(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Zahlung nicht gefunden" });
    }
  });

  // Customers
  app.get(api.customers.list.path, async (req, res) => {
    const customers = await storage.getCustomers();
    res.json(customers);
  });

  app.post(api.customers.create.path, async (req, res) => {
    try {
      const input = api.customers.create.input.parse(req.body);
      const customer = await storage.createCustomer(input);
      res.status(201).json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.customers.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.customers.update.input.parse(req.body);
      const customer = await storage.updateCustomer(id, input);
      res.json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Kunde nicht gefunden" });
    }
  });

  app.delete(api.customers.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomer(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Kunde nicht gefunden" });
    }
  });

  // Seed Data Endpoint
  app.post("/api/seed", async (req, res) => {
    const materials = await storage.getMaterials();
    if (materials.length === 0) {
      await storage.createMaterial({ name: "Bauschutt (rein)", density: "1.5", disposalCostPerTonne: "15.00" });
      await storage.createMaterial({ name: "Baumischabfall", density: "0.8", disposalCostPerTonne: "185.00" });
      await storage.createMaterial({ name: "Holz (A1-A3)", density: "0.3", disposalCostPerTonne: "60.00" });
      await storage.createMaterial({ name: "Boden / Erde", density: "1.8", disposalCostPerTonne: "12.00" });
      await storage.createMaterial({ name: "Gartenabfall / Grünschnitt", density: "0.4", disposalCostPerTonne: "45.00" });
      await storage.createMaterial({ name: "Sperrmüll", density: "0.25", disposalCostPerTonne: "220.00" });
    }
    
    // Check and add missing cost variables
    const costVars = await storage.getCostVariables();
    const existingNames = costVars.map(v => v.name);
    
    const requiredCostVars = [
      { category: "fuel", name: "Diesel Preis", value: "1.70", unit: "per_liter", description: "Aktueller Tankstellenpreis" },
      { category: "fuel", name: "Verbrauch (L/100km)", value: "30", unit: "fixed", description: "Durchschnittsverbrauch LKW" },
      { category: "fuel", name: "Kraftstoff (Schätzung)", value: "2000", unit: "per_month", description: "Geschätzter monatlicher Kraftstoffverbrauch" },
      { category: "overhead", name: "Maut / Gebühren", value: "0.19", unit: "per_km", description: "LKW-Maut pro Kilometer" },
      { category: "overhead", name: "Maut (Schätzung)", value: "500", unit: "per_month", description: "Geschätzte monatliche Mautkosten" },
      { category: "accountant", name: "Steuerberater Pauschale", value: "500", unit: "per_month", description: "Monatliche Steuerberatung" },
      { category: "accountant", name: "Buchhaltung Software", value: "400", unit: "per_month", description: "Monatliche Rate für Buchhaltung" },
      { category: "accountant", name: "Lohnabrechnung", value: "0", unit: "per_month", description: "Monatliche Kosten für Lohnabrechnung" },
      { category: "admin", name: "Bürokosten", value: "300", unit: "per_month", description: "Miete, Strom, Internet" },
    ];
    
    for (const cv of requiredCostVars) {
      if (!existingNames.includes(cv.name)) {
        await storage.createCostVariable(cv);
      }
    }
    
    const vehiclesData = await storage.getVehicles();
    if (vehiclesData.length === 0) {
      await storage.createVehicle({ name: "MAN TGS 26.400", type: "lkw", licensePlate: "HH-RI 123", monthlyLeaseCost: "1200", monthlyInsurance: "350", monthlyMaintenance: "500", fuelConsumption: "30" });
      await storage.createVehicle({ name: "Anhänger 1", type: "anhaenger", licensePlate: "HH-RI 124", monthlyLeaseCost: "0", monthlyInsurance: "80", monthlyMaintenance: "50", fuelConsumption: "0" });
    }
    
    const employeesData = await storage.getEmployees();
    if (employeesData.length === 0) {
      await storage.createEmployee({ name: "Geschäftsführer", role: "geschaeftsfuehrer", monthlySalary: "3500", workHoursPerWeek: "50" });
    }

    res.json({ message: "Datenbank wurde mit Beispieldaten befüllt" });
  });

  // Auth Routes
  const registerSchema = z.object({
    username: z.string().min(3, "Benutzername muss mindestens 3 Zeichen haben").max(30, "Benutzername darf maximal 30 Zeichen haben").regex(/^[a-zA-Z0-9_-]+$/, "Nur Buchstaben, Zahlen, - und _ erlaubt"),
    email: z.string().email("Ungültige E-Mail-Adresse"),
    password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
    name: z.string().min(2, "Name muss mindestens 2 Zeichen haben"),
  });

  const loginSchema = z.object({
    identifier: z.string().min(1, "Benutzername oder E-Mail erforderlich"),
    password: z.string().min(1, "Passwort erforderlich"),
    rememberMe: z.boolean().optional().default(false),
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      
      const existingEmail = await storage.getUserByEmail(input.email);
      if (existingEmail) {
        return res.status(400).json({ message: "E-Mail-Adresse bereits registriert" });
      }
      
      const existingUsername = await storage.getUserByUsername(input.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Benutzername bereits vergeben" });
      }
      
      const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
      const usersCount = await storage.getUsersCount();
      const role = usersCount === 0 ? "admin" : "mitarbeiter";
      
      const user = await storage.createUser({
        username: input.username,
        email: input.email,
        password: hashedPassword,
        name: input.name,
        role,
      });
      
      // Generate verification token and send email
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await storage.updateUserVerificationToken(user.id, verificationToken, expiry);
      
      // Send verification email
      await sendVerificationEmail(input.email, verificationToken, input.name);
      
      // Don't log in user - they need to verify email first
      res.status(201).json({
        message: "Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail-Adresse.",
        requiresVerification: true,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token erforderlich" });
      }
      
      const user = await storage.getUserByVerificationToken(token);
      if (!user || !user.verificationTokenExpiry || new Date() > user.verificationTokenExpiry) {
        return res.status(400).json({ message: "Ungültiger oder abgelaufener Verifizierungslink" });
      }
      
      await storage.verifyUserEmail(user.id);
      
      res.json({ message: "E-Mail-Adresse erfolgreich bestätigt! Sie können sich jetzt anmelden." });
    } catch (err) {
      console.error("Email verification error:", err);
      res.status(500).json({ message: "Fehler bei der Verifizierung" });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "Falls ein Konto existiert, wurde eine E-Mail gesendet" });
      }
      
      if (user.emailVerified) {
        return res.status(400).json({ message: "E-Mail-Adresse bereits bestätigt" });
      }
      
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await storage.updateUserVerificationToken(user.id, verificationToken, expiry);
      
      await sendVerificationEmail(email, verificationToken, user.name);
      
      res.json({ message: "Bestätigungsmail wurde erneut gesendet" });
    } catch (err) {
      console.error("Resend verification error:", err);
      res.status(500).json({ message: "Fehler beim Senden" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      
      // Check if identifier is email or username
      const isEmail = input.identifier.includes("@");
      const user = isEmail 
        ? await storage.getUserByEmail(input.identifier)
        : await storage.getUserByUsername(input.identifier);
      
      if (!user) {
        return res.status(401).json({ message: "Ungültige Anmeldedaten" });
      }
      
      const validPassword = await bcrypt.compare(input.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Ungültige Anmeldedaten" });
      }
      
      // Check if email is verified
      if (!user.emailVerified) {
        return res.status(403).json({ 
          message: "E-Mail-Adresse noch nicht bestätigt. Bitte überprüfen Sie Ihr Postfach.",
          requiresVerification: true,
          email: user.email
        });
      }
      
      req.session.userId = user.id;
      
      // Extend session to 30 days if "remember me" is checked
      if (input.rememberMe && req.session.cookie) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Sitzungsfehler" });
        }
        res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
        });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Abmeldung fehlgeschlagen" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Erfolgreich abgemeldet" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Nicht angemeldet" });
    }
    
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Benutzer nicht gefunden" });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  });

  // User Management (Admin only)
  app.get("/api/users", requireAuth, async (req, res) => {
    const currentUser = await storage.getUserById(req.session.userId!);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Keine Berechtigung" });
    }
    
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
    })));
  });

  // Create user (Admin only)
  app.post("/api/users", requireAuth, async (req, res) => {
    const currentUser = await storage.getUserById(req.session.userId!);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Keine Berechtigung" });
    }
    
    const { username, email, name, password, role } = req.body;
    
    // Validate required fields
    if (!username || !email || !name || !password) {
      return res.status(400).json({ message: "Alle Felder sind erforderlich" });
    }
    
    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3 || username.length > 30) {
      return res.status(400).json({ message: "Benutzername ungültig (3-30 Zeichen, nur Buchstaben, Zahlen, - und _)" });
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Ungültige E-Mail-Adresse" });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: "Passwort muss mindestens 6 Zeichen haben" });
    }
    
    // Validate role
    const validRoles = ["admin", "manager", "mitarbeiter"];
    const userRole = role && validRoles.includes(role) ? role : "mitarbeiter";
    
    // Check if username is already taken
    const existingUsername = await storage.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ message: "Benutzername bereits vergeben" });
    }
    
    // Check if email is already taken
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: "E-Mail-Adresse bereits registriert" });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create user (auto-verified since created by admin)
    const newUser = await storage.createUser({
      username,
      email,
      password: hashedPassword,
      name,
      role: userRole,
      emailVerified: true, // Admin-created users are auto-verified
    });
    
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      createdAt: newUser.createdAt,
    });
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUserById(req.session.userId!);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Keine Berechtigung" });
    }
    
    const userId = parseInt(req.params.id);
    const { username, name, role, password } = req.body;
    
    const updates: { username?: string; name?: string; role?: string; password?: string } = {};
    
    if (username) {
      // Validate username format
      if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3 || username.length > 30) {
        return res.status(400).json({ message: "Benutzername ungültig (3-30 Zeichen, nur Buchstaben, Zahlen, - und _)" });
      }
      // Check if username is already taken by another user
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: "Benutzername bereits vergeben" });
      }
      updates.username = username;
    }
    if (name) updates.name = name;
    if (role && ["admin", "manager", "mitarbeiter"].includes(role)) {
      updates.role = role;
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: "Passwort muss mindestens 6 Zeichen haben" });
      }
      updates.password = await bcrypt.hash(password, SALT_ROUNDS);
    }
    
    const updated = await storage.updateUser(userId, updates);
    if (!updated) {
      return res.status(404).json({ message: "Benutzer nicht gefunden" });
    }
    
    res.json({
      id: updated.id,
      username: updated.username,
      email: updated.email,
      name: updated.name,
      role: updated.role,
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "Falls ein Konto existiert, wurde eine E-Mail gesendet" });
      }
      
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      await storage.updateUserResetToken(user.id, resetToken, expiry);
      
      // Send password reset email via Resend
      const emailSent = await sendPasswordResetEmail(email, resetToken, user.username || user.name);
      
      if (emailSent) {
        res.json({ message: "Eine E-Mail mit Anweisungen zum Zurücksetzen wurde gesendet" });
      } else {
        console.error("Email sending failed, but token was generated");
        res.json({ message: "Falls ein Konto existiert, wurde eine E-Mail gesendet" });
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      res.status(500).json({ message: "Fehler beim Zurücksetzen" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token und Passwort erforderlich" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Passwort muss mindestens 6 Zeichen haben" });
      }
      
      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        return res.status(400).json({ message: "Ungültiger oder abgelaufener Token" });
      }
      
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      await storage.updateUserPassword(user.id, hashedPassword);
      
      res.json({ message: "Passwort erfolgreich geändert" });
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Zurücksetzen" });
    }
  });

  app.get("/api/auth/check-users", async (req, res) => {
    const count = await storage.getUsersCount();
    res.json({ hasUsers: count > 0 });
  });

  // Market Prices
  app.get("/api/market-prices", requireAuth, async (req, res) => {
    try {
      const prices = await storage.getMarketPrices();
      res.json(prices);
    } catch (err) {
      console.error("Error fetching market prices:", err);
      res.status(500).json({ message: "Fehler beim Laden der Marktpreise" });
    }
  });

  app.get("/api/market-prices/compare", requireAuth, async (req, res) => {
    try {
      const { material, containerSize } = req.query;
      if (!material || !containerSize) {
        return res.status(400).json({ message: "Material und Container-Größe erforderlich" });
      }
      const prices = await storage.getMarketPricesForMaterial(
        material as string, 
        parseInt(containerSize as string)
      );
      res.json(prices);
    } catch (err) {
      console.error("Error fetching market comparison:", err);
      res.status(500).json({ message: "Fehler beim Laden der Vergleichspreise" });
    }
  });

  app.post("/api/market-prices/refresh", requireAuth, async (req, res) => {
    try {
      const result = await refreshAllMarketPrices();
      const updatedPrices = await storage.getMarketPrices();
      res.json({
        success: true,
        message: `Marktpreise aktualisiert: ${result.buhck} BUHCK, ${result.junkbusters} Junkbusters, ${result.web} Web-Recherche, ${result.ai} KI-Schätzungen`,
        count: result.total,
        sources: { buhck: result.buhck, junkbusters: result.junkbusters, web: result.web, ai: result.ai },
        disclaimer: "Preise basieren auf BUHCK Hamburg, Junkbusters Hamburg, echte Web-Recherche und KI-Schätzungen",
        prices: updatedPrices,
      });
    } catch (err) {
      console.error("Error refreshing market prices:", err);
      res.status(500).json({ message: "Fehler beim Aktualisieren der Marktpreise" });
    }
  });

  // Sales Prices (eigene Verkaufspreise)
  app.get(api.salesPrices.list.path, requireAuth, async (req, res) => {
    const prices = await storage.getSalesPrices();
    res.json(prices);
  });

  app.post(api.salesPrices.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.salesPrices.create.input.parse(req.body);
      const price = await storage.createSalesPrice(input);
      res.status(201).json(price);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.salesPrices.update.path, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { confirmLargeChange, ...bodyWithoutFlag } = req.body;
      const input = api.salesPrices.update.input.parse(bodyWithoutFlag);

      if (!confirmLargeChange) {
        const existing = await storage.getSalesPrices();
        const current = existing.find(p => p.id === id);
        if (current) {
          const THRESHOLD = 0.25;
          const warnings: string[] = [];
          const checkField = (fieldName: string, label: string, oldVal: string | null | undefined, newVal: string | null | undefined) => {
            if (newVal == null || oldVal == null) return;
            const oldNum = parseFloat(oldVal);
            const newNum = parseFloat(newVal);
            if (oldNum > 0 && newNum > 0) {
              const change = Math.abs(newNum - oldNum) / oldNum;
              if (change >= THRESHOLD) {
                const direction = newNum < oldNum ? 'sinkt' : 'steigt';
                const pct = Math.round(change * 100);
                warnings.push(`${label} ${direction} um ${pct}%: ${oldNum.toFixed(2).replace('.', ',')} € → ${newNum.toFixed(2).replace('.', ',')} €`);
              }
            }
          };
          checkField('pricePerTonne', 'Preis/Tonne', current.pricePerTonne, input.pricePerTonne);
          checkField('pricePerCubicMeter', 'Preis/m³', current.pricePerCubicMeter, input.pricePerCubicMeter);
          checkField('behgSurcharge', 'BEHG-Zuschlag', current.behgSurcharge, input.behgSurcharge);
          if (warnings.length > 0) {
            return res.status(409).json({
              requireConfirmation: true,
              materialName: current.materialName,
              warnings,
              message: `Große Preisänderung bei "${current.materialName}": ${warnings.join('; ')}. Bitte bestätigen.`,
            });
          }
        }
      }

      const price = await storage.updateSalesPrice(id, input);
      if (!price) {
        return res.status(404).json({ message: "Verkaufspreis nicht gefunden" });
      }
      res.json(price);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Verkaufspreis nicht gefunden" });
    }
  });

  app.delete(api.salesPrices.delete.path, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSalesPrice(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Verkaufspreis nicht gefunden" });
    }
  });

  // Sales Surcharges (Verkaufs-Zuschläge)
  app.get('/api/sales-surcharges', async (_req, res) => {
    const surcharges = await storage.getSalesSurcharges();
    res.json(surcharges);
  });

  app.post('/api/sales-surcharges', requireAuth, async (req, res) => {
    try {
      const { insertSalesSurchargeSchema } = await import("@shared/schema");
      const input = insertSalesSurchargeSchema.parse(req.body);
      const surcharge = await storage.createSalesSurcharge(input);
      res.status(201).json(surcharge);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Fehler beim Erstellen" });
    }
  });

  app.put('/api/sales-surcharges/:id', requireAuth, async (req, res) => {
    try {
      const { insertSalesSurchargeSchema } = await import("@shared/schema");
      const id = parseInt(req.params.id);
      const input = insertSalesSurchargeSchema.partial().parse(req.body);
      const surcharge = await storage.updateSalesSurcharge(id, input);
      res.json(surcharge);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Fehler beim Aktualisieren" });
    }
  });

  app.delete('/api/sales-surcharges/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allPrices = await storage.getSalesPrices();
      for (const sp of allPrices) {
        if (sp.salesSurchargeIds?.includes(id)) {
          const newIds = sp.salesSurchargeIds.filter(sid => sid !== id);
          await storage.updateSalesPrice(sp.id, { salesSurchargeIds: newIds });
        }
      }
      await storage.deleteSalesSurcharge(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Zuschlag nicht gefunden" });
    }
  });

  // Sales Fixed Prices (Pauschalen)
  app.get(api.salesFixedPrices.list.path, requireAuth, async (req, res) => {
    const prices = await storage.getSalesFixedPrices();
    res.json(prices);
  });

  app.post(api.salesFixedPrices.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.salesFixedPrices.create.input.parse(req.body);
      const price = await storage.createSalesFixedPrice(input);
      res.status(201).json(price);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.salesFixedPrices.update.path, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.salesFixedPrices.update.input.parse(req.body);
      const price = await storage.updateSalesFixedPrice(id, input);
      if (!price) {
        return res.status(404).json({ message: "Fixpreis nicht gefunden" });
      }
      res.json(price);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Fixpreis nicht gefunden" });
    }
  });

  app.delete(api.salesFixedPrices.delete.path, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSalesFixedPrice(id);
      res.status(204).send();
    } catch (err) {
      res.status(404).json({ message: "Fixpreis nicht gefunden" });
    }
  });

  // Send price calculation email (admin only)
  app.post("/api/send-price-calculation", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        to: z.string().email(),
        materialName: z.string(),
        avvCode: z.string(),
        containerSize: z.number(),
        weightT: z.number(),
        volumeM3: z.number(),
        pricePerTonne: z.number(),
        materialCostTonne: z.number(),
        containerPickup: z.number(),
        totalNettTonne: z.number(),
        totalBruttoTonne: z.number(),
        pricePerM3: z.number(),
        materialCostM3: z.number(),
        totalNettM3: z.number(),
        totalBruttoM3: z.number(),
        surchargeLinesTonne: z.array(z.object({ name: z.string(), total: z.number() })).optional(),
        surchargeLinesCubic: z.array(z.object({ name: z.string(), total: z.number() })).optional(),
      });
      
      const data = schema.parse(req.body);
      const success = await sendPriceCalculationEmail(data);
      
      if (success) {
        res.json({ message: "E-Mail gesendet" });
      } else {
        res.status(500).json({ message: "E-Mail konnte nicht gesendet werden" });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Fehler beim Senden der E-Mail" });
    }
  });

  // PDF Upload for Sales Prices - parse with OpenAI
  app.post("/api/sales-prices/import-pdf", requireAuth, upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Keine PDF-Datei hochgeladen" });
      }

      const { PDFParse: PDFParseClass } = await import('pdf-parse');
      const parser = new PDFParseClass({ data: new Uint8Array(req.file.buffer) });
      await parser.load();
      const pdfResultSP = await parser.getText();
      const pdfText = pdfResultSP.text || '';
      await parser.destroy();

      // Use OpenAI to extract prices from PDF
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Du bist ein Experte für deutsche Abfallwirtschaft und Preislisten. Extrahiere alle Materialpreise aus der Preisliste.

Für jeden Preis extrahiere:
- avvCode: Die 6-stellige AVV-Nummer (Abfallverzeichnis-Verordnung), z.B. "170201"
- materialName: Der Name des Materials, z.B. "Baumischabfall"
- pricePerTonne: Preis pro Tonne in Euro (nur Zahl, z.B. 195.00)
- pricePerCubicMeter: Preis pro Kubikmeter in Euro (nur Zahl, kann null sein)
- behgSurcharge: BEHG-Zuschlag/CO2-Zuschlag pro Tonne (nur Zahl, 0 wenn nicht angegeben)
- isDangerous: true wenn gefährlicher Abfall (meist mit * markiert), sonst false

Antworte NUR mit einem JSON-Array. Beispiel:
[
  {"avvCode": "170904", "materialName": "Baumischabfall", "pricePerTonne": 195.00, "pricePerCubicMeter": 78.00, "behgSurcharge": 39.50, "isDangerous": false},
  {"avvCode": "170201", "materialName": "Holz unbehandelt A1-A3", "pricePerTonne": 71.50, "pricePerCubicMeter": 43.30, "behgSurcharge": 0, "isDangerous": false}
]

Wenn keine Preise gefunden werden, antworte mit [].`
          },
          {
            role: "user",
            content: `Extrahiere alle Materialpreise aus dieser Preisliste:\n\n${pdfText.substring(0, 15000)}`
          }
        ],
        temperature: 0.1,
        max_completion_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content || "[]";
      
      // Parse JSON from response
      let extractedPrices: Array<{
        avvCode: string;
        materialName: string;
        pricePerTonne: number | null;
        pricePerCubicMeter: number | null;
        behgSurcharge: number;
        isDangerous: boolean;
      }> = [];
      
      try {
        // Try to extract JSON from response (might be wrapped in markdown)
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedPrices = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.error("Failed to parse OpenAI response:", content);
        return res.status(500).json({ message: "Fehler beim Parsen der Preise" });
      }

      if (extractedPrices.length === 0) {
        return res.status(400).json({ message: "Keine Preise in der PDF gefunden" });
      }

      // Import prices to database
      let imported = 0;
      let updated = 0;
      
      for (const price of extractedPrices) {
        if (!price.avvCode || !price.materialName) continue;
        
        // Check if price already exists by AVV code
        const existing = await storage.getSalesPriceByAvv(price.avvCode);
        
        if (existing) {
          // Merge: only update fields that have values in the new PDF, keep existing values for empty fields
          const mergedData = {
            avvCode: price.avvCode,
            materialName: price.materialName || existing.materialName,
            pricePerTonne: price.pricePerTonne ? String(price.pricePerTonne) : existing.pricePerTonne,
            pricePerCubicMeter: price.pricePerCubicMeter ? String(price.pricePerCubicMeter) : existing.pricePerCubicMeter,
            behgSurcharge: price.behgSurcharge ? String(price.behgSurcharge) : existing.behgSurcharge,
            isDangerous: price.isDangerous !== undefined ? price.isDangerous : existing.isDangerous,
            isActive: existing.isActive,
            validFrom: existing.validFrom,
            notes: existing.notes,
          };
          await storage.updateSalesPrice(existing.id, mergedData);
          updated++;
        } else {
          // Create new price
          const priceData = {
            avvCode: price.avvCode,
            materialName: price.materialName,
            pricePerTonne: price.pricePerTonne ? String(price.pricePerTonne) : null,
            pricePerCubicMeter: price.pricePerCubicMeter ? String(price.pricePerCubicMeter) : null,
            behgSurcharge: String(price.behgSurcharge || 0),
            isDangerous: price.isDangerous || false,
            isActive: true,
            validFrom: null,
            notes: null,
          };
          await storage.createSalesPrice(priceData);
          imported++;
        }
      }

      res.json({ 
        message: `${imported} Preise importiert, ${updated} aktualisiert`,
        imported,
        updated,
        total: extractedPrices.length
      });
    } catch (err) {
      console.error("PDF import error:", err);
      res.status(500).json({ message: "Fehler beim Import der PDF" });
    }
  });

  // Comprehensive Report
  app.get("/api/report/data", requireAuth, async (req, res) => {
    try {
      const distance = Number(req.query.distance) || 15;
      const data = await generateReportData(distance);
      res.json(data);
    } catch (err) {
      console.error("Report data error:", err);
      res.status(500).json({ message: "Fehler beim Generieren des Berichts" });
    }
  });

  app.get("/api/report/html", requireAuth, async (req, res) => {
    try {
      const distance = Number(req.query.distance) || 15;
      const data = await generateReportData(distance);
      const html = generateReportHTML(data);
      res.type('html').send(html);
    } catch (err) {
      console.error("Report HTML error:", err);
      res.status(500).json({ message: "Fehler beim Generieren des Berichts" });
    }
  });

  app.post("/api/report/send-email", requireAuth, async (req, res) => {
    try {
      const { email, distance } = req.body;
      if (!email) return res.status(400).json({ message: "E-Mail-Adresse erforderlich" });
      const data = await generateReportData(distance || 15);
      const html = generateReportHTML(data);
      const success = await sendReportEmail(email, html, data.generatedAt);
      if (success) {
        res.json({ message: "Bericht wurde per E-Mail versendet" });
      } else {
        res.status(500).json({ message: "E-Mail konnte nicht gesendet werden" });
      }
    } catch (err) {
      console.error("Report email error:", err);
      res.status(500).json({ message: "Fehler beim Versenden des Berichts" });
    }
  });

  // Annual Report
  app.get("/api/report/annual/data", requireAuth, async (req, res) => {
    try {
      const distance = Number(req.query.distance) || 15;
      const data = await generateAnnualReportData(distance);
      res.json(data);
    } catch (err) {
      console.error("Annual report data error:", err);
      res.status(500).json({ message: "Fehler beim Generieren des Jahresberichts" });
    }
  });

  app.get("/api/report/annual/html", requireAuth, async (req, res) => {
    try {
      const distance = Number(req.query.distance) || 15;
      const data = await generateAnnualReportData(distance);
      const html = generateAnnualReportHTML(data);
      res.type('html').send(html);
    } catch (err) {
      console.error("Annual report HTML error:", err);
      res.status(500).json({ message: "Fehler beim Generieren des Jahresberichts" });
    }
  });

  app.post("/api/report/annual/send-email", requireAuth, async (req, res) => {
    try {
      const { email, distance } = req.body;
      if (!email) return res.status(400).json({ message: "E-Mail-Adresse erforderlich" });
      const data = await generateAnnualReportData(distance || 15);
      const html = generateAnnualReportHTML(data);
      const success = await sendReportEmail(email, html, `Realistische Jahresplanung ${data.year} – Wachstumsmodell (BWA-basiert) – ${data.generatedAt}`);
      if (success) {
        res.json({ message: "Jahresbericht wurde per E-Mail versendet" });
      } else {
        res.status(500).json({ message: "E-Mail konnte nicht gesendet werden" });
      }
    } catch (err) {
      console.error("Annual report email error:", err);
      res.status(500).json({ message: "Fehler beim Versenden des Jahresberichts" });
    }
  });

  // ==================== FORECAST CENTER API ====================

  app.get("/api/forecast/annual-report", requireAuth, async (_req, res) => {
    try {
      const data = await generateAnnualReportData();
      res.json(data);
    } catch (err) {
      console.error("Forecast annual report error:", err);
      res.status(500).json({ message: "Fehler beim Berechnen der Jahresprognose" });
    }
  });

  app.get("/api/forecast/defaults", requireAuth, async (_req, res) => {
    try {
      res.json(await getDefaultForecastParamsFromDB());
    } catch (err) {
      console.error("Forecast defaults error:", err);
      res.status(500).json({ message: "Fehler beim Laden der Standard-Parameter" });
    }
  });

  app.post("/api/forecast/calculate", requireAuth, async (req, res) => {
    try {
      const parsed = forecastParamsSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ungültige Parameter", errors: parsed.error.flatten() });
      }
      const data = await generateAnnualReportData(parsed.data?.distance || 15, parsed.data);
      res.json(data);
    } catch (err) {
      console.error("Forecast calculate error:", err);
      res.status(500).json({ message: "Fehler bei der Prognose-Berechnung" });
    }
  });

  app.post("/api/forecast/csv", requireAuth, async (req, res) => {
    try {
      const parsed = forecastParamsSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ungültige Parameter" });
      }
      const data = await generateAnnualReportData(parsed.data?.distance || 15, parsed.data);
      const csv = generateAnnualReportCSV(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="Jahresplanung_${data.year}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (err) {
      console.error("Forecast CSV error:", err);
      res.status(500).json({ message: "Fehler beim CSV-Export" });
    }
  });

  app.post("/api/forecast/email", requireAuth, async (req, res) => {
    try {
      const { email, params: forecastParams } = req.body;
      if (!email) return res.status(400).json({ message: "E-Mail-Adresse erforderlich" });
      const parsed = forecastParamsSchema.partial().safeParse(forecastParams || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Ungültige Parameter" });
      }
      const data = await generateAnnualReportData(parsed.data?.distance || 15, parsed.data);
      const html = generateAnnualReportHTML(data);
      const success = await sendReportEmail(email, html, `Prognose ${data.year} – Rieprecht GmbH – ${data.generatedAt}`);
      if (success) {
        res.json({ message: "Prognose wurde per E-Mail versendet" });
      } else {
        res.status(500).json({ message: "E-Mail konnte nicht gesendet werden" });
      }
    } catch (err) {
      console.error("Forecast email error:", err);
      res.status(500).json({ message: "Fehler beim Versenden der Prognose" });
    }
  });

  // Forecast Scenarios CRUD
  app.get("/api/forecast/scenarios", requireAuth, async (_req, res) => {
    try {
      const scenarios = await storage.getForecastScenarios();
      res.json(scenarios);
    } catch (err) {
      console.error("Get scenarios error:", err);
      res.status(500).json({ message: "Fehler beim Laden der Szenarien" });
    }
  });

  app.get("/api/forecast/scenarios/:id", requireAuth, async (req, res) => {
    try {
      const scenario = await storage.getForecastScenario(Number(req.params.id));
      if (!scenario) return res.status(404).json({ message: "Szenario nicht gefunden" });
      res.json(scenario);
    } catch (err) {
      console.error("Get scenario error:", err);
      res.status(500).json({ message: "Fehler beim Laden des Szenarios" });
    }
  });

  app.post("/api/forecast/scenarios", requireAuth, async (req, res) => {
    try {
      const { name, description, params } = req.body;
      if (!name) return res.status(400).json({ message: "Name erforderlich" });
      const scenario = await storage.createForecastScenario({
        name,
        description: description || null,
        params: params || getDefaultForecastParams(),
        isDefault: false,
        createdBy: req.session.userId || null,
      });
      res.json(scenario);
    } catch (err) {
      console.error("Create scenario error:", err);
      res.status(500).json({ message: "Fehler beim Erstellen des Szenarios" });
    }
  });

  app.patch("/api/forecast/scenarios/:id", requireAuth, async (req, res) => {
    try {
      const { name, description, params } = req.body;
      const updated = await storage.updateForecastScenario(Number(req.params.id), {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(params !== undefined && { params }),
      });
      res.json(updated);
    } catch (err) {
      console.error("Update scenario error:", err);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Szenarios" });
    }
  });

  app.delete("/api/forecast/scenarios/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteForecastScenario(Number(req.params.id));
      res.json({ message: "Szenario gelöscht" });
    } catch (err) {
      console.error("Delete scenario error:", err);
      res.status(500).json({ message: "Fehler beim Löschen des Szenarios" });
    }
  });

  // ==================== SAVED PLANS API ====================

  app.get("/api/plans/active", requireAuth, async (_req, res) => {
    try {
      const [plan] = await db.select().from(savedPlans).where(eq(savedPlans.isActive, true)).orderBy(desc(savedPlans.createdAt)).limit(1);
      res.json(plan || null);
    } catch (err) {
      console.error("Get active plan error:", err);
      res.status(500).json({ message: "Fehler beim Laden des Plans" });
    }
  });

  app.post("/api/plans/activate", requireAuth, async (req, res) => {
    try {
      const { name, scenario, year, monthlyData, params: planParams } = req.body;
      if (!name || !scenario || !year || !monthlyData) {
        return res.status(400).json({ message: "Name, Szenario, Jahr und Monatsdaten sind erforderlich" });
      }
      await db.update(savedPlans).set({ isActive: false }).where(eq(savedPlans.isActive, true));
      const [newPlan] = await db.insert(savedPlans).values({
        name,
        scenario,
        year,
        monthlyData,
        params: planParams,
        createdBy: (req as any).user?.id || null,
        isActive: true,
      }).returning();
      res.json(newPlan);
    } catch (err) {
      console.error("Activate plan error:", err);
      res.status(500).json({ message: "Fehler beim Speichern des Plans" });
    }
  });

  app.get("/api/plans", requireAuth, async (_req, res) => {
    try {
      const plans = await db.select().from(savedPlans).orderBy(desc(savedPlans.createdAt));
      res.json(plans);
    } catch (err) {
      console.error("Get plans error:", err);
      res.status(500).json({ message: "Fehler beim Laden der Pläne" });
    }
  });

  app.delete("/api/plans/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(savedPlans).where(eq(savedPlans.id, Number(req.params.id)));
      res.json({ message: "Plan gelöscht" });
    } catch (err) {
      console.error("Delete plan error:", err);
      res.status(500).json({ message: "Fehler beim Löschen" });
    }
  });

  // ==================== PDF EXPORT API ====================

  app.post("/api/forecast/pdf", requireAuth, async (req, res) => {
    try {
      const parsed = forecastParamsSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Ungültige Parameter" });
      }
      const data = await generateAnnualReportData(parsed.data?.distance || 15, parsed.data);
      const html = generateAnnualReportHTML(data);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error("Forecast PDF error:", err);
      res.status(500).json({ message: "Fehler beim PDF-Export" });
    }
  });

  app.post("/api/calculator/pdf", requireAuth, async (req, res) => {
    try {
      const { customerName, distance, calculations, containerSizes } = req.body;
      const html = generateCalculatorPdfHtml({
        customerName: customerName || 'Standard',
        distance: Number(distance) || 15,
        calculations: calculations || [],
        containerSizes: containerSizes || [7, 10],
        totalAvgPrice: 0,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error("Calculator PDF error:", err);
      res.status(500).json({ message: "Fehler beim PDF-Export" });
    }
  });

  app.post("/api/planning/pdf", requireAuth, async (req, res) => {
    try {
      const { months, totalPlannedRevenue, totalActualRevenue, totalPlannedTrips, totalActualTrips, year } = req.body;
      const html = generatePlanningPdfHtml({
        months: months || [],
        totalPlannedRevenue: Number(totalPlannedRevenue) || 0,
        totalActualRevenue: Number(totalActualRevenue) || 0,
        totalPlannedTrips: Number(totalPlannedTrips) || 0,
        totalActualTrips: Number(totalActualTrips) || 0,
        year: Number(year) || new Date().getFullYear(),
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error("Planning PDF error:", err);
      res.status(500).json({ message: "Fehler beim PDF-Export" });
    }
  });

  app.post("/api/trips/pdf", requireAuth, async (req, res) => {
    try {
      const { from, to } = req.body;
      let trips = await storage.getTrips();
      if (from) trips = trips.filter(t => t.tripDate && t.tripDate >= from);
      if (to) trips = trips.filter(t => t.tripDate && t.tripDate <= to);
      const html = generateTripsPdfHtml(trips, { from, to });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error("Trips PDF error:", err);
      res.status(500).json({ message: "Fehler beim PDF-Export" });
    }
  });

  // ========== TRIPS IMPORT (CSV + PDF) ==========

  app.post("/api/trips/import-csv", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Keine CSV-Datei hochgeladen" });
      }

      const csvText = req.file.buffer.toString("utf-8");
      const allMaterials = await storage.getMaterials();

      const lines = csvText.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV-Datei enthält keine Daten (mindestens Kopfzeile + 1 Zeile erwartet)" });
      }

      const separator = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/["']/g, ""));

      const dateCol = headers.findIndex(h => /datum|date|tag/.test(h));
      const materialCol = headers.findIndex(h => /material|abfall|art|typ/.test(h));
      const containerCol = headers.findIndex(h => /container|größe|groesse|m³|m3|volumen/.test(h));
      const distanceCol = headers.findIndex(h => /entfernung|distanz|km|distance|strecke/.test(h));
      const priceCol = headers.findIndex(h => /preis|price|betrag|euro|€|netto|umsatz/.test(h));
      const notesCol = headers.findIndex(h => /notiz|note|bemerkung|kommentar/.test(h));

      if (dateCol === -1 || priceCol === -1) {
        return res.status(400).json({
          message: "CSV muss mindestens Spalten für Datum und Preis enthalten. Erkannte Spalten: " + headers.join(", "),
          headers
        });
      }

      const parsedTrips: Array<{
        tripDate: string;
        materialId: number | null;
        containerSize: number;
        distanceKm: string;
        actualPrice: string;
        notes?: string;
      }> = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(separator).map(c => c.trim().replace(/^["']|["']$/g, ""));
        if (cols.every(c => !c)) continue;

        try {
          let dateStr = cols[dateCol] || "";
          // Parse German date formats: DD.MM.YYYY or DD/MM/YYYY
          const deMatch = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
          if (deMatch) {
            const year = deMatch[3].length === 2 ? "20" + deMatch[3] : deMatch[3];
            dateStr = `${year}-${deMatch[2].padStart(2, "0")}-${deMatch[1].padStart(2, "0")}`;
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            errors.push(`Zeile ${i + 1}: Ungültiges Datum "${cols[dateCol]}"`);
            continue;
          }

          let priceStr = (cols[priceCol] || "0").replace(/[€\s]/g, "").replace(",", ".");
          const price = parseFloat(priceStr);
          if (isNaN(price)) {
            errors.push(`Zeile ${i + 1}: Ungültiger Preis "${cols[priceCol]}"`);
            continue;
          }

          let materialId: number | null = null;
          if (materialCol !== -1 && cols[materialCol]) {
            const matName = cols[materialCol].toLowerCase();
            const found = allMaterials.find(m =>
              m.name.toLowerCase() === matName ||
              m.name.toLowerCase().includes(matName) ||
              matName.includes(m.name.toLowerCase())
            );
            materialId = found ? found.id : null;
          }

          let containerSize = 7;
          if (containerCol !== -1 && cols[containerCol]) {
            const sizeNum = parseInt(cols[containerCol].replace(/[^0-9]/g, ""));
            if (sizeNum === 10) containerSize = 10;
          }

          let distanceKm = "15";
          if (distanceCol !== -1 && cols[distanceCol]) {
            const dist = cols[distanceCol].replace(",", ".").replace(/[^0-9.]/g, "");
            if (dist && !isNaN(parseFloat(dist))) distanceKm = dist;
          }

          const notes = notesCol !== -1 ? cols[notesCol] || undefined : undefined;

          parsedTrips.push({
            tripDate: dateStr,
            materialId,
            containerSize,
            distanceKm,
            actualPrice: price.toFixed(2),
            notes,
          });
        } catch {
          errors.push(`Zeile ${i + 1}: Fehler beim Verarbeiten`);
        }
      }

      if (parsedTrips.length === 0) {
        return res.status(400).json({
          message: "Keine gültigen Fahrten in der CSV gefunden",
          errors
        });
      }

      // Duplicate detection: load existing trips for the date range
      const csvDates = parsedTrips.map(t => t.tripDate);
      const minDate = csvDates.sort()[0];
      const maxDate = csvDates.sort().reverse()[0];
      const existingTrips = (await storage.getTrips()).filter(t =>
        t.tripDate >= minDate && t.tripDate <= maxDate
      );

      const makeDupKey = (t: { tripDate: string; actualPrice: string; materialId?: number | null }) =>
        `${t.tripDate}|${parseFloat(t.actualPrice).toFixed(2)}|${t.materialId || ''}`;
      const existingCsvKeyCount = new Map<string, number>();
      for (const t of existingTrips) {
        const key = makeDupKey({ tripDate: t.tripDate, actualPrice: t.actualPrice, materialId: t.materialId });
        existingCsvKeyCount.set(key, (existingCsvKeyCount.get(key) || 0) + 1);
      }

      const csvImportKeyCount = new Map<string, number>();
      const newTrips: typeof parsedTrips = [];
      let skippedCount = 0;
      const tripsWithDupStatus = parsedTrips.map(t => {
        const key = makeDupKey(t);
        const alreadyInDb = existingCsvKeyCount.get(key) || 0;
        const alreadyCounted = csvImportKeyCount.get(key) || 0;
        if (alreadyCounted < alreadyInDb) {
          csvImportKeyCount.set(key, alreadyCounted + 1);
          skippedCount++;
          return { ...t, isDuplicate: true };
        } else {
          csvImportKeyCount.set(key, alreadyCounted + 1);
          newTrips.push(t);
          return { ...t, isDuplicate: false };
        }
      });

      if (req.body?.preview === "true" || req.query.preview === "true") {
        return res.json({
          preview: true,
          trips: tripsWithDupStatus.map(t => ({
            ...t,
            materialName: t.materialId ? allMaterials.find(m => m.id === t.materialId)?.name || "Unbekannt" : "–"
          })),
          totalCount: parsedTrips.length,
          newCount: newTrips.length,
          duplicateCount: skippedCount,
          errors
        });
      }

      // Bulk insert (only non-duplicates)
      const inserted: any[] = [];
      for (const t of newTrips) {
        const trip = await storage.createTrip({
          tripDate: t.tripDate,
          materialId: t.materialId,
          containerSize: t.containerSize,
          distanceKm: t.distanceKm,
          actualPrice: t.actualPrice,
          notes: t.notes,
        });
        inserted.push(trip);
      }

      res.json({
        message: skippedCount > 0
          ? `${inserted.length} Fahrten importiert, ${skippedCount} Duplikate übersprungen`
          : `${inserted.length} Fahrten erfolgreich importiert`,
        count: inserted.length,
        skipped: skippedCount,
        errors
      });
    } catch (err) {
      console.error("CSV import error:", err);
      res.status(500).json({ message: "Fehler beim CSV-Import" });
    }
  });

  app.post("/api/trips/import-pdf", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Keine PDF-Datei hochgeladen" });
      }

      const { PDFParse: PDFParseClass2 } = await import('pdf-parse');
      const parser = new PDFParseClass2({ data: new Uint8Array(req.file.buffer) });
      await parser.load();
      const pdfResultTrip = await parser.getText();
      const pdfText = pdfResultTrip.text || '';
      await parser.destroy();

      if (!pdfText || pdfText.trim().length < 10) {
        return res.status(400).json({ message: "PDF enthält keinen lesbaren Text" });
      }

      const allMaterials = await storage.getMaterials();
      const allArticles = await storage.getArticles();
      const allCustomers = await storage.getCustomers();
      const allVehicles = await storage.getVehicles();

      const rawLines = pdfText.split('\n');
      const datePattern = /^\d{2}\.\d{2}\.\d{4}\s/;
      const headerPattern = /^(Rieprecht|Wochenauswertung|Termin\s+Kennzeichen|Druck:.*Seite|--\s*\d+\s*of\s*\d+\s*--)/i;

      const assembledRows: string[] = [];
      let currentRow = '';
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (headerPattern.test(trimmed)) continue;
        if (datePattern.test(trimmed)) {
          if (currentRow) assembledRows.push(currentRow);
          currentRow = trimmed;
        } else {
          currentRow = currentRow ? currentRow + ' ' + trimmed : trimmed;
        }
      }
      if (currentRow) assembledRows.push(currentRow);
      const dataLines = assembledRows.filter(l => datePattern.test(l));
      console.log(`PDF Import: ${dataLines.length} Datenzeilen gefunden (deterministisch)`);

      type ExtractedTrip = {
        tripDate: string;
        vehiclePlate: string | null;
        customerNumber: string | null;
        customerName: string | null;
        constructionSite: string | null;
        quantity: number;
        unit: string | null;
        actualPrice: number;
        aTyp: string | null;
        aArt: string | null;
        avvNumber: string | null;
        articleNumber: string | null;
        articleName: string | null;
      };

      function parseTripLine(line: string): ExtractedTrip | null {
        const norm = line.replace(/\u00AD/g, '-');
        const dateRe = /^(\d{2})\.(\d{2})\.(\d{4})\s+/;
        const dateM = norm.match(dateRe);
        if (!dateM) return null;
        const tripDate = `${dateM[3]}-${dateM[2]}-${dateM[1]}`;
        let rest = norm.substring(dateM[0].length);

        const plateRe = /^([A-Z\u00C4\u00D6\u00DC]{1,3}\s[A-Z\u00C4\u00D6\u00DC]{1,3}\s\d{1,4})\s+/;
        const plateM = rest.match(plateRe);
        const vehiclePlate = plateM ? plateM[1] : null;
        if (plateM) rest = rest.substring(plateM[0].length);

        const custRe = /^(\d{4,5})\s+/;
        const custM = rest.match(custRe);
        const customerNumber = custM ? custM[1] : null;
        if (custM) rest = rest.substring(custM[0].length);

        const siteMarkerRe = /\((\d+)\)/g;
        let lastSiteMatch: RegExpExecArray | null = null;
        let sm;
        while ((sm = siteMarkerRe.exec(rest)) !== null) {
          lastSiteMatch = sm;
        }
        if (!lastSiteMatch) return null;

        const nameAndSite = rest.substring(0, lastSiteMatch.index + lastSiteMatch[0].length).trim();
        rest = rest.substring(lastSiteMatch.index + lastSiteMatch[0].length).trim();

        let customerName: string | null = null;
        let constructionSite: string | null = nameAndSite;
        const matchedCust = allCustomers.find(c => c.customerNumber === customerNumber);
        if (matchedCust) {
          const cn = matchedCust.companyName || `${matchedCust.firstName || ''} ${matchedCust.lastName || ''}`.trim();
          customerName = cn;
          const cnNorm = cn.replace(/\u00AD/g, '-').toLowerCase();
          const nasNorm = nameAndSite.replace(/\u00AD/g, '-').toLowerCase();
          const idx = nasNorm.indexOf(cnNorm);
          if (idx >= 0) {
            constructionSite = nameAndSite.substring(idx + cn.length).trim();
          } else {
            const multiSpaceRe = /\s{3,}/;
            const splitM = nameAndSite.match(multiSpaceRe);
            if (splitM && splitM.index !== undefined) {
              customerName = nameAndSite.substring(0, splitM.index).trim();
              constructionSite = nameAndSite.substring(splitM.index + splitM[0].length).trim();
            }
          }
        } else {
          const multiSpaceRe = /\s{3,}/;
          const splitM = nameAndSite.match(multiSpaceRe);
          if (splitM && splitM.index !== undefined) {
            customerName = nameAndSite.substring(0, splitM.index).trim();
            constructionSite = nameAndSite.substring(splitM.index + splitM[0].length).trim();
          } else {
            customerName = nameAndSite;
            constructionSite = nameAndSite;
          }
        }

        const qtyRe = /^(-?\d+[\.,]\d+)\s*/;
        const qtyM = rest.match(qtyRe);
        if (!qtyM) return null;
        const quantity = parseFloat(qtyM[1].replace(',', '.'));
        rest = rest.substring(qtyM[0].length);

        const unitRe = /^(Stk|m\u00B3|t|Std)\s+/i;
        const unitM = rest.match(unitRe);
        const unit = unitM ? unitM[1] : null;
        if (unitM) rest = rest.substring(unitM[0].length);

        const priceRe = /^(-?\d+[\.,]\d+)\s*/;
        const priceM = rest.match(priceRe);
        if (!priceM) return null;
        const actualPrice = parseFloat(priceM[1].replace(',', '.'));
        rest = rest.substring(priceM[0].length).trim();

        const atypRe = /^([SA])\s+/;
        const atypM = rest.match(atypRe);
        const aTyp = atypM ? atypM[1] : null;
        if (atypM) rest = rest.substring(atypM[0].length);

        const aartPatterns = [
          'Beh\u00E4lter Wechsel gleich',
          'Beh\u00E4lter Ausf\u00FChren',
          'Beh\u00E4lter Aufstellen',
          'Beh\u00E4lter Abholen',
          'Beh\u00E4lter Beladen',
          'Beh\u00E4lter Leeren',
          'Transport Ausf\u00FChren',
        ];
        let aArt: string | null = null;
        const restLower = rest.toLowerCase();
        for (const pattern of aartPatterns) {
          if (restLower.startsWith(pattern.toLowerCase())) {
            aArt = pattern;
            rest = rest.substring(pattern.length).trim();
            break;
          }
        }
        if (!aArt) {
          const aartFallback = /^(Beh.lter\s+\w+(?:\s+\w+)?|Transport\s+\w+)/i;
          const aartFM = rest.match(aartFallback);
          if (aartFM) {
            aArt = aartFM[1];
            rest = rest.substring(aartFM[0].length).trim();
          }
        }

        const avvRe = /^(\d{6})\s+/;
        const avvM = rest.match(avvRe);
        const avvNumber = avvM ? avvM[1] : null;
        if (avvM) rest = rest.substring(avvM[0].length);

        let articleNumber: string | null = null;
        let articleName: string | null = null;
        if (rest.trim()) {
          const parts = rest.trim().split(/\s{2,}/);
          if (parts.length >= 2) {
            articleNumber = parts[0].trim();
            articleName = parts.slice(1).join(' ').trim();
          } else {
            const artRe = /^([\w/\u00B3\-.]+)\s+(.+)$/;
            const artM = rest.trim().match(artRe);
            if (artM) {
              articleNumber = artM[1];
              articleName = artM[2].trim();
            } else {
              articleNumber = rest.trim();
            }
          }
        }

        if (articleNumber) {
          articleNumber = articleNumber.replace(/-/g, '\u00AD').replace(/\u00AD/g, '-');
        }

        return {
          tripDate, vehiclePlate, customerNumber, customerName,
          constructionSite, quantity, unit, actualPrice, aTyp, aArt,
          avvNumber, articleNumber, articleName,
        };
      }

      const extractedTrips: ExtractedTrip[] = [];
      const parseErrors: string[] = [];
      for (let i = 0; i < dataLines.length; i++) {
        const parsed = parseTripLine(dataLines[i]);
        if (parsed) {
          extractedTrips.push(parsed);
        } else {
          parseErrors.push(`Zeile ${i + 1}: Konnte nicht geparst werden: ${dataLines[i].substring(0, 80)}...`);
          console.warn(`PDF Import: Parse-Fehler Zeile ${i + 1}: ${dataLines[i].substring(0, 120)}`);
        }
      }
      console.log(`PDF Import: ${extractedTrips.length}/${dataLines.length} Zeilen erfolgreich geparst, ${parseErrors.length} Fehler`);

      if (extractedTrips.length === 0) {
        return res.status(400).json({ message: "Keine Fahrten in der PDF erkannt", errors: parseErrors });
      }

      const parsedTrips = extractedTrips.map(t => {
        const matchedArticle = allArticles.find(a =>
          a.articleNumber && t.articleNumber &&
          a.articleNumber.replace(/[\s\u00AD-]/g, '').toLowerCase() === t.articleNumber.replace(/[\s\u00AD-]/g, '').toLowerCase()
        );

        const avvClean = (t.avvNumber || '').replace(/[\s.]/g, '');
        const articleAvv = matchedArticle?.avvNumber?.replace(/[\s.]/g, '') || '';

        let matchedMaterial: typeof allMaterials[0] | undefined;
        if (avvClean) {
          matchedMaterial = allMaterials.find(m =>
            m.avvNumber && m.avvNumber.replace(/[\s.]/g, '') === avvClean
          );
        }
        if (!matchedMaterial && articleAvv) {
          matchedMaterial = allMaterials.find(m =>
            m.avvNumber && m.avvNumber.replace(/[\s.]/g, '') === articleAvv
          );
        }
        if (!matchedMaterial) {
          const searchName = (t.articleName || '').toLowerCase().replace(/\u00AD/g, '-');
          if (searchName && searchName.length >= 3) {
            matchedMaterial = allMaterials.find(m => m.name.toLowerCase() === searchName);
            if (!matchedMaterial) {
              matchedMaterial = allMaterials.find(m => {
                const mLow = m.name.toLowerCase();
                return mLow.length >= 4 && searchName.length >= 5 && mLow.startsWith(searchName.substring(0, 5));
              });
            }
          }
        }

        const matchedCustomer = allCustomers.find(c => c.customerNumber === t.customerNumber);

        const matchedVehicle = allVehicles.find(v =>
          t.vehiclePlate && v.licensePlate &&
          v.licensePlate.replace(/\s+/g, '').toLowerCase() === t.vehiclePlate.replace(/\s+/g, '').toLowerCase()
        );

        const aArt = (t.aArt || '').trim();
        const unitRaw = (t.unit || '').trim().toLowerCase();
        let orderType: string | null = null;
        if (aArt) {
          if (/abholen/i.test(aArt)) orderType = 'Abholen';
          else if (/leeren/i.test(aArt)) orderType = 'Leeren';
          else if (/wechsel/i.test(aArt)) orderType = 'Wechsel';
          else if (/aufstellen/i.test(aArt)) orderType = 'Aufstellen';
          else if (/beladen/i.test(aArt)) orderType = 'Beladen';
          else if (/transport|ausf/i.test(aArt)) orderType = 'Transport';
        }
        if (/transport.*ausf|ausf.*hren/i.test(aArt) && unitRaw === 'stk') {
          orderType = 'Subi';
        }

        const qty = t.quantity || 0;
        const containerSize = qty >= 10 ? 10 : 7;

        let unitDerived = t.unit;
        if (!unitDerived && t.articleNumber) {
          if (/\/M/i.test(t.articleNumber)) unitDerived = 'm³';
          else if (/\/T$/i.test(t.articleNumber)) unitDerived = 't';
          else if (/\/WA$/i.test(t.articleNumber)) unitDerived = 't';
          else if (/\/A$/i.test(t.articleNumber)) unitDerived = 't';
        }

        return {
          tripDate: t.tripDate,
          materialId: matchedMaterial ? matchedMaterial.id : null,
          materialName: matchedMaterial?.name || t.articleName || "\u2013",
          containerSize,
          distanceKm: "0",
          actualPrice: (t.actualPrice || 0).toFixed(2),
          vehiclePlate: t.vehiclePlate || null,
          vehicleId: matchedVehicle ? matchedVehicle.id : null,
          customerId: matchedCustomer ? matchedCustomer.id : null,
          customerNumber: t.customerNumber || null,
          customerName: matchedCustomer
            ? (matchedCustomer.companyName || `${matchedCustomer.firstName} ${matchedCustomer.lastName}`)
            : (t.customerName || null),
          constructionSite: t.constructionSite || null,
          orderType,
          aTyp: t.aTyp || null,
          aArt: aArt || null,
          articleId: matchedArticle ? matchedArticle.id : null,
          articleNumber: t.articleNumber || null,
          articleName: t.articleName || null,
          avvNumber: t.avvNumber || null,
          quantity: t.quantity != null ? String(t.quantity) : null,
          unit: unitDerived || null,
          notes: undefined,
        };
      });

      const pdfDates = parsedTrips.map(t => t.tripDate).filter(Boolean);
      const minPdfDate = [...pdfDates].sort()[0];
      const maxPdfDate = [...pdfDates].sort().reverse()[0];
      const existingPdfTrips = (await storage.getTrips()).filter(t =>
        t.tripDate >= minPdfDate && t.tripDate <= maxPdfDate
      );

      const makePdfDupKey = (t: { tripDate: string; actualPrice: string; customerNumber?: string | null; articleNumber?: string | null; aArt?: string | null }) =>
        `${t.tripDate}|${parseFloat(t.actualPrice).toFixed(2)}|${(t.customerNumber || '').trim()}|${(t.articleNumber || '').trim()}|${(t.aArt || '').trim().toLowerCase()}`;

      const existingKeyCount = new Map<string, number>();
      for (const t of existingPdfTrips) {
        const key = makePdfDupKey({ tripDate: t.tripDate, actualPrice: t.actualPrice, customerNumber: t.customerNumber, articleNumber: t.articleNumber, aArt: t.aArt });
        existingKeyCount.set(key, (existingKeyCount.get(key) || 0) + 1);
      }

      const importKeyCount = new Map<string, number>();
      const newPdfTrips: typeof parsedTrips = [];
      let pdfSkippedCount = 0;
      const tripsWithDupStatus = parsedTrips.map(t => {
        const key = makePdfDupKey(t);
        const alreadyInDb = existingKeyCount.get(key) || 0;
        const alreadyCounted = importKeyCount.get(key) || 0;
        if (alreadyCounted < alreadyInDb) {
          importKeyCount.set(key, alreadyCounted + 1);
          pdfSkippedCount++;
          return { ...t, isDuplicate: true };
        } else {
          importKeyCount.set(key, alreadyCounted + 1);
          newPdfTrips.push(t);
          return { ...t, isDuplicate: false };
        }
      });

      if (req.body?.preview === "true" || req.query.preview === "true") {
        return res.json({
          preview: true,
          trips: tripsWithDupStatus,
          totalCount: parsedTrips.length,
          newCount: newPdfTrips.length,
          duplicateCount: pdfSkippedCount,
        });
      }

      const inserted: any[] = [];
      for (const t of newPdfTrips) {
        const trip = await storage.createTrip({
          tripDate: t.tripDate,
          materialId: t.materialId,
          containerSize: t.containerSize,
          distanceKm: t.distanceKm,
          actualPrice: t.actualPrice,
          vehicleId: t.vehicleId,
          vehiclePlate: t.vehiclePlate,
          customerId: t.customerId,
          customerNumber: t.customerNumber,
          customerName: t.customerName,
          constructionSite: t.constructionSite,
          orderType: t.orderType,
          aTyp: t.aTyp,
          aArt: t.aArt,
          articleId: t.articleId,
          articleNumber: t.articleNumber,
          articleName: t.articleName,
          avvNumber: t.avvNumber,
          quantity: t.quantity,
          unit: t.unit,
          notes: t.notes,
        });
        inserted.push(trip);
      }

      res.json({
        message: pdfSkippedCount > 0
          ? `${inserted.length} Fahrten importiert, ${pdfSkippedCount} Duplikate übersprungen`
          : `${inserted.length} Fahrten erfolgreich importiert`,
        count: inserted.length,
        skipped: pdfSkippedCount,
      });
    } catch (err) {
      console.error("PDF import error:", err);
      res.status(500).json({ message: "Fehler beim PDF-Import" });
    }
  });

  app.get("/api/customers/pdf", requireAuth, async (_req, res) => {
    try {
      const customers = await storage.getCustomers();
      const html = generateCustomersPdfHtml(customers);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error("Customers PDF error:", err);
      res.status(500).json({ message: "Fehler beim PDF-Export" });
    }
  });

  app.post("/api/forecast/price-optimization", requireAuth, async (req, res) => {
    try {
      const { distance = 15 } = req.body;
      const [allMaterials, allVariables, allVehicles, allEmployees, allLoans, allSalesPrices, allMarketPrices, settingsRow, allPurchaseSurcharges, allSalesSurcharges] = await Promise.all([
        storage.getMaterials(),
        storage.getCostVariables(),
        storage.getVehicles(),
        storage.getEmployees(),
        storage.getLoans(),
        storage.getSalesPrices(),
        storage.getMarketPrices(),
        storage.getPlanningSettings(),
        storage.getPurchaseSurcharges(),
        storage.getSalesSurcharges(),
      ]);

      const settings = settingsRow || { id: 1, containersPerDay: 6, workDaysPerMonth: 20, targetMarginPercent: "65", activeTrucks: 1, plannedTrucksDate: null, monthlyRent: "0" };
      const targetMargin = Number(settings.targetMarginPercent || 15) / 100;

      const dieselPrice = Number(allVariables.find(v => v.name === "Diesel Preis")?.value || 1.70);
      const fuelConsumption = Number(allVariables.find(v => v.name === "Verbrauch (L/100km)")?.value || 35);
      const tollPerKm = Number(allVariables.find(v => v.name === "Maut / Gebühren")?.value || 0.19);
      const containerPickupPrice = 135;
      const fuelCostPerKm = (fuelConsumption / 100) * dieselPrice;
      const transportCostPerTrip = (fuelCostPerKm + tollPerKm) * distance * 2;

      const workDays = settings.workDaysPerMonth || 20;
      const containersPerDay = settings.containersPerDay || 6;
      const containersPerMonth = workDays * containersPerDay;

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
      const monthlyOperatingCosts = allVariables.filter(v => v.unit === 'per_month').reduce((s, v) => s + Number(v.value), 0);
      const monthlyLoanCosts = activeLoans.reduce((s, l) => {
        const amount = Number(l.amount || 0);
        const repayment = Number(l.repaymentPercent || 0);
        const interest = Number(l.interestPercent || 0);
        return s + ((amount * repayment / 100) + (amount * interest / 100)) / 12;
      }, 0);
      const totalMonthlyFixed = monthlyVehicleCosts + monthlyEmployeeCosts + monthlyOperatingCosts + monthlyLoanCosts;
      const fixedCostPerContainer = containersPerMonth > 0 ? totalMonthlyFixed / containersPerMonth : 0;

      const normalizeAvv = (avv: string | null | undefined): string => {
        if (!avv) return '';
        return avv.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      };

      const recommendations: any[] = [];
      const activeMaterials = allMaterials.filter(m => m.isActive);

      for (const size of [7, 10]) {
        for (const mat of activeMaterials) {
          const density = Number(mat.density || 0);
          const weight = size * density;
          const disposalRate = Number(mat.disposalCostPerTonne || 0);
          const matchingSP = allSalesPrices.find(sp => normalizeAvv(sp.avvCode) === normalizeAvv(mat.avvNumber));
          const isDangerous = matchingSP?.isDangerous || false;
          const purchaseSurcharge = calcPurchaseSurchargeTotal(mat.purchaseSurchargeIds, allPurchaseSurcharges, "m3", weight, size, isDangerous);
          const disposalCost = (weight * disposalRate) + purchaseSurcharge;
          const baseCost = transportCostPerTrip + disposalCost + fixedCostPerContainer;

          const salesSurchargeTonne = calcSalesSurchargeTotal(matchingSP?.salesSurchargeIds, allSalesSurcharges, "tonne", weight, size, isDangerous);
          const salesSurchargeM3 = calcSalesSurchargeTotal(matchingSP?.salesSurchargeIds, allSalesSurcharges, "m3", weight, size, isDangerous);

          let listPriceTonne: number | null = null;
          if (matchingSP?.pricePerTonne && weight > 0) {
            listPriceTonne = Number(matchingSP.pricePerTonne) * weight + salesSurchargeTonne + containerPickupPrice;
          }
          let listPriceM3: number | null = null;
          if (matchingSP?.pricePerCubicMeter && size > 0) {
            listPriceM3 = Number(matchingSP.pricePerCubicMeter) * size + salesSurchargeM3 + containerPickupPrice;
          }
          const currentListPrice = listPriceM3 ?? listPriceTonne ?? null;

          const matchingMPs = allMarketPrices.filter(p => p.materialCategory === mat.name && p.containerSizeM3 === size);
          let marketPriceNet: number | null = null;
          let marketPriceGross: number | null = null;
          let marketProviders: string[] = [];
          if (matchingMPs.length > 0) {
            const nets = matchingMPs.map(p => Number(p.priceNet || p.priceGross)).filter(n => n > 0);
            const grosses = matchingMPs.map(p => Number(p.priceGross)).filter(n => n > 0);
            marketPriceNet = nets.length > 0 ? nets.reduce((a, b) => a + b, 0) / nets.length : null;
            marketPriceGross = grosses.length > 0 ? grosses.reduce((a, b) => a + b, 0) / grosses.length : null;
            marketProviders = matchingMPs.map(p => p.provider);
          }

          const optimalPrice = Math.round(baseCost * (1 + targetMargin) * 100) / 100;

          let currentMargin: number | null = null;
          let currentMarginPercent: number | null = null;
          if (currentListPrice !== null && baseCost > 0) {
            currentMargin = currentListPrice - baseCost;
            currentMarginPercent = (currentMargin / baseCost) * 100;
          }

          let optimalMargin = optimalPrice - baseCost;
          let optimalMarginPercent = baseCost > 0 ? (optimalMargin / baseCost) * 100 : 0;

          let marketMargin: number | null = null;
          let marketMarginPercent: number | null = null;
          if (marketPriceNet !== null && baseCost > 0) {
            marketMargin = marketPriceNet - baseCost;
            marketMarginPercent = (marketMargin / baseCost) * 100;
          }

          let status: 'under_cost' | 'below_market' | 'at_market' | 'above_market' | 'no_price' | 'no_market' = 'no_price';
          let recommendation = '';

          if (currentListPrice === null) {
            status = 'no_price';
            recommendation = 'Kein Listenpreis hinterlegt.';
          } else if (currentListPrice < baseCost) {
            status = 'under_cost';
            recommendation = `Preis liegt unter den Kosten! Verlust von ${(baseCost - currentListPrice).toFixed(2).replace('.', ',')} € pro Container.`;
          } else if (marketPriceNet === null) {
            status = 'no_market';
            recommendation = 'Kein Marktpreis vorhanden. Vergleich nicht möglich.';
          } else if (currentListPrice <= marketPriceNet * 0.95) {
            status = 'below_market';
            recommendation = `Preis liegt ${Math.round((1 - currentListPrice / marketPriceNet) * 100)}% unter Marktpreis – wettbewerbsfähig.`;
          } else if (currentListPrice <= marketPriceNet * 1.05) {
            status = 'at_market';
            recommendation = 'Preis liegt im Marktbereich (±5%).';
          } else {
            status = 'above_market';
            recommendation = `Preis liegt ${Math.round((currentListPrice / marketPriceNet - 1) * 100)}% über Marktpreis – schwerer vermittelbar.`;
          }

          const annualImpact = currentListPrice !== null
            ? Math.round((optimalPrice - currentListPrice) * containersPerMonth * 12 / (activeMaterials.length * 2))
            : null;

          recommendations.push({
            materialId: mat.id,
            materialName: mat.name,
            avvNumber: mat.avvNumber || '',
            containerSize: size,
            density,
            weight: Math.round(weight * 100) / 100,
            transportCost: Math.round(transportCostPerTrip * 100) / 100,
            disposalCost: Math.round(disposalCost * 100) / 100,
            fixedCostShare: Math.round(fixedCostPerContainer * 100) / 100,
            baseCost: Math.round(baseCost * 100) / 100,
            currentListPrice: currentListPrice !== null ? Math.round(currentListPrice * 100) / 100 : null,
            currentMargin: currentMargin !== null ? Math.round(currentMargin * 100) / 100 : null,
            currentMarginPercent: currentMarginPercent !== null ? Math.round(currentMarginPercent * 10) / 10 : null,
            optimalPrice: Math.round(optimalPrice * 100) / 100,
            optimalMargin: Math.round(optimalMargin * 100) / 100,
            optimalMarginPercent: Math.round(optimalMarginPercent * 10) / 10,
            marketPriceNet: marketPriceNet !== null ? Math.round(marketPriceNet * 100) / 100 : null,
            marketPriceGross: marketPriceGross !== null ? Math.round(marketPriceGross * 100) / 100 : null,
            marketMargin: marketMargin !== null ? Math.round(marketMargin * 100) / 100 : null,
            marketMarginPercent: marketMarginPercent !== null ? Math.round(marketMarginPercent * 10) / 10 : null,
            marketProviders,
            status,
            recommendation,
            annualImpact,
            salesPriceId: matchingSP?.id || null,
            currentPricePerTonne: matchingSP?.pricePerTonne ? Number(matchingSP.pricePerTonne) : null,
            currentPricePerM3: matchingSP?.pricePerCubicMeter ? Number(matchingSP.pricePerCubicMeter) : null,
            salesSurchargeTotalTonne: Math.round(salesSurchargeTonne * 100) / 100,
            salesSurchargeTotalM3: Math.round(salesSurchargeM3 * 100) / 100,
            purchaseSurchargeTotal: Math.round(purchaseSurcharge * 100) / 100,
          });
        }
      }

      const totalCurrentRevenue = recommendations
        .filter(r => r.currentListPrice !== null)
        .reduce((s, r) => s + r.currentListPrice, 0);
      const totalOptimalRevenue = recommendations
        .filter(r => r.currentListPrice !== null)
        .reduce((s, r) => s + r.optimalPrice, 0);
      const totalAnnualImpact = recommendations
        .filter(r => r.annualImpact !== null)
        .reduce((s, r) => s + r.annualImpact, 0);

      res.json({
        recommendations,
        summary: {
          totalMaterials: activeMaterials.length,
          containerSizes: [7, 10],
          targetMarginPercent: Math.round(targetMargin * 100),
          distance,
          fixedCostPerContainer: Math.round(fixedCostPerContainer * 100) / 100,
          totalMonthlyFixed: Math.round(totalMonthlyFixed * 100) / 100,
          containersPerMonth,
          underCost: recommendations.filter(r => r.status === 'under_cost').length,
          belowMarket: recommendations.filter(r => r.status === 'below_market').length,
          atMarket: recommendations.filter(r => r.status === 'at_market').length,
          aboveMarket: recommendations.filter(r => r.status === 'above_market').length,
          noPrice: recommendations.filter(r => r.status === 'no_price').length,
          noMarket: recommendations.filter(r => r.status === 'no_market').length,
          totalCurrentRevenue: Math.round(totalCurrentRevenue * 100) / 100,
          totalOptimalRevenue: Math.round(totalOptimalRevenue * 100) / 100,
          totalAnnualImpact: Math.round(totalAnnualImpact),
        },
      });
    } catch (err) {
      console.error("Price optimization error:", err);
      res.status(500).json({ message: "Fehler bei der Preisoptimierung" });
    }
  });

  app.post("/api/forecast/apply-prices", requireAuth, async (req, res) => {
    try {
      const { selections, distance = 15, confirmLargeChange } = req.body;
      if (!selections || !Array.isArray(selections) || selections.length === 0) {
        return res.status(400).json({ message: "Keine Preisänderungen ausgewählt" });
      }

      const [allMaterials, allVariables, allVehicles, allEmployees, allLoans, allSalesPrices, settingsRow, allPurchaseSurcharges2, allSalesSurcharges2] = await Promise.all([
        storage.getMaterials(),
        storage.getCostVariables(),
        storage.getVehicles(),
        storage.getEmployees(),
        storage.getLoans(),
        storage.getSalesPrices(),
        storage.getPlanningSettings(),
        storage.getPurchaseSurcharges(),
        storage.getSalesSurcharges(),
      ]);

      const settings = settingsRow || { id: 1, containersPerDay: 6, workDaysPerMonth: 20, targetMarginPercent: "65", activeTrucks: 1, plannedTrucksDate: null, monthlyRent: "0" };
      const targetMargin = Number(settings.targetMarginPercent || 15) / 100;
      const dieselPrice = Number(allVariables.find(v => v.name === "Diesel Preis")?.value || 1.70);
      const fuelConsumption = Number(allVariables.find(v => v.name === "Verbrauch (L/100km)")?.value || 35);
      const tollPerKm = Number(allVariables.find(v => v.name === "Maut / Gebühren")?.value || 0.19);
      const containerPickupPrice = 135;
      const fuelCostPerKm = (fuelConsumption / 100) * dieselPrice;
      const transportCostPerTrip = (fuelCostPerKm + tollPerKm) * distance * 2;
      const workDays = settings.workDaysPerMonth || 20;
      const containersPerDay = settings.containersPerDay || 6;
      const containersPerMonth = workDays * containersPerDay;
      const today = new Date();
      const hasStarted = (dateStr: string | null | undefined) => {
        if (!dateStr) return true;
        return new Date(dateStr) <= today;
      };
      const activeVehicles = allVehicles.filter(v => v.isActive && hasStarted(v.purchaseDate));
      const activeEmployees = allEmployees.filter(e => e.isActive && hasStarted(e.hireDate));
      const activeLoans = allLoans.filter(l => l.isActive && (!l.endDate || new Date(l.endDate) >= today));
      const monthlyVehicleCosts = activeVehicles.reduce((s, v) => s + Number(v.monthlyLeaseCost || 0) + Number(v.monthlyInsurance || 0) + Number(v.monthlyMaintenance || 0) + (Number(v.purchaseCost || 0) / ((v.depreciationYears || 10) * 12)), 0);
      const monthlyEmployeeCosts = activeEmployees.reduce((s, e) => s + Number(e.monthlySalary || 0) + Number(e.taxFreeAllowance || 0), 0);
      const monthlyOperatingCosts = allVariables.filter(v => v.unit === 'per_month').reduce((s, v) => s + Number(v.value), 0);
      const monthlyLoanCosts = activeLoans.reduce((s, l) => { const a = Number(l.amount || 0); return s + ((a * Number(l.repaymentPercent || 0) / 100) + (a * Number(l.interestPercent || 0) / 100)) / 12; }, 0);
      const totalMonthlyFixed = monthlyVehicleCosts + monthlyEmployeeCosts + monthlyOperatingCosts + monthlyLoanCosts;
      const fixedCostPerContainer = containersPerMonth > 0 ? totalMonthlyFixed / containersPerMonth : 0;

      const normalizeAvvFn = (avv: string | null | undefined): string => {
        if (!avv) return '';
        return avv.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      };

      const THRESHOLD = 0.25;
      const results: any[] = [];
      const warnings: string[] = [];

      const pendingChanges: Array<{ spId: number; field: string; oldValue: string; newValue: string; material: string; containerSize: number }> = [];

      for (const sel of selections) {
        const { materialId, containerSize, targetPrice } = sel;
        const mat = allMaterials.find(m => m.id === materialId);
        if (!mat) continue;

        const density = Number(mat.density || 0);
        const weight = containerSize * density;

        const matchingSP = allSalesPrices.find(sp => normalizeAvvFn(sp.avvCode) === normalizeAvvFn(mat.avvNumber));
        if (!matchingSP) continue;
        const isDangerous = matchingSP.isDangerous || false;

        let chosenTotal: number;
        if (targetPrice !== undefined && targetPrice !== null) {
          chosenTotal = Number(targetPrice);
        } else {
          const disposalRate = Number(mat.disposalCostPerTonne || 0);
          const purchaseSurcharge = calcPurchaseSurchargeTotal(mat.purchaseSurchargeIds, allPurchaseSurcharges2, "m3", weight, containerSize, isDangerous);
          const disposalCost = (weight * disposalRate) + purchaseSurcharge;
          const baseCost = transportCostPerTrip + disposalCost + fixedCostPerContainer;
          chosenTotal = baseCost * (1 + targetMargin);
        }

        const salesSurchargeTonneApply = calcSalesSurchargeTotal(matchingSP.salesSurchargeIds, allSalesSurcharges2, "tonne", weight, containerSize, isDangerous);
        const salesSurchargeM3Apply = calcSalesSurchargeTotal(matchingSP.salesSurchargeIds, allSalesSurcharges2, "m3", weight, containerSize, isDangerous);

        if (matchingSP.pricePerCubicMeter !== null && matchingSP.pricePerCubicMeter !== undefined) {
          const newPerM3 = containerSize > 0 ? Math.max(0, (chosenTotal - containerPickupPrice - salesSurchargeM3Apply) / containerSize) : Number(matchingSP.pricePerCubicMeter);
          const rounded = Math.round(newPerM3 * 100) / 100;
          const oldNum = parseFloat(matchingSP.pricePerCubicMeter);
          if (oldNum > 0 && Math.abs(rounded - oldNum) / oldNum >= THRESHOLD) {
            const pct = Math.round(Math.abs(rounded - oldNum) / oldNum * 100);
            warnings.push(`${mat.name}: Preis/m³ ${rounded < oldNum ? 'sinkt' : 'steigt'} um ${pct}% (${oldNum.toFixed(2).replace('.', ',')} → ${rounded.toFixed(2).replace('.', ',')} €)`);
          }
          pendingChanges.push({ spId: matchingSP.id, field: 'pricePerCubicMeter', oldValue: matchingSP.pricePerCubicMeter, newValue: String(rounded), material: mat.name, containerSize });
        } else if (matchingSP.pricePerTonne !== null && matchingSP.pricePerTonne !== undefined) {
          const newPerTonne = weight > 0 ? Math.max(0, (chosenTotal - containerPickupPrice - salesSurchargeTonneApply) / weight) : Number(matchingSP.pricePerTonne);
          const rounded = Math.round(newPerTonne * 100) / 100;
          const oldNum = parseFloat(matchingSP.pricePerTonne);
          if (oldNum > 0 && Math.abs(rounded - oldNum) / oldNum >= THRESHOLD) {
            const pct = Math.round(Math.abs(rounded - oldNum) / oldNum * 100);
            warnings.push(`${mat.name}: Preis/t ${rounded < oldNum ? 'sinkt' : 'steigt'} um ${pct}% (${oldNum.toFixed(2).replace('.', ',')} → ${rounded.toFixed(2).replace('.', ',')} €)`);
          }
          pendingChanges.push({ spId: matchingSP.id, field: 'pricePerTonne', oldValue: matchingSP.pricePerTonne, newValue: String(rounded), material: mat.name, containerSize });
        }
      }

      if (warnings.length > 0 && !confirmLargeChange) {
        return res.status(409).json({
          requireConfirmation: true,
          warnings,
          message: `${warnings.length} große Preisänderung(en) erkannt. Bitte bestätigen.`,
        });
      }

      for (const change of pendingChanges) {
        await storage.updateSalesPrice(change.spId, { [change.field]: change.newValue });
        results.push({ material: change.material, containerSize: change.containerSize, field: change.field, oldValue: change.oldValue, newValue: change.newValue });
      }

      res.json({ message: `${results.length} Preise aktualisiert`, changes: results });
    } catch (err) {
      console.error("Apply prices error:", err);
      res.status(500).json({ message: "Fehler beim Übernehmen der Preise" });
    }
  });

  app.post("/api/priceopt/pdf", requireAuth, async (req, res) => {
    try {
      const { recommendations, summary } = req.body;
      if (!recommendations || !summary) {
        return res.status(400).json({ message: "Keine Analysedaten vorhanden" });
      }
      const html = generatePriceOptPdfHtml({ recommendations, summary });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error("PriceOpt PDF error:", err);
      res.status(500).json({ message: "Fehler beim PDF-Export" });
    }
  });

  app.post("/api/priceopt/pricelist", requireAuth, async (req, res) => {
    try {
      const { recommendations, distance = 15, customerName, discountPercent } = req.body;
      if (!recommendations) {
        return res.status(400).json({ message: "Keine Preisdaten vorhanden" });
      }
      const html = generateCustomerPriceListHtml({
        recommendations,
        distance: Number(distance),
        customerName: customerName || undefined,
        discountPercent: Number(discountPercent) || 0,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error("Price list PDF error:", err);
      res.status(500).json({ message: "Fehler bei der Preislisten-Erstellung" });
    }
  });

  app.post("/api/priceopt/pricelist/send", requireAuth, async (req, res) => {
    try {
      const { recommendations, distance = 15, customerName, discountPercent, email } = req.body;
      if (!recommendations || !email) {
        return res.status(400).json({ message: "Preisdaten und E-Mail-Adresse erforderlich" });
      }
      const html = generateCustomerPriceListHtml({
        recommendations,
        distance: Number(distance),
        customerName: customerName || undefined,
        discountPercent: Number(discountPercent) || 0,
      });
      const pdfBuffer = await generatePdfFromHtml(html, {
        format: 'A4',
        landscape: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      const success = await sendPriceListEmail(email, pdfBuffer, customerName);
      if (success) {
        res.json({ message: `Preisliste wurde als PDF an ${email} gesendet` });
      } else {
        res.status(500).json({ message: "E-Mail konnte nicht gesendet werden" });
      }
    } catch (err) {
      console.error("Price list email error:", err);
      res.status(500).json({ message: "Fehler beim Versenden der Preisliste" });
    }
  });

  // BWA Reports
  app.get("/api/bwa", requireAuth, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const reports = await storage.getBwaReports(year);
      res.json(reports);
    } catch (err) {
      console.error("BWA get error:", err);
      res.status(500).json({ message: "Fehler beim Laden der BWA-Daten" });
    }
  });

  app.delete("/api/bwa/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteBwaReport(Number(req.params.id));
      res.json({ message: "BWA-Eintrag gelöscht" });
    } catch (err) {
      console.error("BWA delete error:", err);
      res.status(500).json({ message: "Fehler beim Löschen" });
    }
  });

  app.post("/api/bwa/import-pdf", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Keine Datei hochgeladen" });
      }

      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
      await parser.load();
      const pdfResult2 = await parser.getText();
      const pdfText = pdfResult2.text || '';
      await parser.destroy();

      if (!pdfText || pdfText.trim().length < 50) {
        return res.status(400).json({ message: "PDF enthält keinen lesbaren Text" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Du bist ein Experte für die Analyse von BWA (Betriebswirtschaftliche Auswertung) Dokumenten aus DATEV oder ähnlichen Buchhaltungssystemen.

Extrahiere die monatlichen BWA-Daten aus dem Text. Eine BWA enthält typischerweise:
- Umsatzerlöse
- Materialaufwand / Wareneinsatz
- Personalkosten (Löhne, Gehälter, Sozialabgaben)
- Fahrzeugkosten (Kfz-Kosten, Reparaturen)
- Betriebskosten (Miete, Versicherungen, Werbung, etc.)
- Abschreibungen (AfA)
- Zinsaufwand
- Sonstige Kosten
- Gesamtkosten
- Betriebsergebnis (= Umsatz - Gesamtkosten)

Extrahiere die Daten für JEDEN verfügbaren Monat.

Antworte NUR mit einem JSON-Objekt in diesem Format:
{
  "year": 2025,
  "months": [
    {
      "month": 1,
      "revenue": 12345.67,
      "materialCosts": 1234.56,
      "personnelCosts": 5000.00,
      "vehicleCosts": 2000.00,
      "operatingCosts": 3000.00,
      "depreciation": 500.00,
      "interestCosts": 200.00,
      "otherCosts": 300.00,
      "totalCosts": 12234.56,
      "operatingResult": 111.11
    }
  ]
}

Wichtig:
- Alle Werte als Zahlen (keine Strings, kein Tausendertrenner).
- Negative Werte für Verluste verwenden.
- Wenn ein Wert nicht erkennbar ist, setze ihn auf 0.
- Das Betriebsergebnis ist Umsatz minus Gesamtkosten.
- Wenn die BWA kumulierte Werte zeigt, extrahiere die Monatswerte (nicht die kumulierten).
- Erkenne das Jahr aus dem Dokument.
- Wenn keine BWA-Daten erkennbar sind, antworte mit {"year": 0, "months": []}.`
          },
          {
            role: "user",
            content: pdfText.substring(0, 20000)
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(400).json({ message: "KI konnte keine BWA-Daten erkennen" });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.year || !parsed.months || parsed.months.length === 0) {
        return res.status(400).json({ message: "Keine BWA-Monatsdaten im Dokument erkannt" });
      }

      const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

      const preview = parsed.months.map((m: any) => ({
        year: parsed.year,
        month: m.month,
        monthName: MONTH_NAMES[(m.month - 1)] || `Monat ${m.month}`,
        revenue: m.revenue || 0,
        materialCosts: m.materialCosts || 0,
        personnelCosts: m.personnelCosts || 0,
        vehicleCosts: m.vehicleCosts || 0,
        operatingCosts: m.operatingCosts || 0,
        depreciation: m.depreciation || 0,
        interestCosts: m.interestCosts || 0,
        otherCosts: m.otherCosts || 0,
        totalCosts: m.totalCosts || 0,
        operatingResult: m.operatingResult || 0,
      }));

      if (req.body?.confirm === 'true' || req.query.confirm === 'true') {
        let cumulativeResult = 0;
        const saved = [];
        for (const m of preview) {
          cumulativeResult += m.operatingResult;
          const report = await storage.upsertBwaReport({
            year: m.year,
            month: m.month,
            revenue: String(m.revenue),
            materialCosts: String(m.materialCosts),
            personnelCosts: String(m.personnelCosts),
            vehicleCosts: String(m.vehicleCosts),
            operatingCosts: String(m.operatingCosts),
            depreciation: String(m.depreciation),
            interestCosts: String(m.interestCosts),
            otherCosts: String(m.otherCosts),
            totalCosts: String(m.totalCosts),
            operatingResult: String(m.operatingResult),
            cumulativeResult: String(cumulativeResult),
            rawData: parsed,
            sourceFileName: req.file!.originalname,
            importedBy: req.session.userId || null,
          });
          saved.push(report);
        }
        return res.json({ message: `${saved.length} BWA-Monate importiert für ${parsed.year}`, saved });
      }

      res.json({ preview, year: parsed.year, fileName: req.file.originalname });
    } catch (err) {
      console.error("BWA import error:", err);
      res.status(500).json({ message: "Fehler beim BWA-Import" });
    }
  });

  app.post("/api/bwa/confirm-import", requireAuth, async (req, res) => {
    try {
      const { preview, year, fileName } = req.body;
      if (!preview || !Array.isArray(preview) || preview.length === 0) {
        return res.status(400).json({ message: "Keine Vorschaudaten vorhanden" });
      }

      let cumulativeResult = 0;
      const saved = [];
      for (const m of preview) {
        cumulativeResult += (m.operatingResult || 0);
        const report = await storage.upsertBwaReport({
          year: m.year || year,
          month: m.month,
          revenue: String(m.revenue || 0),
          materialCosts: String(m.materialCosts || 0),
          personnelCosts: String(m.personnelCosts || 0),
          vehicleCosts: String(m.vehicleCosts || 0),
          operatingCosts: String(m.operatingCosts || 0),
          depreciation: String(m.depreciation || 0),
          interestCosts: String(m.interestCosts || 0),
          otherCosts: String(m.otherCosts || 0),
          totalCosts: String(m.totalCosts || 0),
          operatingResult: String(m.operatingResult || 0),
          cumulativeResult: String(cumulativeResult),
          rawData: null,
          sourceFileName: fileName || 'import',
          importedBy: req.session.userId || null,
        });
        saved.push(report);
      }

      res.json({ message: `${saved.length} BWA-Monate für ${year} importiert`, saved });
    } catch (err) {
      console.error("BWA confirm import error:", err);
      res.status(500).json({ message: "Fehler beim Speichern der BWA-Daten" });
    }
  });

  // ============================================================
  // Aufgaben & Notizen
  // ============================================================

  const taskUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  // Schlanke User-Liste für Aufgaben-Zuweisung (jeder eingeloggte User darf sehen, wem er Aufgaben zuweisen kann)
  app.get("/api/users/assignable", requireAuth, async (_req, res) => {
    const all = await storage.getAllUsers();
    res.json(all.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
  });

  function canSeeTask(task: { createdById: number; assigneeIds: number[] }, userId: number): boolean {
    return task.createdById === userId || task.assigneeIds.includes(userId);
  }

  // GET /api/tasks?scope=mine|created|all&status=&priority=&search=
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const scope = (req.query.scope as string) || "mine";
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;
      const search = (req.query.search as string | undefined)?.toLowerCase();

      let list = scope === "all"
        ? await storage.getAllTasks()
        : await storage.getTasksForUser(userId);

      if (scope === "mine") {
        list = list.filter(t => t.assigneeIds.includes(userId));
      } else if (scope === "created") {
        list = list.filter(t => t.createdById === userId);
      }

      if (status) list = list.filter(t => t.status === status);
      if (priority) list = list.filter(t => t.priority === priority);
      if (search) list = list.filter(t =>
        t.title.toLowerCase().includes(search) ||
        (t.description?.toLowerCase().includes(search) ?? false)
      );

      res.json(list);
    } catch (err) {
      console.error("List tasks error:", err);
      res.status(500).json({ message: "Fehler beim Laden der Aufgaben" });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const task = await storage.getTaskById(Number(req.params.id));
      if (!task) return res.status(404).json({ message: "Aufgabe nicht gefunden" });
      if (!canSeeTask(task, userId)) return res.status(403).json({ message: "Keine Berechtigung" });
      res.json(task);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Laden der Aufgabe" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { assigneeIds, ...rest } = req.body ?? {};
      const input = insertTaskSchema.omit({ createdById: true } as any).parse(rest);
      const ids: number[] = Array.isArray(assigneeIds) ? assigneeIds.map(Number).filter(Boolean) : [];
      const task = await storage.createTask({ ...input, createdById: userId } as any, userId, ids);

      // Notify assignees (excluding creator)
      const notifyIds = ids.filter(id => id !== userId);
      if (notifyIds.length > 0) {
        const allUsers = await storage.getAllUsers();
        const assignees = allUsers.filter(u => notifyIds.includes(u.id));
        const creator = allUsers.find(u => u.id === userId);
        for (const a of assignees) {
          if (!a.email) continue;
          const settings = await storage.getNotificationSettings(a.id);
          if (!settings.emailRemindersEnabled) continue;
          sendTaskAssignedEmail({
            to: a.email,
            recipientName: a.name,
            task,
            creatorName: creator?.name || "Ein Kollege",
          }).catch(e => console.error("Task assigned email failed:", e));
        }
      }

      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Create task error:", err);
      res.status(500).json({ message: "Fehler beim Erstellen der Aufgabe" });
    }
  });

  app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ message: "Aufgabe nicht gefunden" });
      if (!canSeeTask(existing, userId)) return res.status(403).json({ message: "Keine Berechtigung" });

      const { assigneeIds, ...rest } = req.body ?? {};
      const partial = insertTaskSchema.omit({ createdById: true } as any).partial().parse(rest);
      const task = await storage.updateTask(id, partial as any, Array.isArray(assigneeIds) ? assigneeIds.map(Number) : undefined);
      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Update task error:", err);
      res.status(500).json({ message: "Fehler beim Aktualisieren der Aufgabe" });
    }
  });

  app.post("/api/tasks/:id/complete", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ message: "Aufgabe nicht gefunden" });
      if (!canSeeTask(existing, userId)) return res.status(403).json({ message: "Keine Berechtigung" });
      const task = await storage.completeTask(id, userId);
      res.json(task);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Abschließen" });
    }
  });

  app.post("/api/tasks/:id/reopen", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ message: "Aufgabe nicht gefunden" });
      if (!canSeeTask(existing, userId)) return res.status(403).json({ message: "Keine Berechtigung" });
      const task = await storage.reopenTask(id);
      res.json(task);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Reaktivieren" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const existing = await storage.getTaskById(id);
      if (!existing) return res.status(404).json({ message: "Aufgabe nicht gefunden" });
      if (existing.createdById !== userId) {
        return res.status(403).json({ message: "Nur der Ersteller darf löschen" });
      }
      await storage.deleteTask(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Löschen" });
    }
  });

  // Comments
  app.get("/api/tasks/:id/comments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ message: "Aufgabe nicht gefunden" });
      if (!canSeeTask(task, userId)) return res.status(403).json({ message: "Keine Berechtigung" });
      const comments = await storage.getTaskComments(id);
      res.json(comments);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Laden der Kommentare" });
    }
  });

  app.post("/api/tasks/:id/comments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ message: "Aufgabe nicht gefunden" });
      if (!canSeeTask(task, userId)) return res.status(403).json({ message: "Keine Berechtigung" });
      const content = String(req.body?.content || "").trim();
      if (!content) return res.status(400).json({ message: "Kommentar darf nicht leer sein" });
      const comment = await storage.createTaskComment({ taskId: id, authorId: userId, content });
      res.status(201).json(comment);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Speichern des Kommentars" });
    }
  });

  // Attachments
  app.post("/api/tasks/:id/attachments", requireAuth, taskUpload.single("file"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ message: "Aufgabe nicht gefunden" });
      if (!canSeeTask(task, userId)) return res.status(403).json({ message: "Keine Berechtigung" });
      if (!req.file) return res.status(400).json({ message: "Keine Datei hochgeladen" });
      const attachment = await storage.createTaskAttachment({
        taskId: id,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer.toString("base64"),
        uploadedById: userId,
      });
      const { data, ...rest } = attachment;
      res.status(201).json(rest);
    } catch (err) {
      console.error("Task attachment upload error:", err);
      res.status(500).json({ message: "Fehler beim Datei-Upload" });
    }
  });

  app.get("/api/tasks/attachments/:attId/download", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const attachment = await storage.getTaskAttachment(Number(req.params.attId));
      if (!attachment) return res.status(404).json({ message: "Anhang nicht gefunden" });
      const task = await storage.getTaskById(attachment.taskId);
      if (!task || !canSeeTask(task, userId)) return res.status(403).json({ message: "Keine Berechtigung" });
      const buf = Buffer.from(attachment.data, "base64");
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      res.send(buf);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Download" });
    }
  });

  app.delete("/api/tasks/attachments/:attId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const attachment = await storage.getTaskAttachment(Number(req.params.attId));
      if (!attachment) return res.status(404).json({ message: "Anhang nicht gefunden" });
      const task = await storage.getTaskById(attachment.taskId);
      if (!task || !canSeeTask(task, userId)) return res.status(403).json({ message: "Keine Berechtigung" });
      await storage.deleteTaskAttachment(attachment.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Löschen" });
    }
  });

  // ============================================================
  // Notizen
  // ============================================================

  app.get("/api/notes", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const scope = (req.query.scope as string) || "all"; // all (mine + public) | mine | public
      const search = (req.query.search as string | undefined)?.toLowerCase();
      let list = await storage.getNotesForUser(userId);
      if (scope === "mine") list = list.filter(n => n.createdById === userId);
      else if (scope === "public") list = list.filter(n => n.visibility === "public");
      if (search) list = list.filter(n =>
        n.title.toLowerCase().includes(search) ||
        (n.content?.toLowerCase().includes(search) ?? false)
      );
      res.json(list);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Laden der Notizen" });
    }
  });

  app.get("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const note = await storage.getNoteById(Number(req.params.id));
      if (!note) return res.status(404).json({ message: "Notiz nicht gefunden" });
      if (note.createdById !== userId && note.visibility !== "public") {
        return res.status(403).json({ message: "Keine Berechtigung" });
      }
      res.json(note);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Laden" });
    }
  });

  app.post("/api/notes", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const input = insertNoteSchema.omit({ createdById: true } as any).parse(req.body);
      const note = await storage.createNote({ ...input, createdById: userId } as any);
      res.status(201).json(note);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Fehler beim Erstellen der Notiz" });
    }
  });

  app.put("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const existing = await storage.getNoteById(id);
      if (!existing) return res.status(404).json({ message: "Notiz nicht gefunden" });
      if (existing.createdById !== userId) return res.status(403).json({ message: "Nur der Ersteller darf bearbeiten" });
      const partial = insertNoteSchema.omit({ createdById: true } as any).partial().parse(req.body);
      const note = await storage.updateNote(id, partial as any);
      res.json(note);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Fehler beim Aktualisieren" });
    }
  });

  app.post("/api/notes/:id/complete", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const existing = await storage.getNoteById(id);
      if (!existing) return res.status(404).json({ message: "Notiz nicht gefunden" });
      if (existing.createdById !== userId) return res.status(403).json({ message: "Nur der Ersteller darf erledigen" });
      const note = await storage.completeNote(id);
      res.json(note);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Abschließen" });
    }
  });

  app.post("/api/notes/:id/reopen", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const existing = await storage.getNoteById(id);
      if (!existing) return res.status(404).json({ message: "Notiz nicht gefunden" });
      if (existing.createdById !== userId) return res.status(403).json({ message: "Nur der Ersteller darf reaktivieren" });
      const note = await storage.reopenNote(id);
      res.json(note);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Reaktivieren" });
    }
  });

  app.delete("/api/notes/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const existing = await storage.getNoteById(id);
      if (!existing) return res.status(404).json({ message: "Notiz nicht gefunden" });
      if (existing.createdById !== userId) return res.status(403).json({ message: "Nur der Ersteller darf löschen" });
      await storage.deleteNote(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Löschen" });
    }
  });

  app.post("/api/notes/:id/attachments", requireAuth, taskUpload.single("file"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const note = await storage.getNoteById(id);
      if (!note) return res.status(404).json({ message: "Notiz nicht gefunden" });
      if (note.createdById !== userId) return res.status(403).json({ message: "Nur der Ersteller darf hochladen" });
      if (!req.file) return res.status(400).json({ message: "Keine Datei hochgeladen" });
      const attachment = await storage.createNoteAttachment({
        noteId: id,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer.toString("base64"),
        uploadedById: userId,
      });
      const { data, ...rest } = attachment;
      res.status(201).json(rest);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Upload" });
    }
  });

  app.get("/api/notes/attachments/:attId/download", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const attachment = await storage.getNoteAttachment(Number(req.params.attId));
      if (!attachment) return res.status(404).json({ message: "Anhang nicht gefunden" });
      const note = await storage.getNoteById(attachment.noteId);
      if (!note) return res.status(404).json({ message: "Notiz nicht gefunden" });
      if (note.createdById !== userId && note.visibility !== "public") {
        return res.status(403).json({ message: "Keine Berechtigung" });
      }
      const buf = Buffer.from(attachment.data, "base64");
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      res.send(buf);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Download" });
    }
  });

  app.delete("/api/notes/attachments/:attId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const attachment = await storage.getNoteAttachment(Number(req.params.attId));
      if (!attachment) return res.status(404).json({ message: "Anhang nicht gefunden" });
      const note = await storage.getNoteById(attachment.noteId);
      if (!note || note.createdById !== userId) return res.status(403).json({ message: "Keine Berechtigung" });
      await storage.deleteNoteAttachment(attachment.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Löschen" });
    }
  });

  app.post("/api/notes/:id/convert-to-task", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const id = Number(req.params.id);
      const note = await storage.getNoteById(id);
      if (!note) return res.status(404).json({ message: "Notiz nicht gefunden" });
      if (note.createdById !== userId && note.visibility !== "public") {
        return res.status(403).json({ message: "Keine Berechtigung" });
      }
      const task = await storage.createTask({
        title: note.title,
        description: note.content ?? undefined,
        priority: "mittel",
        status: "offen",
      } as any, userId, [userId]);
      // copy attachments
      for (const att of note.attachments) {
        const full = await storage.getNoteAttachment(att.id);
        if (full) {
          await storage.createTaskAttachment({
            taskId: task.id,
            filename: full.filename,
            mimeType: full.mimeType,
            size: full.size,
            data: full.data,
            uploadedById: userId,
          });
        }
      }
      res.status(201).json(await storage.getTaskById(task.id));
    } catch (err) {
      console.error("Convert note error:", err);
      res.status(500).json({ message: "Fehler beim Umwandeln" });
    }
  });

  // Notification settings
  app.get("/api/notification-settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getNotificationSettings(req.session.userId!);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Laden" });
    }
  });

  app.put("/api/notification-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const enabled = !!req.body?.emailRemindersEnabled;
      const settings = await storage.updateNotificationSettings(userId, { userId, emailRemindersEnabled: enabled });
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Fehler beim Speichern" });
    }
  });

  return httpServer;
}

// ============================================================
// Reminder-Job (von server/index.ts aufgerufen)
// ============================================================

export async function runTaskReminders(): Promise<{ reminders: number; escalations: number }> {
  let reminders = 0;
  let escalations = 0;

  const allUsers = await storage.getAllUsers();
  const userById = new Map(allUsers.map(u => [u.id, u]));

  // 24h Reminder
  const upcoming = await storage.getTasksDueWithinHours(24);
  for (const task of upcoming) {
    if (await storage.hasReminderBeenSent(task.id, "reminder")) continue;
    const recipients: { email: string; name: string }[] = [];
    for (const aid of task.assigneeIds) {
      const u = userById.get(aid);
      if (!u?.email) continue;
      const settings = await storage.getNotificationSettings(u.id);
      if (settings.emailRemindersEnabled) recipients.push({ email: u.email, name: u.name });
    }
    if (recipients.length > 0) {
      await sendTaskReminderEmail({ recipients, task });
      reminders++;
    }
    await storage.logReminderSent(task.id, "reminder");
  }

  // Escalation for overdue
  const overdue = await storage.getOverdueTasks();
  for (const task of overdue) {
    if (await storage.hasReminderBeenSent(task.id, "escalation")) continue;
    const recipients: { email: string; name: string }[] = [];
    for (const aid of task.assigneeIds) {
      const u = userById.get(aid);
      if (!u?.email) continue;
      const settings = await storage.getNotificationSettings(u.id);
      if (settings.emailRemindersEnabled) recipients.push({ email: u.email, name: u.name });
    }
    const creator = userById.get(task.createdById);
    const cc: string[] = [];
    if (creator?.email && !recipients.some(r => r.email === creator.email)) {
      const cs = await storage.getNotificationSettings(creator.id);
      if (cs.emailRemindersEnabled) cc.push(creator.email);
    }
    if (recipients.length > 0 || cc.length > 0) {
      await sendTaskEscalationEmail({ recipients, cc, task });
      escalations++;
    }
    await storage.logReminderSent(task.id, "escalation");
  }

  return { reminders, escalations };
}
