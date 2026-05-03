# Rieprecht Partner-API Dokumentation

## Übersicht

Die Partner-API ermöglicht externen Anwendungen (z.B. Online-Shop, Bestell-App) den Zugriff auf Materialien, Preise, Bestellungen und mehr – ohne direkten Login in die Hauptanwendung.

---

## Authentifizierung

Jeder API-Aufruf benötigt einen API-Schlüssel im HTTP-Header:

```
x-api-key: <dein_api_schlüssel>
```

### Berechtigungsstufen

| Stufe | Beschreibung |
|-------|-------------|
| **read** | Nur Lesen (Materialien, Preise, Dashboard) |
| **write** | Lesen + Schreiben (Bestellungen, Kunden, Preisberechnung) |
| **admin** | Alles (inkl. API-Schlüssel & Einstellungen verwalten) |

---

## Basis-URL

```
https://rieprecht-calculator.replit.app/api/partner/
```

---

## Endpunkte

### Materialien & Preise

#### GET /materials
Alle verfügbaren Materialien (Entsorgung + Schüttgüter).

**Berechtigung:** read

**Antwort:**
```json
[
  {
    "id": 1,
    "name": "Bauschutt (rein)",
    "density": "1.5",
    "disposalCostPerTonne": "15.00",
    "materialType": "entsorgung",
    "isActive": true
  },
  {
    "id": 12,
    "name": "Fallschutzsand",
    "density": "1.5",
    "materialType": "lieferung",
    "purchaseCostPerTonne": "15",
    "grainSize": "0-2 mm",
    "isActive": true
  }
]
```

---

#### GET /price-list
Alle Verkaufspreise (Entsorgung + Schüttgüter).

**Berechtigung:** read

**Antwort:**
```json
[
  {
    "avvCode": "170904",
    "materialName": "Baumischabfall",
    "pricePerTonne": "245.00",
    "pricePerCubicMeter": "196.00",
    "priceType": "entsorgung",
    "isDangerous": false,
    "isActive": true
  },
  {
    "avvCode": "0-2 mm",
    "materialName": "Fallschutzsand 0-2 mm",
    "pricePerTonne": "158.50",
    "pricePerCubicMeter": "237.75",
    "priceType": "lieferung",
    "isActive": true
  }
]
```

---

#### GET /market-prices
Marktpreise von Wettbewerbern.

**Berechtigung:** read

**Optionale Filter:**
- `materialId` – Nur Preise für ein bestimmtes Material
- `containerSize` – Nur Preise für eine bestimmte Containergröße

**Beispiel:**
```
GET /api/partner/market-prices?materialId=5&containerSize=7
```

---

#### POST /calculate-price
Preis für ein Material mit Containergröße und Entfernung berechnen.

**Berechtigung:** write

**Request Body:**
```json
{
  "materialId": 5,
  "containerSize": 7,
  "distance": 25
}
```

**Antwort:**
```json
{
  "materialName": "Baumischabfall",
  "containerSize": 7,
  "distance": 25,
  "calculatedPrice": 485.50,
  "priceBreakdown": {
    "disposalCost": 280.00,
    "transportCost": 85.50,
    "containerPickup": 135.00
  }
}
```

---

#### POST /quote
Angebot erstellen.

**Berechtigung:** read

**Request Body:**
```json
{
  "materialId": 5,
  "containerSize": 7,
  "distance": 25,
  "customerName": "Mustermann GmbH"
}
```

---

### Produkte & Varianten

#### GET /products
Alle Produkte auflisten.

**Berechtigung:** read

#### POST /products
Neues Produkt anlegen.

**Berechtigung:** write

#### PUT /products/:id
Produkt aktualisieren.

**Berechtigung:** write

#### DELETE /products/:id
Produkt löschen.

**Berechtigung:** write

---

#### GET /variants
Alle Produktvarianten auflisten.

#### POST /variants
Neue Variante anlegen.

