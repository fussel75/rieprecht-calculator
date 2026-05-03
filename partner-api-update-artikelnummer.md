# API-Update: Neues Feld „articleNumber" (Artikelnummer)

## Was hat sich geändert?

Wir haben unseren Materialien ein neues Feld **„articleNumber"** (Artikelnummer) hinzugefügt. Jedes Material/Produkt erhält eine eigene, von uns vergebene Artikelnummer (z.B. „P-001", „RE-7-BS" o.ä.). Diese Artikelnummer ist bei Einkaufs- und Verkaufspreisen identisch, da sie direkt am Material hinterlegt ist.

## Welche API-Endpoints sind betroffen?

### 1. `GET /api/partner/materials`
Das Feld `articleNumber` ist jetzt in jedem Material-Objekt enthalten.

**Beispiel-Antwort (Auszug):**
```json
{
  "id": 11,
  "name": "Bauschutt",
  "articleNumber": "P-001",
  "avvNumber": "17 01 07",
  "density": "1.00",
  "materialType": "entsorgung",
  ...
}
```

### 2. `GET /api/partner/price-list`
Auch die Preisliste liefert jetzt die `articleNumber` mit.

**Beispiel-Antwort (Auszug):**
```json
{
  "materialName": "Bauschutt",
  "articleNumber": "P-001",
  "avvCode": "17 01 07",
  "materialId": 11,
  "pricePerTonne": 38.5,
  "pricePerCubicMeter": 40.15,
  ...
}
```

### 3. `POST /api/partner/calculate-price`
Die Preisberechnung enthält ebenfalls die `articleNumber`.

**Beispiel-Antwort (Auszug):**
```json
{
  "material": "Bauschutt",
  "articleNumber": "P-001",
  "avvCode": "17 01 07",
  "containerSize": 7,
  "netPrice": 416.05,
  "costBreakdown": { ... },
  ...
}
```

## Was muss im Webshop gemacht werden?

1. **Artikelnummer in der Produktanzeige einpflegen**: Beim Abrufen der Materialien bzw. Preisliste steht jetzt das Feld `articleNumber` zur Verfügung. Dieses kann im Webshop bei den Produkten angezeigt werden (z.B. unter dem Produktnamen oder in der Detailansicht).

2. **Artikelnummer bei Bestellungen mitführen**: Wenn der Kunde eine Bestellung aufgibt, kann die `articleNumber` als Referenz in der Bestellung gespeichert werden. Das erleichtert die Zuordnung zwischen Webshop und unserer internen Verwaltung.

3. **Datentyp**: `articleNumber` ist ein String (Text) oder `null`, wenn noch keine Artikelnummer vergeben wurde. Ihr solltet also darauf prüfen, ob der Wert vorhanden ist, bevor ihr ihn anzeigt.

## Hinweis

Die Artikelnummern werden von uns schrittweise vergeben. Anfangs kann das Feld bei einigen Materialien noch `null` sein. Sobald wir die Nummern hinterlegt haben, sind sie über die API automatisch verfügbar — es ist kein weiteres Update nötig.

## Zusätzliches Update: `costBreakdown` (zur Erinnerung)

Falls noch nicht integriert: Der `calculate-price`-Endpoint liefert seit kurzem auch eine detaillierte Kostenaufschlüsselung mit:

```json
"costBreakdown": {
  "baseCost": 338.02,
  "variableCost": 198.55,
  "transportCost": 23.55,
  "disposalCost": 175.00,
  "fixedCostShare": 139.47,
  "fixedCostPerContainer": 139.47,
  "totalMonthlyFixed": 16736.67,
  "containersPerMonth": 120
}
```

Damit kann der Webshop intern die Margen und Selbstkosten darstellen.
