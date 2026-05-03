interface JunkbustersPrice {
  material: string;
  avvNr: string;
  priceNetto: number;
  unit: "m3" | "tonne";
}

const JUNKBUSTERS_MATERIAL_MAPPING: Record<string, string[]> = {
  "Baumischabfall": ["Baumischabfall", "Baustellenabfälle", "Baustellenabfall", "Baumisch"],
  "Baumischabfall schwer sortierbar": ["Baumischabfall schwer sortierbar"],
  "Sperrmüll": ["Sperrmüll"],
  "Bauschutt": ["Bauschutt", "Bauschutt (ohne Analyse)"],
  "Bauschutt verunreinigt": ["Bauschutt verunreinigt"],
  "Betonbruch": ["Betonbruch kleiner als 40 cm", "Beton", "Betonbruch"],
  "Erdaushub": ["Boden unbeprobt", "Boden Z0", "Erdaushub"],
  "Boden mit Grasnarbe": ["Boden mit Grasnarbe"],
  "Altholz A1-A3": ["Holz A1-A3", "Altholz A1-A3", "Alt- und Bauholz, unbehandelt"],
  "Altholz A4": ["Holz A4", "Altholz A4", "Alt- und Bauholz, behandelt"],
  "Gipsabfall": ["Gipsbaustoffe", "Gipskartonplatten", "Baustoffe auf Gipsbasis", "Gipsabfall"],
  "Gipsabfall verunreinigt": ["Gipsbaustoffe verunreinigt"],
  "Grünschnitt": ["Gartenabfälle", "Grünschnitt", "Busch- und Gartenabfälle"],
  "Stubben": ["Wurzeln", "Stubben", "Stubben und Stammholz"],
  "Dachpappe": ["Dachpappe", "Dachpappe/Bitumen (teerfrei)"],
  "Dämmwolle": ["KMF / Dämmwolle", "Dämmmaterial", "KMF-Wolle", "Mineralwolle", "Dämmwolle"],
  "KMF Deckenplatten": ["KMF Deckenplatten"],
  "Styropor": ["Styropor"],
  "Papier und Pappe": ["Papier und Pappe"],
  "Siedlungsabfälle": ["gemischte Siedlungsabfälle", "Siedlungsabfälle"],
  "Bioabfall": ["biologisch abbaubare Abfälle", "Bioabfall"],
  "Asbest": ["Asbest"],
};

const JUNKBUSTERS_PRICES_2026: JunkbustersPrice[] = [
  { material: "Baumischabfall", avvNr: "170904", priceNetto: 79.00, unit: "m3" },
  { material: "Baumischabfall schwer sortierbar", avvNr: "170904", priceNetto: 385.00, unit: "tonne" },
  { material: "Sperrmüll", avvNr: "200307", priceNetto: 62.00, unit: "m3" },
  { material: "Bauschutt", avvNr: "170107", priceNetto: 61.25, unit: "tonne" },
  { material: "Bauschutt verunreinigt", avvNr: "170107", priceNetto: 195.00, unit: "tonne" },
  { material: "Betonbruch", avvNr: "170101", priceNetto: 18.00, unit: "tonne" },
  { material: "Erdaushub", avvNr: "170504", priceNetto: 47.00, unit: "tonne" },
  { material: "Boden mit Grasnarbe", avvNr: "170504", priceNetto: 59.00, unit: "tonne" },
  { material: "Altholz A1-A3", avvNr: "170201", priceNetto: 79.00, unit: "tonne" },
  { material: "Altholz A4", avvNr: "170204", priceNetto: 159.00, unit: "tonne" },
  { material: "Gipsabfall", avvNr: "170802", priceNetto: 127.00, unit: "tonne" },
  { material: "Gipsabfall verunreinigt", avvNr: "170904", priceNetto: 185.00, unit: "tonne" },
  { material: "Grünschnitt", avvNr: "200201", priceNetto: 29.00, unit: "m3" },
  { material: "Stubben", avvNr: "200138", priceNetto: 45.00, unit: "m3" },
  { material: "Dachpappe", avvNr: "170303", priceNetto: 475.00, unit: "tonne" },
  { material: "Dämmwolle", avvNr: "170603", priceNetto: 79.00, unit: "m3" },
  { material: "KMF Deckenplatten", avvNr: "170603", priceNetto: 140.00, unit: "m3" },
  { material: "Styropor", avvNr: "170604", priceNetto: 75.00, unit: "m3" },
  { material: "Papier und Pappe", avvNr: "200101", priceNetto: 25.00, unit: "tonne" },
  { material: "Siedlungsabfälle", avvNr: "200301", priceNetto: 295.00, unit: "tonne" },
  { material: "Bioabfall", avvNr: "200108", priceNetto: 29.00, unit: "m3" },
  { material: "Asbest", avvNr: "170605", priceNetto: 195.00, unit: "m3" },
];

const JUNKBUSTERS_TRANSPORT = {
  lieferung: 25.00,
  abholungWechsel: 165.00,
  mietfreiTage: 21,
  mieteProTag: 3.00,
};

export interface JunkbustersMaterial {
  density?: number;
}

export function findJunkbustersPriceForMaterial(
  materialName: string,
  containerSizeM3: number,
  density?: number
): { priceNetto: number; priceBrutto: number; source: string } | null {
  const normalizedMaterial = materialName.toLowerCase().trim();

  let matchedJunkbustersMaterial: string | null = null;

  for (const [jbName, aliases] of Object.entries(JUNKBUSTERS_MATERIAL_MAPPING)) {
    const allNames = [jbName, ...aliases].map(n => n.toLowerCase());

    if (allNames.some(name => name === normalizedMaterial)) {
      matchedJunkbustersMaterial = jbName;
      break;
    }

    if (normalizedMaterial.length >= 5 && allNames.some(name =>
      normalizedMaterial.includes(name) || name.includes(normalizedMaterial)
    )) {
      matchedJunkbustersMaterial = jbName;
      break;
    }
  }

  if (!matchedJunkbustersMaterial) {
    return null;
  }

  const priceEntry = JUNKBUSTERS_PRICES_2026.find(p => p.material === matchedJunkbustersMaterial);
  if (!priceEntry) {
    return null;
  }

  let materialCost: number;

  if (priceEntry.unit === "m3") {
    materialCost = priceEntry.priceNetto * containerSizeM3;
  } else {
    if (!density || density <= 0) {
      return null;
    }
    const weightTonnes = containerSizeM3 * density;
    materialCost = priceEntry.priceNetto * weightTonnes;
  }

  const totalNetto = materialCost + JUNKBUSTERS_TRANSPORT.abholungWechsel;
  const totalBrutto = totalNetto * 1.19;

  return {
    priceNetto: Math.round(totalNetto * 100) / 100,
    priceBrutto: Math.round(totalBrutto * 100) / 100,
    source: "Junkbusters Preisliste 02/2026",
  };
}

export function getJunkbustersTransportPrices() {
  return JUNKBUSTERS_TRANSPORT;
}