#### PUT /variants/:id
Variante aktualisieren.

#### DELETE /variants/:id
Variante löschen.

**Berechtigung:** read (GET), write (POST/PUT/DELETE)

---

### Bestellungen

#### GET /orders
Alle Bestellungen auflisten.

**Berechtigung:** read

#### POST /orders
Neue Bestellung anlegen.

**Berechtigung:** write

**Request Body:**
```json
{
  "customerId": 1,
  "productId": 3,
  "variantId": 5,
  "quantity": 1,
  "deliveryDate": "2026-04-15",
  "deliveryAddress": "Musterstraße 1, 21037 Hamburg",
  "notes": "Bitte morgens liefern"
}
```

#### PUT /orders/:id
Bestellung aktualisieren.

#### DELETE /orders/:id
Bestellung löschen.

**Berechtigung:** write

---

### Kunden

#### GET /customers
Alle Kunden auflisten (nutzt die gleiche Kundentabelle wie die Hauptanwendung).

**Berechtigung:** read

#### POST /customers
Neuen Kunden anlegen.

#### PUT /customers/:id
Kunden aktualisieren.

#### DELETE /customers/:id
Kunden löschen.

**Berechtigung:** write

---

### Kalender & Lieferplanung

#### GET /calendar
Liefertermine anzeigen.

#### POST /calendar
Neuen Termin anlegen.

#### PUT /calendar/:id
Termin aktualisieren.

#### DELETE /calendar/:id
Termin löschen.

**Berechtigung:** write

---

### Liefergebiete

#### GET /geo
PLZ-Liefergebiete anzeigen.

#### POST /geo
Neues Liefergebiet anlegen.

#### PUT /geo/:id
Liefergebiet aktualisieren.

#### DELETE /geo/:id
Liefergebiet löschen.

**Berechtigung:** write

---

#### GET /plz-exceptions
Sonderregeln für bestimmte PLZ anzeigen.

#### POST /plz-exceptions
Neue PLZ-Ausnahme anlegen.

#### PUT /plz-exceptions/:id
Ausnahme aktualisieren.

#### DELETE /plz-exceptions/:id
Ausnahme löschen.

**Berechtigung:** write

---

### Verwaltung

#### GET /dashboard
Statistiken: Bestellungen, Umsatz, etc.

**Berechtigung:** read

#### GET /settings
API-Einstellungen anzeigen.

#### PUT /settings
API-Einstellungen ändern.

**Berechtigung:** admin

#### GET /keys
Alle API-Schlüssel auflisten.

#### POST /keys
Neuen API-Schlüssel erstellen.

#### DELETE /keys/:id
API-Schlüssel löschen.

**Berechtigung:** admin

---

## Wichtige Hinweise

### Materialzuordnung
- **Entsorgung**: Materialien werden über den **AVV-Code** zugeordnet
- **Schüttgüter (Lieferung)**: Materialien werden über den **Materialnamen** zugeordnet (kein AVV-Code vorhanden)

### Fehler-Antworten
```json
{
  "message": "Fehlerbeschreibung"
}
```

| HTTP-Status | Bedeutung |
|-------------|-----------|
| 200 | Erfolg |
| 400 | Ungültige Anfrage |
| 401 | Nicht authentifiziert (fehlender/ungültiger API-Key) |
| 403 | Keine Berechtigung (z.B. read-Key versucht zu schreiben) |
| 404 | Nicht gefunden |
| 500 | Serverfehler |

---

## Beispiel mit cURL

```bash
# Materialien abrufen
curl -H "x-api-key: DEIN_API_KEY" \
  https://rieprecht-calculator.replit.app/api/partner/materials

# Preis berechnen
curl -X POST \
  -H "x-api-key: DEIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"materialId": 5, "containerSize": 7, "distance": 25}' \
  https://rieprecht-calculator.replit.app/api/partner/calculate-price
```

