interface BuhckPrice {
  material: string;
  avvNr?: string;
  containerSizeM3: number;
  priceNettoPerM3: number;
  priceBruttoPerM3: number;
}

interface ParsedBuhckData {
  prices: BuhckPrice[];
  transportCost: number;
  mautCost: number;
  co2Cost: number;
  containerGestellung: number;
  lastUpdated: string;
}

const BUHCK_MATERIAL_MAPPING: Record<string, string[]> = {
  "Bauschutt": ["Bauschutt", "Bauschutt (ohne Analyse)"],
  "Beton": ["Beton", "Beton > 60 cm"],
  "Erdaushub": ["Boden Z0", "Boden Z0 (ohne Analyse)", "Erdaushub"],
  "Baumischabfall": ["Baustellenabfälle", "Baustellenabfall"],
  "Baumischabfall (gipshaltig)": ["Baustellenabfälle, gipshaltig"],
  "Grünschnitt": ["Busch- und Gartenabfälle", "Gartenabfälle"],
  "Altholz A1-A3": ["Alt- und Bauholz, unbehandelt", "Altholz A1-A3"],
  "Altholz A4": ["Alt- und Bauholz, behandelt", "Altholz A4"],
  "Sperrmüll": ["Sperrmüll"],
  "Dachpappe": ["Dachpappe"],
  "Dämmwolle": ["Dämmmaterial", "KMF-Wolle", "Mineralwolle"],
  "Gipsabfall": ["Gipskartonplatten", "Baustoffe auf Gipsbasis"],
  "Ytong": ["Ytong", "Ytong-Steine"],
  "Stubben": ["Stubben und Stammholz"],
};

const BUHCK_PRICES_2025: BuhckPrice[] = [
  { material: "Bauschutt", containerSizeM3: 3, priceNettoPerM3: 364.00 / 3, priceBruttoPerM3: 433.16 / 3 },
  { material: "Bauschutt", containerSizeM3: 7, priceNettoPerM3: 612.00 / 7, priceBruttoPerM3: 728.28 / 7 },
  { material: "Bauschutt", containerSizeM3: 10, priceNettoPerM3: 798.00 / 10, priceBruttoPerM3: 949.62 / 10 },
  
  { material: "Erdaushub", containerSizeM3: 3, priceNettoPerM3: 392.80 / 3, priceBruttoPerM3: 467.43 / 3 },
  { material: "Erdaushub", containerSizeM3: 7, priceNettoPerM3: 679.20 / 7, priceBruttoPerM3: 808.25 / 7 },
  
  { material: "Baumischabfall", containerSizeM3: 3, priceNettoPerM3: 404.80 / 3, priceBruttoPerM3: 481.71 / 3 },
  { material: "Baumischabfall", containerSizeM3: 7, priceNettoPerM3: 751.20 / 7, priceBruttoPerM3: 893.93 / 7 },
  { material: "Baumischabfall", containerSizeM3: 10, priceNettoPerM3: 1011.00 / 10, priceBruttoPerM3: 1203.09 / 10 },
  
  { material: "Grünschnitt", containerSizeM3: 3, priceNettoPerM3: 238.30 / 3, priceBruttoPerM3: 283.58 / 3 },
  { material: "Grünschnitt", containerSizeM3: 7, priceNettoPerM3: 362.70 / 7, priceBruttoPerM3: 431.61 / 7 },
  { material: "Grünschnitt", containerSizeM3: 10, priceNettoPerM3: 456.00 / 10, priceBruttoPerM3: 542.64 / 10 },
  
  { material: "Altholz A1-A3", containerSizeM3: 3, priceNettoPerM3: 238.30 / 3, priceBruttoPerM3: 283.58 / 3 },
  { material: "Altholz A1-A3", containerSizeM3: 7, priceNettoPerM3: 362.70 / 7, priceBruttoPerM3: 431.61 / 7 },
  { material: "Altholz A1-A3", containerSizeM3: 10, priceNettoPerM3: 456.00 / 10, priceBruttoPerM3: 542.64 / 10 },
  
  { material: "Altholz A4", containerSizeM3: 3, priceNettoPerM3: 324.10 / 3, priceBruttoPerM3: 385.68 / 3 },
  { material: "Altholz A4", containerSizeM3: 7, priceNettoPerM3: 562.90 / 7, priceBruttoPerM3: 669.85 / 7 },
  { material: "Altholz A4", containerSizeM3: 10, priceNettoPerM3: 742.00 / 10, priceBruttoPerM3: 882.98 / 10 },
  
  { material: "Gipsabfall", containerSizeM3: 3, priceNettoPerM3: 298.60 / 3, priceBruttoPerM3: 355.33 / 3 },
  { material: "Gipsabfall", containerSizeM3: 7, priceNettoPerM3: 503.40 / 7, priceBruttoPerM3: 599.05 / 7 },
  { material: "Gipsabfall", containerSizeM3: 10, priceNettoPerM3: 657.00 / 10, priceBruttoPerM3: 781.83 / 10 },
  
  { material: "Dachpappe", containerSizeM3: 3, priceNettoPerM3: 853.90 / 3, priceBruttoPerM3: 1016.14 / 3 },
  { material: "Dachpappe", containerSizeM3: 7, priceNettoPerM3: 1799.10 / 7, priceBruttoPerM3: 2140.93 / 7 },
  { material: "Dachpappe", containerSizeM3: 10, priceNettoPerM3: 2508.00 / 10, priceBruttoPerM3: 2984.52 / 10 },
  
  { material: "Dämmwolle", containerSizeM3: 3, priceNettoPerM3: 485.20 / 3, priceBruttoPerM3: 577.39 / 3 },
  { material: "Dämmwolle", containerSizeM3: 7, priceNettoPerM3: 938.80 / 7, priceBruttoPerM3: 1117.17 / 7 },
  { material: "Dämmwolle", containerSizeM3: 10, priceNettoPerM3: 1279.00 / 10, priceBruttoPerM3: 1522.01 / 10 },
  
  { material: "Stubben", containerSizeM3: 3, priceNettoPerM3: 270.10 / 3, priceBruttoPerM3: 321.42 / 3 },
  { material: "Stubben", containerSizeM3: 7, priceNettoPerM3: 436.90 / 7, priceBruttoPerM3: 519.91 / 7 },
  { material: "Stubben", containerSizeM3: 10, priceNettoPerM3: 562.00 / 10, priceBruttoPerM3: 668.78 / 10 },
];

