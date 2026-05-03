import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium";

const LAUNCH_OPTIONS = {
  executablePath: CHROMIUM_PATH,
  headless: true as const,
  protocolTimeout: 180000,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--single-process',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--no-first-run',
    '--js-flags=--max-old-space-size=256',
  ],
};

export async function generatePdfFromHtml(html: string, options?: {
  landscape?: boolean;
  format?: 'A4' | 'A3' | 'Letter';
  margin?: { top?: string; bottom?: string; left?: string; right?: string };
}): Promise<Buffer> {
  const browser = await puppeteer.launch(LAUNCH_OPTIONS);

  try {
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: options?.format || 'A4',
      landscape: options?.landscape || false,
      printBackground: true,
      margin: options?.margin || {
        top: '15mm',
        bottom: '15mm',
        left: '12mm',
        right: '12mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close().catch(() => {});
  }
}

export function wrapHtmlForPdf(title: string, body: string, extraStyles?: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 16px; }
    .header h1 { font-size: 18px; color: #1e40af; }
    .header .meta { text-align: right; font-size: 10px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 10px; }
    th { background: #f1f5f9; color: #334155; padding: 5px 6px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
    td { padding: 4px 6px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .summary-row { background: #e0e7ff !important; font-weight: 600; }
    .section-title { font-size: 13px; font-weight: 600; color: #1e40af; margin: 16px 0 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .kpi-grid { display: flex; gap: 12px; margin: 8px 0 16px; flex-wrap: wrap; }
    .kpi-card { flex: 1; min-width: 120px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
    .kpi-card .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-card .value { font-size: 16px; font-weight: 700; color: #1e293b; }
    .text-green { color: #16a34a; }
    .text-red { color: #dc2626; }
    .text-blue { color: #2563eb; }
    .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; }
    @page { size: A4; margin: 12mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    ${extraStyles || ''}
  </style>
</head>
<body>
  ${body}
  <div class="footer">Rieprecht GmbH – Containerdienst Hamburg | Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
</body>
</html>`;
}

function fmt(value: number, decimals = 2): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtNum(value: number, decimals = 1): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function generatePlanningPdfHtml(data: {
  months: any[];
  totalPlannedRevenue: number;
  totalActualRevenue: number;
  totalPlannedTrips: number;
  totalActualTrips: number;
  year: number;
}): string {
  const body = `
    <div class="header">
      <h1>Planungsübersicht – Soll/Ist-Vergleich ${data.year}</h1>
      <div class="meta">Rieprecht GmbH<br>Containerdienst Hamburg</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Plan-Umsatz</div>
        <div class="value text-blue">${fmt(data.totalPlannedRevenue, 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Ist-Umsatz</div>
        <div class="value ${data.totalActualRevenue >= data.totalPlannedRevenue ? 'text-green' : 'text-red'}">${fmt(data.totalActualRevenue, 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Plan-Fahrten</div>
        <div class="value text-blue">${data.totalPlannedTrips}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Ist-Fahrten</div>
        <div class="value ${data.totalActualTrips >= data.totalPlannedTrips ? 'text-green' : 'text-red'}">${data.totalActualTrips}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Monat</th>
          <th class="text-right">Plan-Umsatz</th>
          <th class="text-right">Ist-Umsatz</th>
          <th class="text-right">Differenz</th>
          <th class="text-center">Plan-Fahrten</th>
          <th class="text-center">Ist-Fahrten</th>
          <th class="text-right">Erreichung</th>
        </tr>
      </thead>
      <tbody>
        ${data.months.map(m => {
          const diff = m.actualRevenue - m.plannedRevenue;
          const pct = m.plannedRevenue > 0 ? (m.actualRevenue / m.plannedRevenue * 100) : 0;
          return `<tr>
            <td>${m.monthName}</td>
            <td class="text-right">${fmt(m.plannedRevenue, 0)}</td>
            <td class="text-right">${fmt(m.actualRevenue, 0)}</td>
            <td class="text-right ${diff >= 0 ? 'text-green' : 'text-red'}">${diff >= 0 ? '+' : ''}${fmt(diff, 0)}</td>
            <td class="text-center">${m.plannedTrips}</td>
            <td class="text-center">${m.actualTrips}</td>
            <td class="text-right ${pct >= 100 ? 'text-green' : pct >= 80 ? '' : 'text-red'}">${fmtNum(pct, 0)}%</td>
          </tr>`;
        }).join('')}
        <tr class="summary-row">
          <td>GESAMT</td>
          <td class="text-right">${fmt(data.totalPlannedRevenue, 0)}</td>
          <td class="text-right">${fmt(data.totalActualRevenue, 0)}</td>
          <td class="text-right ${data.totalActualRevenue - data.totalPlannedRevenue >= 0 ? 'text-green' : 'text-red'}">${(data.totalActualRevenue - data.totalPlannedRevenue) >= 0 ? '+' : ''}${fmt(data.totalActualRevenue - data.totalPlannedRevenue, 0)}</td>
          <td class="text-center">${data.totalPlannedTrips}</td>
          <td class="text-center">${data.totalActualTrips}</td>
          <td class="text-right">${data.totalPlannedRevenue > 0 ? fmtNum(data.totalActualRevenue / data.totalPlannedRevenue * 100, 0) : 0}%</td>
        </tr>
      </tbody>
    </table>`;

  return wrapHtmlForPdf('Planungsübersicht', body);
}

export function generateTripsPdfHtml(trips: any[], dateRange?: { from?: string; to?: string }): string {
  const totalRevenue = trips.reduce((s, t) => s + Number(t.actualPrice || 0), 0);
  const totalDistance = trips.reduce((s, t) => s + Number(t.distanceKm || 0), 0);
  const dateLabel = dateRange?.from && dateRange?.to
    ? `${new Date(dateRange.from).toLocaleDateString('de-DE')} – ${new Date(dateRange.to).toLocaleDateString('de-DE')}`
    : 'Alle Fahrten';

  const body = `
    <div class="header">
      <h1>Fahrtenübersicht</h1>
      <div class="meta">Rieprecht GmbH<br>${dateLabel}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Anzahl Fahrten</div>
        <div class="value text-blue">${trips.length}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Gesamtumsatz</div>
        <div class="value text-green">${fmt(totalRevenue, 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Gesamtentfernung</div>
        <div class="value">${fmtNum(totalDistance, 0)} km</div>
      </div>
      <div class="kpi-card">
        <div class="label">Ø Umsatz/Fahrt</div>
        <div class="value">${trips.length > 0 ? fmt(totalRevenue / trips.length, 0) : '–'}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Datum</th>
          <th>Kunde</th>
          <th>Material</th>
          <th class="text-center">Container</th>
          <th class="text-right">Entfernung</th>
          <th class="text-right">Umsatz</th>
          <th>Notizen</th>
        </tr>
      </thead>
      <tbody>
        ${trips.map(t => `<tr>
          <td>${t.tripDate ? new Date(t.tripDate).toLocaleDateString('de-DE') : '–'}</td>
          <td>${t.customerName || t.customerId || '–'}</td>
          <td>${t.materialName || t.materialId || '–'}</td>
          <td class="text-center">${t.containerSize || '–'}m³</td>
          <td class="text-right">${t.distanceKm ? fmtNum(Number(t.distanceKm), 0) + ' km' : '–'}</td>
          <td class="text-right">${t.actualPrice ? fmt(Number(t.actualPrice), 0) : '–'}</td>
          <td>${t.notes || ''}</td>
        </tr>`).join('')}
        <tr class="summary-row">
          <td colspan="4">GESAMT (${trips.length} Fahrten)</td>
          <td class="text-right">${fmtNum(totalDistance, 0)} km</td>
          <td class="text-right">${fmt(totalRevenue, 0)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>`;

  return wrapHtmlForPdf('Fahrtenübersicht', body);
}

export function generateCustomersPdfHtml(customers: any[]): string {
  const privateCount = customers.filter(c => c.type === 'privat').length;
  const commercialCount = customers.filter(c => c.type === 'gewerblich').length;

  const body = `
    <div class="header">
      <h1>Kundenliste</h1>
      <div class="meta">Rieprecht GmbH<br>Containerdienst Hamburg</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Kunden Gesamt</div>
        <div class="value text-blue">${customers.length}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Gewerblich</div>
        <div class="value">${commercialCount}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Privat</div>
        <div class="value">${privateCount}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Kd.-Nr.</th>
          <th>Firma / Name</th>
          <th>Typ</th>
          <th>Kontaktperson</th>
          <th>Telefon</th>
          <th>E-Mail</th>
          <th>Ort</th>
          <th class="text-right">Rabatt</th>
        </tr>
      </thead>
      <tbody>
        ${customers.map(c => `<tr>
          <td>${c.customerNumber || '–'}</td>
          <td>${c.companyName || '–'}</td>
          <td>${c.type === 'gewerblich' ? 'Gewerbl.' : 'Privat'}</td>
          <td>${c.contactPerson || '–'}</td>
          <td>${c.phone || '–'}</td>
          <td>${c.email || '–'}</td>
          <td>${c.city || '–'}</td>
          <td class="text-right">${c.discountPercent ? fmtNum(Number(c.discountPercent), 0) + '%' : '–'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  return wrapHtmlForPdf('Kundenliste', body);
}

export function generateCalculatorPdfHtml(data: {
  customerName: string;
  distance: number;
  calculations: any;
  containerSizes: number[];
  totalAvgPrice: number;
}): string {
  const calc = data.calculations;
  const isArray = Array.isArray(calc);

  let tableContent: string;

  if (isArray && calc.length > 0) {
    tableContent = data.containerSizes.map(size => {
      const calcs = calc.filter((c: any) => c.containerSize === size);
      if (calcs.length === 0) return '';
      return `
        <div class="section-title">${size}m³ Container</div>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>AVV</th>
              <th class="text-right">Transportkosten</th>
              <th class="text-right">Entsorgung</th>
              <th class="text-right">Kalkulation</th>
              <th class="text-right">Listenpreis</th>
              <th class="text-right">Marktpreis</th>
            </tr>
          </thead>
          <tbody>
            ${calcs.map((c: any) => `<tr>
              <td>${c.materialName || '–'}</td>
              <td>${c.avvNumber || '–'}</td>
              <td class="text-right">${fmt(Number(c.transportCost || 0))}</td>
              <td class="text-right">${fmt(Number(c.disposalCost || 0))}</td>
              <td class="text-right">${fmt(Number(c.calculatedPrice || 0))}</td>
              <td class="text-right">${c.listPrice ? fmt(Number(c.listPrice)) : '–'}</td>
              <td class="text-right">${c.marketPrice ? fmt(Number(c.marketPrice)) : '–'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    }).join('');
  } else {
    const c = isArray ? calc[0] : calc;
    tableContent = `
      <div class="section-title">Kalkulation – ${c?.materialName || 'Material'} (${c?.containerSize || '7'}m³)</div>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="label">Transportkosten</div>
          <div class="value">${fmt(Number(c?.transportCost || 0))}</div>
        </div>
        <div class="kpi-card">
          <div class="label">Entsorgungskosten</div>
          <div class="value">${fmt(Number(c?.disposalCost || 0))}</div>
        </div>
        <div class="kpi-card">
          <div class="label">Fixkosten/Container</div>
          <div class="value">${fmt(Number(c?.fixedCostPerContainer || 0))}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Position</th>
            <th class="text-right">Betrag</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Selbstkosten (netto)</td><td class="text-right">${fmt(Number(c?.baseCost || 0))}</td></tr>
          <tr><td>Gewichtszuschlag (${fmtNum(Number(c?.weightT || 0))} t)</td><td class="text-right">${fmt(Number(c?.disposalCost || 0))}</td></tr>
          <tr><td>Marge (${fmtNum(Number(c?.marginPercent || 0))}%)</td><td class="text-right">${fmt(Number(c?.marginAmount || 0))}</td></tr>
          <tr class="summary-row"><td><strong>Kalkulierter Preis (netto)</strong></td><td class="text-right"><strong>${fmt(Number(c?.finalPrice || 0))}</strong></td></tr>
          <tr class="summary-row"><td><strong>Bruttopreis (inkl. 19% MwSt.)</strong></td><td class="text-right"><strong>${fmt(Number(c?.grossPrice || 0))}</strong></td></tr>
        </tbody>
      </table>`;
  }

  const body = `
    <div class="header">
      <h1>Preiskalkulation</h1>
      <div class="meta">Rieprecht GmbH<br>Kunde: ${data.customerName || 'Standard'}<br>Entfernung: ${data.distance} km</div>
    </div>
    ${tableContent}`;

  return wrapHtmlForPdf('Preiskalkulation', body);
}

export function generatePriceOptPdfHtml(data: {
  recommendations: any[];
  summary: any;
}): string {
  const s = data.summary;
  const statusLabel = (st: string) => {
    if (st === 'under_cost') return '<span class="text-red">&#9888; Unter Kosten</span>';
    if (st === 'below_market') return '<span class="text-green">&#10003; Unter Markt</span>';
    if (st === 'at_market') return '<span class="text-green">&#9679; Am Markt</span>';
    if (st === 'above_market') return '<span style="color:#d97706;">&#9650; Über Markt</span>';
    if (st === 'no_market') return '<span style="color:#94a3b8;">— Kein Markt</span>';
    if (st === 'too_low') return '<span class="text-red">&#9660; Zu niedrig</span>';
    if (st === 'too_high') return '<span style="color:#d97706;">&#9650; Zu hoch</span>';
    if (st === 'optimal') return '<span class="text-green">&#10003; Optimal</span>';
    return '<span style="color:#94a3b8;">— Kein Preis</span>';
  };

  const sizeBlocks = [7, 10].map(size => {
    const recs = data.recommendations.filter((r: any) => r.containerSize === size);
    if (recs.length === 0) return '';
    return `
      <div class="section-title">${size}m³ Container</div>
      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>AVV</th>
            <th class="text-right">Kosten</th>
            <th class="text-right">Akt. Preis</th>
            <th class="text-right">Empf. Preis</th>
            <th class="text-right">Marktpreis</th>
            <th class="text-right">Akt. Marge</th>
            <th class="text-right">Markt-Marge</th>
            <th class="text-right">Ziel-Marge</th>
            <th class="text-center">Status</th>
            <th class="text-right">Jahreseffekt</th>
          </tr>
        </thead>
        <tbody>
          ${recs.map((r: any) => `<tr>
            <td>${r.materialName}</td>
            <td>${r.avvNumber || '–'}</td>
            <td class="text-right">${fmt(r.baseCost)}</td>
            <td class="text-right">${r.currentListPrice !== null ? fmt(r.currentListPrice) : '–'}</td>
            <td class="text-right" style="font-weight:600;color:#2563eb;">${fmt(r.optimalPrice)}</td>
            <td class="text-right">${r.marketPriceNet !== null ? fmt(r.marketPriceNet) : '–'}</td>
            <td class="text-right ${r.currentMarginPercent !== null ? (r.currentMarginPercent < 0 ? 'text-red' : r.currentMarginPercent < s.targetMarginPercent ? '' : 'text-green') : ''}">${r.currentMarginPercent !== null ? fmtNum(r.currentMarginPercent, 1) + '%' : '–'}</td>
            <td class="text-right ${r.marketMarginPercent !== null && r.marketMarginPercent !== undefined ? (r.marketMarginPercent < 0 ? 'text-red' : r.marketMarginPercent < s.targetMarginPercent ? '' : 'text-green') : ''}">${r.marketMarginPercent !== null && r.marketMarginPercent !== undefined ? fmtNum(r.marketMarginPercent, 1) + '%' : '–'}</td>
            <td class="text-right text-green">${fmtNum(r.optimalMarginPercent, 1)}%</td>
            <td class="text-center">${statusLabel(r.status)}</td>
            <td class="text-right ${r.annualImpact !== null ? (r.annualImpact > 0 ? 'text-green' : r.annualImpact < 0 ? 'text-red' : '') : ''}">${r.annualImpact !== null ? `${r.annualImpact > 0 ? '+' : ''}${fmt(r.annualImpact, 0)}` : '–'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }).join('');

  const body = `
    <div class="header">
      <h1>Preisoptimierung – Analyse</h1>
      <div class="meta">Rieprecht GmbH<br>Containerdienst Hamburg<br>Entfernung: ${s.distance} km</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Unter Kosten</div>
        <div class="value text-red">${s.underCost ?? s.tooLow ?? 0}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Unter Markt</div>
        <div class="value text-green">${s.belowMarket ?? 0}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Am Markt</div>
        <div class="value text-green">${s.atMarket ?? s.optimal ?? 0}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Über Markt</div>
        <div class="value" style="color:#d97706;">${s.aboveMarket ?? s.tooHigh ?? 0}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Kein Markt/Preis</div>
        <div class="value">${(s.noMarket ?? 0) + (s.noPrice ?? 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Geschätzter Jahreseffekt</div>
        <div class="value ${s.totalAnnualImpact >= 0 ? 'text-green' : 'text-red'}">${s.totalAnnualImpact >= 0 ? '+' : ''}${fmt(s.totalAnnualImpact, 0)}</div>
      </div>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:10px;">
      <strong>Berechnungsgrundlage:</strong> Fixkosten/Container: ${fmt(s.fixedCostPerContainer)} | Container/Monat: ${s.containersPerMonth} | Monatl. Fixkosten: ${fmt(s.totalMonthlyFixed, 0)}
    </div>
    ${sizeBlocks}`;

  return wrapHtmlForPdf('Preisoptimierung', body);
}

function getLogoBase64(): string {
  try {
    const logoPath = path.resolve(process.cwd(), 'server/logo-base64.txt');
    return fs.readFileSync(logoPath, 'utf-8').trim();
  } catch {
    return '';
  }
}

export function generateCustomerPriceListHtml(data: {
  recommendations: any[];
  distance: number;
  customerName?: string;
  discountPercent?: number;
}): string {
  const discount = data.discountPercent || 0;
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const logoB64 = getLogoBase64();
  const logoImg = logoB64 ? `<div style="background:white;border-radius:6px;padding:4px 6px;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.15);"><img src="data:image/png;base64,${logoB64}" style="height:34px;width:auto;" alt="Rieprecht GmbH"/></div>` : '';

  const allRecs = data.recommendations
    .filter((r: any) => r.currentListPrice !== null)
    .sort((a: any, b: any) => a.materialName.localeCompare(b.materialName));

  function applyDiscount(val: number | null): number | null {
    if (val === null || val === undefined) return null;
    return discount > 0 ? val * (1 - discount / 100) : val;
  }

  const brandGreen = '#1b9e6b';
  const brandGreenDark = '#167d56';
  const brandOrange = '#eb7636';
  const darkText = '#1e293b';
  const lightBg = '#f0faf5';
  const headerBg = brandGreen;

  function pageHeader(title: string, subtitle?: string): string {
    const customerInfo = data.customerName ? `<span style="margin-left:12px;font-weight:600;">Kunde: ${data.customerName}</span>` : '';
    const discountInfo = discount > 0 ? `<span style="margin-left:12px;background:${brandOrange};color:white;padding:2px 10px;border-radius:10px;font-size:8px;font-weight:600;">${fmtNum(discount, 0)}% Rabatt</span>` : '';
    return `
      <div style="background:linear-gradient(135deg, ${brandGreen} 0%, ${brandGreenDark} 100%);color:white;padding:10px 16px;border-radius:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${logoImg}
          <div>
            <div style="font-size:15px;font-weight:700;letter-spacing:0.5px;">Rieprecht GmbH</div>
            <div style="font-size:8px;opacity:0.85;">Containerdienst Hamburg &amp; Umgebung</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:700;letter-spacing:0.3px;">${title}</div>
          ${subtitle ? `<div style="font-size:8px;opacity:0.85;">${subtitle}</div>` : ''}
          <div style="font-size:8px;opacity:0.8;margin-top:2px;">Stand: ${today}${customerInfo}${discountInfo}</div>
        </div>
      </div>`;
  }

  function pageFooter(): string {
    return `
      <div style="margin-top:auto;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:3px;height:20px;background:${brandGreen};border-radius:2px;"></div>
          <div style="font-size:7.5px;color:#475569;line-height:1.3;">
            <strong style="color:${darkText};">Rieprecht GmbH</strong><br>
            Heinrichstra\u00dfe 11 | 22946 Brunsbek
          </div>
        </div>
        <div style="font-size:7.5px;color:#475569;text-align:center;line-height:1.3;">
          Tel: (+49) 162 \u2013 5231470<br>
          info@rieprecht-gmbh.de | www.rieprecht-gmbh.de
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:700;font-style:italic;color:${brandOrange};letter-spacing:0.5px;">Schnell. Sauber. Zuverl\u00e4ssig.</div>
        </div>
      </div>`;
  }

  function zulagenStr(r: any): string {
    const parts: string[] = [];
    const sTonne = r.salesSurchargeTotalTonne ?? 0;
    const sM3 = r.salesSurchargeTotalM3 ?? 0;
    if (sTonne > 0) parts.push(`${fmtNum(sTonne, 2)} \u20ac (t)`);
    if (sM3 > 0 && sM3 !== sTonne) parts.push(`${fmtNum(sM3, 2)} \u20ac (m\u00b3)`);
    if (parts.length === 0 && (r.purchaseSurchargeTotal ?? 0) > 0) {
      parts.push(`EK: ${fmtNum(r.purchaseSurchargeTotal, 2)} \u20ac`);
    }
    return parts.length > 0 ? parts.join(', ') : '\u2013';
  }

  const uniqueMaterials = new Map<string, any>();
  for (const r of allRecs) {
    if (!uniqueMaterials.has(r.materialName)) {
      uniqueMaterials.set(r.materialName, r);
    }
  }
  const m3Materials = Array.from(uniqueMaterials.values())
    .filter((r: any) => r.currentPricePerM3 !== null || r.currentPricePerTonne !== null);

  function serviceCards(showSize?: number): string {
    return `
      <div style="display:flex;gap:10px;margin-bottom:10px;">
        <div class="card" style="border-top:3px solid ${brandGreen};">
          <div class="card-label">Containergestellung (einmalig)</div>
          <div class="card-value">65,00 \u20ac <span class="card-unit">netto</span></div>
        </div>
        <div class="card" style="border-top:3px solid ${brandOrange};">
          <div class="card-label">Containertausch / Abholung</div>
          <div class="card-value">135,00 \u20ac <span class="card-unit">netto</span></div>
        </div>
        ${showSize ? `
        <div class="card" style="border-top:3px solid ${brandGreen};">
          <div class="card-label">Containergr\u00f6\u00dfe</div>
          <div class="card-value">${showSize} m\u00b3</div>
        </div>` : `
        <div class="card" style="border-top:3px solid #94a3b8;">
          <div class="card-label">Entfernung bis</div>
          <div class="card-value">${data.distance} km</div>
        </div>`}
      </div>`;
  }

  const page1 = `
    <div class="page">
      ${pageHeader('Entsorgungspreise', 'pro m\u00b3 und Tonne \u2013 alle Abfallarten')}
      ${serviceCards()}

      ${discount > 0 ? `<div class="discount-bar">
        <strong>\u2713 Ihr Kundenrabatt von ${fmtNum(discount, 0)}% ist in allen Preisen bereits ber\u00fccksichtigt.</strong>
      </div>` : ''}

      <table>
        <thead>
          <tr>
            <th style="width:30%;">Abfallart</th>
            <th style="width:12%;">AVV-Nr.</th>
            <th class="text-right" style="width:18%;">Preis pro Tonne (netto)</th>
            <th class="text-right" style="width:18%;">Preis pro m\u00b3 (netto)</th>
            <th class="text-right" style="width:22%;">Zulagen</th>
          </tr>
        </thead>
        <tbody>
          ${m3Materials.map((r: any, i: number) => {
            const pt = applyDiscount(r.currentPricePerTonne);
            const pm3 = applyDiscount(r.currentPricePerM3);
            return `<tr>
              <td style="font-weight:500;">${r.materialName}</td>
              <td style="color:#64748b;">${r.avvNumber || '\u2013'}</td>
              <td class="text-right price-cell">${pt !== null ? fmt(pt) : '\u2013'}</td>
              <td class="text-right price-cell">${pm3 !== null ? fmt(pm3) : '\u2013'}</td>
              <td class="text-right" style="font-size:8.5px;color:#64748b;">${zulagenStr(r)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      <div style="display:flex;gap:12px;margin-top:8px;">
        <div class="note-box" style="flex:1;">
          <strong>Hinweise:</strong> Alle Preise netto zzgl. 19% MwSt. Containerstellung max. 14 Tage, danach 5,00 \u20ac/Tag. \u00c4nderungen vorbehalten.
        </div>
        <div class="note-box" style="flex:1;">
          <strong>Zulagen:</strong> BEHG = CO\u2082-Abgabe gem. Brennstoffemissionshandelsgesetz. Materialzulagen = abfallartspezifische Zuschl\u00e4ge.
        </div>
      </div>

      ${pageFooter()}
    </div>`;

  function containerPage(size: number): string {
    const recs = allRecs
      .filter((r: any) => r.containerSize === size)
      .sort((a: any, b: any) => a.materialName.localeCompare(b.materialName));
    if (recs.length === 0) return '';

    return `
    <div class="page">
      ${pageHeader(`${size} m\u00b3 Container`, 'Absetzcontainer \u2013 Entsorgungspreise nach Abfallart')}
      ${serviceCards(size)}

      ${discount > 0 ? `<div class="discount-bar">
        <strong>\u2713 Rabatt ${fmtNum(discount, 0)}% bereits ber\u00fccksichtigt.</strong>
      </div>` : ''}

      <table>
        <thead>
          <tr>
            <th style="width:24%;">Abfallart</th>
            <th style="width:10%;">AVV-Nr.</th>
            <th class="text-right" style="width:13%;">Preis/Tonne</th>
            <th class="text-right" style="width:13%;">Preis/m\u00b3</th>
            <th class="text-right" style="width:16%;">Zulagen</th>
            <th class="text-right" style="width:12%;">Pauschal netto</th>
            <th class="text-right" style="width:12%;">Pauschal brutto</th>
          </tr>
        </thead>
        <tbody>
          ${recs.map((r: any) => {
            const pt = applyDiscount(r.currentPricePerTonne);
            const pm3 = applyDiscount(r.currentPricePerM3);
            const netTotal = applyDiscount(r.currentListPrice) || 0;
            const grossTotal = netTotal * 1.19;
            return `<tr>
              <td style="font-weight:500;">${r.materialName}</td>
              <td style="color:#64748b;">${r.avvNumber || '\u2013'}</td>
              <td class="text-right price-cell">${pt !== null ? fmt(pt) : '\u2013'}</td>
              <td class="text-right price-cell">${pm3 !== null ? fmt(pm3) : '\u2013'}</td>
              <td class="text-right" style="font-size:8.5px;color:#64748b;">${zulagenStr(r)}</td>
              <td class="text-right" style="font-weight:600;">${fmt(netTotal)}</td>
              <td class="text-right highlight-price">${fmt(grossTotal)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      <div class="note-box">
        Alle Preise netto zzgl. 19% MwSt. | Pauschalpreise inkl. Entsorgung, zzgl. Gestellung/Tausch |
        Entfernung bis ${data.distance} km | Stellzeit max. 14 Tage | \u00c4nderungen vorbehalten
      </div>

      ${pageFooter()}
    </div>`;
  }

  const page2 = containerPage(7);
  const page3 = containerPage(10);

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Preisliste Rieprecht GmbH</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 10px; color: ${darkText}; line-height: 1.4; }

    .page { page-break-after: always; min-height: 100%; display: flex; flex-direction: column; }
    .page:last-child { page-break-after: avoid; }

    .card { flex:1; background: white; padding: 8px 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card-label { font-size: 7.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .card-value { font-size: 14px; font-weight: 700; color: ${darkText}; }
    .card-unit { font-size: 9px; font-weight: 400; color: #94a3b8; }

    .discount-bar { background: linear-gradient(90deg, #fef3c7, #fde68a); border-left: 3px solid ${brandOrange}; padding: 5px 12px; margin-bottom: 8px; font-size: 9px; color: #92400e; border-radius: 0 4px 4px 0; }

    .note-box { background: #f8fafc; border-radius: 4px; padding: 6px 10px; font-size: 7.5px; color: #64748b; border: 1px solid #e2e8f0; }

    table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 4px 0 8px; font-size: 9.5px; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    th { background: linear-gradient(135deg, ${headerBg} 0%, ${brandGreenDark} 100%); color: white; padding: 6px 10px; text-align: left; font-weight: 600; font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
    th:first-child { border-radius: 0; }
    th:last-child { border-radius: 0; }
    td { padding: 5px 10px; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
    tr:nth-child(even) { background: #fafbfc; }
    tr:hover { background: ${lightBg}; }
    .price-cell { font-weight: 500; color: ${darkText}; }
    .highlight-price { font-weight: 700; color: ${brandGreen}; font-size: 10px; }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${page1}${page2}${page3}
</body>
</html>`;
}

