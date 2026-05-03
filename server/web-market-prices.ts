import OpenAI from "openai";
import { z } from "zod";

const PRICE_URLS: Array<{ name: string; url: string; category: string }> = [
  { name: "Curanto Hamburg", url: "https://www.curanto.de/containerdienst-hamburg-735", category: "entsorgung" },
  { name: "ecoservice24 Hamburg", url: "https://www.ecoservice24.com/de/containerdienst/hamburg/", category: "entsorgung" },
  { name: "Der Hamburg Container", url: "https://der-hamburg-container.de/absetzcontainer/", category: "entsorgung" },
  { name: "BUHCK Shop Bauschutt", url: "https://buhck.shop/p/bauschutt-sw10044", category: "entsorgung" },
  { name: "Containerdienst.de Hamburg", url: "https://containerdienst.de/hamburg", category: "entsorgung" },
  { name: "Containerdienst Regional Hamburg", url: "https://www.containerdienst-regional.de/containerdienst-container-bundesland-hamburg.html", category: "entsorgung" },
  { name: "Handwerk Cloud Kies/Schotter", url: "https://www.handwerk.cloud/wissen/allgemein/kies-schotter-kosten", category: "lieferung" },
  { name: "LAG Hamburg Preisliste", url: "https://lag-hamburg.de/de/141171-Preisliste", category: "lieferung" },
];

async function fetchPageContent(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.log(`[web-prices] HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&euro;/g, "€")
      .replace(/&amp;/g, "&")
      .replace(/&#\d+;/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return text.slice(0, 6000);
  } catch (err) {
    console.log(`[web-prices] Failed to fetch ${url}: ${(err as Error).message}`);
    return null;
  }
}

const webPriceSchema = z.object({
  prices: z.array(
    z.object({
      provider: z.string(),
      material: z.string(),
      containerSize: z.number().nullable().optional(),
      unit: z.string().nullable().optional(),
      priceGross: z.number(),
      priceNet: z.number().nullable().optional(),
      includesTransport: z.boolean().nullable().optional(),
      includesDisposal: z.boolean().nullable().optional(),
      notes: z.string().nullable().optional(),
      sourceUrl: z.string().nullable().optional(),
    })
  ),
});

export type WebMarketPrice = z.infer<typeof webPriceSchema>["prices"][number];

export async function fetchWebMarketPrices(
  materialNames: string[],
  containerSizes: number[]
): Promise<WebMarketPrice[]> {
  const allPrices: WebMarketPrice[] = [];
  const fetchResults: Array<{ name: string; url: string; content: string }> = [];

  console.log(`[web-prices] Fetching ${PRICE_URLS.length} price sources...`);

  const fetchPromises = PRICE_URLS.map(async (source) => {
    const content = await fetchPageContent(source.url);
    if (content && content.length > 200) {
      return { name: source.name, url: source.url, content };
    }
    return null;
  });

  const results = await Promise.all(fetchPromises);
  for (const r of results) {
    if (r) fetchResults.push(r);
  }

  console.log(`[web-prices] Successfully fetched ${fetchResults.length}/${PRICE_URLS.length} sources`);

  if (fetchResults.length === 0) return allPrices;

  const combinedContent = fetchResults
    .map((r) => `=== QUELLE: ${r.name} (${r.url}) ===\n${r.content.slice(0, 4000)}`)
    .join("\n\n");

  const materialList = materialNames.join(", ");
  const sizeList = containerSizes.join(", ");

  const prompt = `Du bist ein Datenextraktions-Experte für Containerpreise in Hamburg und Umgebung.

AUFGABE: Analysiere die folgenden Webseitentexte und extrahiere alle konkreten Preise.

GESUCHTE MATERIALIEN: ${materialList}
GESUCHTE CONTAINERGRÖßEN: ${sizeList}m³

WEBSEITENTEXTE:
${combinedContent.slice(0, 14000)}

WICHTIGE REGELN:
1. Extrahiere NUR Preise die EXPLIZIT in den Texten stehen – ERFINDE KEINE Preise!
2. Brutto-Preise (inkl. 19% MwSt.): Berechne Netto = Brutto / 1.19
3. Netto-Preise: Berechne Brutto = Netto × 1.19
4. Ordne Preise den passenden Materialnamen zu (verwende exakte Namen wenn möglich)
5. Beachte: "Bauschutt" = "Bauschutt (rein)", "Baumischabfall" = "Baumischabfall", etc.
6. Gib die Quelle (Anbieter) und URL für jeden Preis an
7. Ein LEERES Array ist besser als erfundene Preise!

JSON-FORMAT:
{
  "prices": [
    {
      "provider": "Anbietername",
      "material": "Materialname (exakt wie in der Liste oben)",
      "containerSize": 7,
      "unit": "m³",
      "priceGross": 450.00,
      "priceNet": 378.15,
      "includesTransport": true,
      "includesDisposal": true,
      "notes": "Quelle: Webseitentext",
      "sourceUrl": "https://..."
    }
  ]
}`;

  try {
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const validation = webPriceSchema.safeParse(parsed);
      if (validation.success) {
        allPrices.push(...validation.data.prices);
        console.log(`[web-prices] Extracted ${allPrices.length} real prices from web sources`);
      } else {
        console.error("[web-prices] Validation failed:", validation.error.message);
      }
    }
  } catch (err) {
    console.error("[web-prices] AI extraction failed:", err);
  }

  return allPrices;
}