const BUHCK_ADDITIONAL_COSTS = {
  mautPerTransport: 16.95,
  co2PerTransport: 9.70,
  containerGestellung: 32.80,
};

export function getBuhckPrices(): ParsedBuhckData {
  return {
    prices: BUHCK_PRICES_2025,
    transportCost: 0,
    mautCost: BUHCK_ADDITIONAL_COSTS.mautPerTransport,
    co2Cost: BUHCK_ADDITIONAL_COSTS.co2PerTransport,
    containerGestellung: BUHCK_ADDITIONAL_COSTS.containerGestellung,
    lastUpdated: "2025-01-01",
  };
}

export function findBuhckPriceForMaterial(
  materialName: string, 
  containerSizeM3: number
): { priceNetto: number; priceBrutto: number; source: string } | null {
  const data = getBuhckPrices();
  
  const normalizedMaterial = materialName.toLowerCase().trim();
  
  let matchedBuhckMaterial: string | null = null;
  
  for (const [buhckName, aliases] of Object.entries(BUHCK_MATERIAL_MAPPING)) {
    const allNames = [buhckName, ...aliases].map(n => n.toLowerCase());
    
    if (allNames.some(name => name === normalizedMaterial)) {
      matchedBuhckMaterial = buhckName;
      break;
    }
    
    if (normalizedMaterial.length >= 5 && allNames.some(name => 
      normalizedMaterial.includes(name) || name.includes(normalizedMaterial)
    )) {
      matchedBuhckMaterial = buhckName;
      break;
    }
  }
  
  if (!matchedBuhckMaterial) {
    return null;
  }
  
  const exactMatch = data.prices.find(
    p => p.material === matchedBuhckMaterial && p.containerSizeM3 === containerSizeM3
  );
  
  if (!exactMatch) {
    return null;
  }
  
  const baseNetto = exactMatch.priceNettoPerM3 * containerSizeM3;
  const additionalCosts = data.mautCost + data.co2Cost + data.containerGestellung;
  const totalNetto = baseNetto + additionalCosts;
  const totalBrutto = totalNetto * 1.19;
  
  return {
    priceNetto: Math.round(totalNetto * 100) / 100,
    priceBrutto: Math.round(totalBrutto * 100) / 100,
    source: "BUHCK Preisliste 2025"
  };
}

export function getAllBuhckPricesForContainerSizes(containerSizes: number[]): Array<{
  material: string;
  containerSizeM3: number;
  priceNetto: number;
  priceBrutto: number;
  source: string;
}> {
  const data = getBuhckPrices();
  const results: Array<{
    material: string;
    containerSizeM3: number;
    priceNetto: number;
    priceBrutto: number;
    source: string;
  }> = [];
  
  const materials = Array.from(new Set(data.prices.map(p => p.material)));
  
  for (const material of materials) {
    for (const size of containerSizes) {
      const price = findBuhckPriceForMaterial(material, size);
      if (price) {
        results.push({
          material,
          containerSizeM3: size,
          ...price
        });
      }
    }
  }
  
  return results;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}
