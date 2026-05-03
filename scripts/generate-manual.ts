import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const generateManual = async () => {
  const logoPath = path.resolve(process.cwd(), 'client/public/apple-touch-icon.png');
  const logoBase64 = fs.readFileSync(logoPath).toString('base64');
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    h1 {
      color: #3D9970;
      font-size: 24pt;
      margin-top: 0;
      border-bottom: 3px solid #3D9970;
      padding-bottom: 10px;
    }
    h2 {
      color: #3D9970;
      font-size: 16pt;
      margin-top: 30px;
      border-bottom: 1px solid #3D9970;
      padding-bottom: 5px;
    }
    h3 {
      color: #2d7a59;
      font-size: 13pt;
      margin-top: 20px;
    }
    .formula-box {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-left: 4px solid #3D9970;
      padding: 15px;
      margin: 15px 0;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 10pt;
    }
    .example-box {
      background: #e8f5e9;
      border: 1px solid #a5d6a7;
      padding: 15px;
      margin: 15px 0;
      border-radius: 5px;
    }
    .example-box h4 {
      margin-top: 0;
      color: #2e7d32;
    }
    .warning-box {
      background: #fff3e0;
      border: 1px solid #ffcc80;
      padding: 15px;
      margin: 15px 0;
      border-radius: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background: #3D9970;
      color: white;
    }
    tr:nth-child(even) { background: #f9f9f9; }
    .page-break { page-break-before: always; }
    ul, ol { margin: 10px 0 10px 20px; }
    li { margin: 5px 0; }
    .toc { margin: 20px 0; }
    .toc a { color: #3D9970; text-decoration: none; }
    .toc li { margin: 8px 0; }
    .screenshot-placeholder {
      background: #f0f0f0;
      border: 2px dashed #ccc;
      padding: 40px;
      text-align: center;
      color: #999;
      margin: 15px 0;
    }
    .nav-icon {
      display: inline-block;
      width: 24px;
      height: 24px;
      background: #3D9970;
      color: white;
      text-align: center;
      line-height: 24px;
      border-radius: 4px;
      margin-right: 5px;
      font-size: 10pt;
    }
  </style>
</head>
<body>

  <h1>Rieprecht Container-Kalkulator</h1>
  <h2 style="border: none; color: #666; font-size: 14pt; margin-top: 5px;">Bedienungsanleitung</h2>
  
  <p style="margin-top: 30px;">
    <strong>Version:</strong> 1.0<br>
    <strong>Stand:</strong> Januar 2026<br>
    <strong>Erstellt für:</strong> Rieprecht Entsorgung & Transport GmbH
  </p>

  <div class="toc">
    <h3>Inhaltsverzeichnis</h3>
    <ol>
      <li><a href="#einfuehrung">Einführung</a></li>
      <li><a href="#navigation">Navigation & Aufbau</a></li>
      <li><a href="#start">Startseite</a></li>
      <li><a href="#rechner">Preisrechner</a></li>
      <li><a href="#ressourcen">Ressourcen (Fahrzeuge, Personal, Container)</a></li>
      <li><a href="#kosten">Kostenverwaltung</a></li>
      <li><a href="#material">Materialien</a></li>
      <li><a href="#planung">Planung & Prognose</a></li>
      <li><a href="#fahrten">Fahrten-Protokoll</a></li>
      <li><a href="#berechnungen">Berechnungsformeln im Detail</a></li>
    </ol>
  </div>

  <div class="page-break"></div>

  <h2 id="einfuehrung">1. Einführung</h2>
  <p>
    Der Rieprecht Container-Kalkulator ist ein internes Kalkulationstool zur Berechnung 
    von Netto-Preisen für Containerdienstleistungen. Die Anwendung berücksichtigt alle 
    relevanten Betriebskosten und ermöglicht eine präzise Preisgestaltung mit 
    einstellbarer Gewinnmarge.
  </p>

  <h3>Hauptfunktionen</h3>
  <ul>
    <li><strong>Preisrechner:</strong> Dynamische Preiskalkulation basierend auf Ihren echten Betriebskosten</li>
    <li><strong>Ressourcenverwaltung:</strong> Fahrzeuge, Personal und Container erfassen</li>
    <li><strong>Kostenverwaltung:</strong> Variable Kosten wie Diesel, Maut etc.</li>
    <li><strong>Materialverwaltung:</strong> Abfallarten mit Dichte und Entsorgungskosten</li>
    <li><strong>Planung:</strong> 12-Monats-Prognose und Ist/Soll-Vergleich</li>
    <li><strong>Fahrten-Protokoll:</strong> Tatsächliche Fahrten dokumentieren</li>
  </ul>

  <div class="warning-box">
    <strong>Wichtig:</strong> Alle Preise in dieser Anwendung sind NETTO-Preise (ohne MwSt.).
  </div>

  <h2 id="navigation">2. Navigation & Aufbau</h2>
  <p>Die Navigation befindet sich am unteren Bildschirmrand und enthält 7 Bereiche:</p>
  
  <table>
    <tr>
      <th>Symbol</th>
      <th>Name</th>
      <th>Funktion</th>
    </tr>
    <tr>
      <td><span class="nav-icon">🏠</span></td>
      <td>Start</td>
      <td>Übersicht und Schnellzugriff</td>
    </tr>
    <tr>
      <td><span class="nav-icon">🧮</span></td>
      <td>Rechner</td>
      <td>Preiskalkulation durchführen</td>
    </tr>
    <tr>
      <td><span class="nav-icon">📦</span></td>
      <td>Ressourcen</td>
      <td>Fahrzeuge, Personal, Container verwalten</td>
    </tr>
    <tr>
      <td><span class="nav-icon">💰</span></td>
      <td>Kosten</td>
      <td>Variable Kosten (Diesel, Maut) einstellen</td>
    </tr>
    <tr>
      <td><span class="nav-icon">♻️</span></td>
      <td>Material</td>
      <td>Abfallarten und Entsorgungskosten</td>
    </tr>
    <tr>
      <td><span class="nav-icon">📊</span></td>
      <td>Planung</td>
      <td>Kapazitätsplanung und Prognosen</td>
    </tr>
    <tr>
      <td><span class="nav-icon">🚚</span></td>
      <td>Fahrten</td>
      <td>Durchgeführte Fahrten protokollieren</td>
    </tr>
  </table>

  <div class="page-break"></div>

  <h2 id="start">3. Startseite</h2>
  <p>
    Die Startseite zeigt eine Übersicht der wichtigsten Kennzahlen:
  </p>
  <ul>
    <li><strong>Aktive Fahrzeuge:</strong> Anzahl der einsatzbereiten LKW</li>
    <li><strong>Mitarbeiter:</strong> Anzahl des aktiven Personals</li>
    <li><strong>Monatliche Fixkosten:</strong> Summe aller Fahrzeug- und Personalkosten</li>
    <li><strong>Schnellzugriff:</strong> Buttons zu den wichtigsten Funktionen</li>
  </ul>

  <h2 id="rechner">4. Preisrechner</h2>
  <p>
    Der Preisrechner ist das Herzstück der Anwendung. Hier berechnen Sie den empfohlenen 
    Netto-Preis für eine Containerlieferung.
  </p>

  <h3>Eingabefelder</h3>
  <table>
    <tr>
      <th>Feld</th>
      <th>Beschreibung</th>
      <th>Beispiel</th>
    </tr>
    <tr>
      <td>Kundenreferenz</td>
      <td>Optional - Name oder Projektnummer</td>
      <td>"Müller Baustelle"</td>
    </tr>
    <tr>
      <td>Abfallart</td>
      <td>Material auswählen</td>
      <td>Bauschutt, Altholz, etc.</td>
    </tr>
    <tr>
      <td>Containergröße</td>
      <td>7m³ oder 10m³ Absetzcontainer</td>
      <td>7m³</td>
    </tr>
    <tr>
      <td>Entfernung</td>
      <td>Einfache Strecke in km</td>
      <td>15 km</td>
    </tr>
    <tr>
      <td>Menge</td>
      <td>Volumen (m³) oder Gewicht (t)</td>
      <td>7 m³</td>
    </tr>
    <tr>
      <td>Zielmarge</td>
      <td>Gewünschter Gewinn in %</td>
      <td>30%</td>
    </tr>
  </table>

  <h3>Anzeige der Ergebnisse</h3>
  <p>Der Rechner zeigt:</p>
  <ul>
    <li><strong>Berechneter Preis (Netto):</strong> Der empfohlene Endpreis</li>
    <li><strong>Basiskosten:</strong> Alle Kosten vor Marge</li>
    <li><strong>Marge:</strong> Ihr Gewinn in Euro</li>
  </ul>

  <div class="page-break"></div>

  <h2 id="ressourcen">5. Ressourcen</h2>
  <p>Hier verwalten Sie alle physischen Ressourcen Ihres Betriebs.</p>

  <h3>5.1 Fahrzeuge</h3>
  <p>Erfassen Sie alle LKW und Anhänger mit deren monatlichen Kosten:</p>
  <table>
    <tr>
      <th>Feld</th>
      <th>Beschreibung</th>
    </tr>
    <tr>
      <td>Name</td>
      <td>Bezeichnung des Fahrzeugs</td>
    </tr>
    <tr>
      <td>Typ</td>
      <td>LKW oder Anhänger</td>
    </tr>
    <tr>
      <td>Kennzeichen</td>
      <td>Amtliches Kennzeichen</td>
    </tr>
    <tr>
      <td>Kaufdatum</td>
      <td>Ab wann fallen Kosten an?</td>
    </tr>
    <tr>
      <td>Leasing/Monat</td>
      <td>Monatliche Leasingrate</td>
    </tr>
    <tr>
      <td>Versicherung/Monat</td>
      <td>Monatliche Versicherung</td>
    </tr>
    <tr>
      <td>Wartung/Monat</td>
      <td>Durchschnittliche Wartungskosten</td>
    </tr>
  </table>

  <div class="warning-box">
    <strong>Hinweis zum Kaufdatum:</strong> Fahrzeuge werden erst ab dem eingetragenen 
    Kaufdatum in die Kostenberechnung einbezogen. Ein Fahrzeug mit Kaufdatum in der 
    Zukunft verursacht noch keine Kosten.
  </div>

  <h3>5.2 Personal</h3>
  <p>Erfassen Sie alle Mitarbeiter:</p>
  <table>
    <tr>
      <th>Feld</th>
      <th>Beschreibung</th>
    </tr>
    <tr>
      <td>Name</td>
      <td>Name des Mitarbeiters</td>
    </tr>
    <tr>
      <td>Rolle</td>
      <td>Fahrer, Geschäftsführer, Büro</td>
    </tr>
    <tr>
      <td>Einstellungsdatum</td>
      <td>Ab wann fallen Kosten an?</td>
    </tr>
    <tr>
      <td>Gehalt/Monat</td>
      <td>Brutto-Monatsgehalt</td>
    </tr>
  </table>

  <div class="warning-box">
    <strong>Hinweis zum Einstellungsdatum:</strong> Mitarbeiter werden erst ab dem 
    eingetragenen Einstellungsdatum in die Kostenberechnung einbezogen. Ein Mitarbeiter 
    mit Einstellungsdatum 01.05.2026 verursacht bis dahin keine Kosten.
  </div>

  <h3>5.3 Container</h3>
  <p>Erfassen Sie Ihren Container-Bestand (zur Übersicht, beeinflusst nicht die Kalkulation).</p>

  <div class="page-break"></div>

  <h2 id="kosten">6. Kostenverwaltung</h2>
  <p>Hier stellen Sie variable Kosten ein, die für die Preisberechnung verwendet werden:</p>

  <table>
    <tr>
      <th>Kostenfaktor</th>
      <th>Beschreibung</th>
      <th>Beispielwert</th>
    </tr>
    <tr>
      <td>Diesel Preis</td>
      <td>Aktueller Dieselpreis pro Liter</td>
      <td>€1,70/L</td>
    </tr>
    <tr>
      <td>Verbrauch (L/100km)</td>
      <td>Durchschnittlicher Kraftstoffverbrauch</td>
      <td>30 L/100km</td>
    </tr>
    <tr>
      <td>Maut / Gebühren</td>
      <td>Mautkosten pro Kilometer</td>
      <td>€0,19/km</td>
    </tr>
  </table>

  <h2 id="material">7. Materialien</h2>
  <p>
    Verwalten Sie hier alle Abfallarten mit deren Eigenschaften:
  </p>

  <table>
    <tr>
      <th>Feld</th>
      <th>Beschreibung</th>
      <th>Beispiel</th>
    </tr>
    <tr>
      <td>Name</td>
      <td>Bezeichnung der Abfallart</td>
      <td>Bauschutt</td>
    </tr>
    <tr>
      <td>Dichte (t/m³)</td>
      <td>Umrechnungsfaktor Volumen zu Gewicht</td>
      <td>1,50 t/m³</td>
    </tr>
    <tr>
      <td>€/Tonne</td>
      <td>Netto-Deponiekosten pro Tonne</td>
      <td>€15/t</td>
    </tr>
  </table>

  <div class="example-box">
    <h4>Beispiel: Umrechnung m³ zu Tonnen</h4>
    <p>
      Ein 7m³ Container mit Bauschutt (Dichte 1,50 t/m³):<br>
      <strong>Gewicht = 7 m³ × 1,50 t/m³ = 10,5 Tonnen</strong>
    </p>
  </div>

  <div class="page-break"></div>

  <h2 id="planung">8. Planung & Prognose</h2>

  <h3>Kapazitätsplanung</h3>
  <p>Stellen Sie hier Ihre geplante Kapazität ein:</p>
  <table>
    <tr>
      <th>Einstellung</th>
      <th>Beschreibung</th>
    </tr>
    <tr>
      <td>Container/Tag</td>
      <td>Wie viele Container pro Tag geplant sind</td>
    </tr>
    <tr>
      <td>Aktive LKWs</td>
      <td>Anzahl eingesetzter Fahrzeuge</td>
    </tr>
    <tr>
      <td>Arbeitstage/Woche</td>
      <td>5 Tage (Mo-Fr) oder 6 Tage (Mo-Sa)</td>
    </tr>
    <tr>
      <td>Zielmarge</td>
      <td>Gewünschte Gewinnmarge</td>
    </tr>
  </table>

  <h3>Ist vs. Soll</h3>
  <p>
    Vergleich zwischen geplanten und tatsächlich durchgeführten Containern 
    im aktuellen Monat. Die tatsächlichen Zahlen kommen aus dem Fahrten-Protokoll.
  </p>

  <h2 id="fahrten">9. Fahrten-Protokoll</h2>
  <p>
    Dokumentieren Sie hier jede tatsächlich durchgeführte Containerfahrt:
  </p>
  <table>
    <tr>
      <th>Feld</th>
      <th>Beschreibung</th>
    </tr>
    <tr>
      <td>Datum</td>
      <td>Wann wurde die Fahrt durchgeführt?</td>
    </tr>
    <tr>
      <td>Material</td>
      <td>Welche Abfallart?</td>
    </tr>
    <tr>
      <td>Containergröße</td>
      <td>7m³ oder 10m³</td>
    </tr>
    <tr>
      <td>Entfernung</td>
      <td>Einfache Strecke in km</td>
    </tr>
    <tr>
      <td>Tatsächlicher Preis</td>
      <td>Was wurde dem Kunden berechnet?</td>
    </tr>
  </table>

  <div class="page-break"></div>

  <h2 id="berechnungen">10. Berechnungsformeln im Detail</h2>

  <h3>10.1 Transportkosten</h3>
  <p>Die Transportkosten berechnen sich aus Kraftstoff und Maut für Hin- und Rückfahrt:</p>
  
  <div class="formula-box">
    <strong>Kraftstoffkosten pro km</strong> = (Verbrauch L/100km ÷ 100) × Dieselpreis<br><br>
    <strong>Transportkosten</strong> = (Kraftstoffkosten/km + Maut/km) × Entfernung × 2
  </div>

  <div class="example-box">
    <h4>Beispiel: Transport 15 km</h4>
    <p>
      Verbrauch: 30 L/100km, Diesel: €1,70/L, Maut: €0,19/km<br><br>
      Kraftstoff/km = (30 ÷ 100) × 1,70 = <strong>€0,51/km</strong><br>
      Gesamt/km = 0,51 + 0,19 = <strong>€0,70/km</strong><br>
      Transportkosten = 0,70 × 15 × 2 = <strong>€21,00</strong>
    </p>
  </div>

  <h3>10.2 Fixkosten pro Container</h3>
  <p>Die monatlichen Fixkosten werden auf die geplanten Container verteilt:</p>

  <div class="formula-box">
    <strong>Monatliche Fixkosten</strong> = Fahrzeugkosten + Personalkosten<br><br>
    <strong>Container pro Monat</strong> = Container/Tag × Arbeitstage/Monat<br><br>
    <strong>Fixkosten pro Container</strong> = Monatliche Fixkosten ÷ Container pro Monat
  </div>

  <div class="example-box">
    <h4>Beispiel: Fixkostenverteilung</h4>
    <p>
      Fahrzeuge: €7.488/M, Personal: €5.500/M (nur aktive Mitarbeiter)<br>
      Container/Tag: 8, Arbeitstage: 20 (5-Tage-Woche)<br><br>
      Monatliche Fixkosten = 7.488 + 5.500 = <strong>€12.988</strong><br>
      Container/Monat = 8 × 20 = <strong>160</strong><br>
      Fixkosten/Container = 12.988 ÷ 160 = <strong>€81,18</strong>
    </p>
  </div>

  <div class="warning-box">
    <strong>Wichtig:</strong> Nur Mitarbeiter und Fahrzeuge, deren Einstellungs-/Kaufdatum 
    bereits erreicht ist, werden in die Fixkosten eingerechnet.
  </div>

  <div class="page-break"></div>

  <h3>10.3 Entsorgungskosten</h3>
  <p>Die Entsorgungskosten basieren auf dem Gewicht und dem Deponiepreis:</p>

  <div class="formula-box">
    <strong>Gewicht (Tonnen)</strong> = Volumen (m³) × Dichte (t/m³)<br><br>
    <strong>Entsorgungskosten</strong> = Gewicht × Deponiekosten pro Tonne
  </div>

  <div class="example-box">
    <h4>Beispiel: Entsorgung Bauschutt</h4>
    <p>
      Container: 7m³, Dichte: 1,50 t/m³, Deponiekosten: €15/t<br><br>
      Gewicht = 7 × 1,50 = <strong>10,5 t</strong><br>
      Entsorgungskosten = 10,5 × 15 = <strong>€157,50</strong>
    </p>
  </div>

  <h3>10.4 Gesamtpreis mit Marge</h3>
  <p>Der Endpreis ergibt sich aus allen Kosten plus der gewünschten Marge:</p>

  <div class="formula-box">
    <strong>Basiskosten</strong> = Transportkosten + Fixkosten/Container + Entsorgungskosten<br><br>
    <strong>Marge (€)</strong> = Basiskosten × (Margenprozent ÷ 100)<br><br>
    <strong>Endpreis (Netto)</strong> = Basiskosten + Marge
  </div>

  <div class="example-box">
    <h4>Komplettes Beispiel: 7m³ Bauschutt, 15 km, 30% Marge</h4>
    <p>
      <strong>1. Transportkosten:</strong> €21,00<br>
      <strong>2. Fixkosten/Container:</strong> €81,18<br>
      <strong>3. Entsorgungskosten:</strong> €157,50<br><br>
      <strong>Basiskosten:</strong> 21,00 + 81,18 + 157,50 = <strong>€259,68</strong><br>
      <strong>Marge (30%):</strong> 259,68 × 0,30 = <strong>€77,90</strong><br><br>
      <strong>═══ Endpreis (Netto): €337,58 ═══</strong>
    </p>
  </div>

  <div class="page-break"></div>

  <h2>Zusammenfassung der Formeln</h2>

  <table>
    <tr>
      <th>Berechnung</th>
      <th>Formel</th>
    </tr>
    <tr>
      <td>Transportkosten</td>
      <td>(Kraftstoff/km + Maut/km) × km × 2</td>
    </tr>
    <tr>
      <td>Fixkosten/Container</td>
      <td>(Fahrzeuge + Personal) ÷ Container/Monat</td>
    </tr>
    <tr>
      <td>Entsorgungskosten</td>
      <td>m³ × Dichte × €/Tonne</td>
    </tr>
    <tr>
      <td>Basiskosten</td>
      <td>Transport + Fixkosten + Entsorgung</td>
    </tr>
    <tr>
      <td>Endpreis</td>
      <td>Basiskosten × (1 + Marge%)</td>
    </tr>
  </table>

  <h2>Support & Kontakt</h2>
  <p>
    Bei Fragen zur Anwendung wenden Sie sich bitte an die Geschäftsführung.
  </p>
  <p style="margin-top: 40px; color: #666; font-size: 10pt;">
    © 2026 Rieprecht Entsorgung & Transport GmbH<br>
    Alle Rechte vorbehalten.
  </p>

</body>
</html>
`;

  const browser = await puppeteer.launch({ 
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    path: 'Rieprecht_Bedienungsanleitung.pdf',
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    
    headerTemplate: `
      <div style="width: 100%; font-size: 9px; padding: 10px 40px; display: flex; justify-content: space-between; align-items: center; -webkit-print-color-adjust: exact;">
        <span style="color: #3D9970; font-weight: bold;">Rieprecht Container-Kalkulator - Bedienungsanleitung</span>
        <img src="${logoDataUrl}" style="height: 55px;" />
      </div>
    `,
    
    footerTemplate: `
      <div style="width: 100%; font-size: 8px; padding: 10px 40px; display: flex; justify-content: space-between; color: #666; -webkit-print-color-adjust: exact;">
        <span>© 2026 Rieprecht Entsorgung & Transport GmbH</span>
        <span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
      </div>
    `,
    
    margin: {
      top: '100px',
      bottom: '60px',
      left: '50px',
      right: '50px'
    }
  });

  await browser.close();
  console.log('PDF erstellt: Rieprecht_Bedienungsanleitung.pdf');
};

generateManual().catch(console.error);
