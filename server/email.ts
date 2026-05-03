// Resend Email Integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  console.log('[Email] Fetching Resend credentials...', { 
    hostname: hostname ? 'present' : 'missing',
    tokenType: process.env.REPL_IDENTITY ? 'repl' : process.env.WEB_REPL_RENEWAL ? 'depl' : 'none'
  });

  if (!xReplitToken) {
    console.error('[Email] No token available for Resend connector');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  if (!hostname) {
    console.error('[Email] REPLIT_CONNECTORS_HOSTNAME not set');
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not configured');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  console.log('[Email] Connector response:', { status: response.status, hasItems: !!data.items?.length });
  
  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings?.api_key)) {
    console.error('[Email] Resend not configured or API key missing');
    throw new Error('Resend not connected - please configure the Resend integration');
  }
  
  console.log('[Email] Resend credentials loaded successfully');
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getResendClient() {
  const { apiKey } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: connectionSettings.settings.from_email || 'info@rieprecht-gmbh.de'
  };
}

// Get the base URL for the app (works in dev and production)
function getBaseUrl(): string {
  // In production, use REPLIT_DOMAINS (comma-separated, first one is primary)
  if (process.env.REPLIT_DOMAINS) {
    const primaryDomain = process.env.REPLIT_DOMAINS.split(',')[0];
    return `https://${primaryDomain}`;
  }
  // In development, use REPLIT_DEV_DOMAIN
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // Fallback
  return 'http://localhost:5000';
}

export async function sendPasswordResetEmail(to: string, resetToken: string, username: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const resetUrl = `${getBaseUrl()}/reset-password?token=${resetToken}`;
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: 'Passwort zurücksetzen - Rieprecht Container Calculator',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background: #fef3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Rieprecht GmbH</h1>
              <p>Container Calculator</p>
            </div>
            <div class="content">
              <h2>Passwort zurücksetzen</h2>
              <p>Hallo ${username},</p>
              <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
              <p>Klicken Sie auf den folgenden Button, um ein neues Passwort festzulegen:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Passwort zurücksetzen</a>
              </p>
              <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
              <p style="word-break: break-all; font-size: 12px; background: #eee; padding: 10px; border-radius: 4px;">
                ${resetUrl}
              </p>
              <div class="warning">
                <strong>Hinweis:</strong> Dieser Link ist nur 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
              </div>
            </div>
            <div class="footer">
              <p>Rieprecht GmbH - Containerdienst Hamburg</p>
              <p>Diese E-Mail wurde automatisch generiert.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Password reset email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

export async function sendVerificationEmail(to: string, verificationToken: string, username: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const verifyUrl = `${getBaseUrl()}/verify-email?token=${verificationToken}`;
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: 'E-Mail-Adresse bestätigen - Rieprecht Container Calculator',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background: #fef3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Rieprecht GmbH</h1>
              <p>Container Calculator</p>
            </div>
            <div class="content">
              <h2>E-Mail-Adresse bestätigen</h2>
              <p>Hallo ${username},</p>
              <p>Vielen Dank für Ihre Registrierung! Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.</p>
              <p style="text-align: center;">
                <a href="${verifyUrl}" class="button">E-Mail bestätigen</a>
              </p>
              <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
              <p style="word-break: break-all; font-size: 12px; background: #eee; padding: 10px; border-radius: 4px;">
                ${verifyUrl}
              </p>
              <div class="warning">
                <strong>Hinweis:</strong> Dieser Link ist 24 Stunden gültig. Falls Sie sich nicht registriert haben, können Sie diese E-Mail ignorieren.
              </div>
            </div>
            <div class="footer">
              <p>Rieprecht GmbH - Containerdienst Hamburg</p>
              <p>Diese E-Mail wurde automatisch generiert.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Verification email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

interface QuoteEmailData {
  recipientEmails: string[];
  customerType: "privat" | "gewerblich";
  firstName: string;
  lastName: string;
  companyName?: string;
  materialName: string;
  articleNumber?: string | null;
  containerSize: number;
  distanceKm: number;
  estimatedWeightT: number;
  volumeM3: number;
  finalPrice: number;
  grossPrice: number;
  quantity?: number;
  withTrailer?: boolean;
  // Container 2 info (when different material)
  material2Name?: string | null;
  material2WeightT?: number | null;
  material2VolumeM3?: number | null;
  // Offer number (A-2026-01-0001)
  offerNumber?: string;
}

// HTML escape to prevent malformed markup in emails
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Break potential auto-link patterns like "Co.KG" by inserting zero-width space after dots
function breakAutoLinks(str: string): string {
  // Insert zero-width space (&#8203;) after dots followed by letters (e.g., "Co.KG" -> "Co.&#8203;KG")
  return str.replace(/\.([A-Za-z])/g, '.&#8203;$1');
}

// Safe number formatting with NaN protection
function safeToFixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(decimals);
}

export async function sendQuoteEmail(data: QuoteEmailData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const replyEmail = fromEmail;
    
    // Escape user-provided strings and break auto-link patterns
    const safeFirstName = escapeHtml(data.firstName);
    const safeLastName = escapeHtml(data.lastName);
    const safeCompanyName = data.companyName ? breakAutoLinks(escapeHtml(data.companyName)) : "";
    const safeMaterial = escapeHtml(data.materialName);
    const fullName = `${safeFirstName} ${safeLastName}`;
    
    // Personalized greeting based on customer type
    const greeting = data.customerType === "gewerblich" && safeCompanyName
      ? `Guten Tag ${safeFirstName} ${safeLastName},`
      : `Guten Tag ${safeFirstName} ${safeLastName},`;
    
    // Price display based on customer type
    const isPrivate = data.customerType === "privat";
    const mainPrice = isPrivate ? data.grossPrice : data.finalPrice;
    const mainPriceLabel = isPrivate ? "Ihr Angebotspreis (inkl. MwSt.)" : "Ihr Angebotspreis (Netto)";
    const subPrice = isPrivate ? data.finalPrice : data.grossPrice;
    const subPriceLabel = isPrivate ? `Netto: €${safeToFixed(subPrice, 2)}` : `inkl. MwSt: €${safeToFixed(subPrice, 2)} (Brutto)`;
    
    // Colors: Green (#1a5a2e), White, Light Gray (#f7f7f7)
    const primaryGreen = "#1a5a2e";
    const lightGray = "#f7f7f7";
    
    // Always send a copy to Rieprecht
    const allRecipients = [...data.recipientEmails, "info@rieprecht-gmbh.de"];
    
    // Logo URL - hosted on the app's public domain
    const logoUrl = `${getBaseUrl()}/rieprecht-logo.png`;
    
    const result = await client.emails.send({
      from: fromEmail,
      to: allRecipients,
      replyTo: replyEmail,
      subject: `Angebot ${data.offerNumber || ''} - ${(data.quantity || 1) > 1 ? `${data.quantity}x ` : ''}${data.materialName} ${data.containerSize}m³${data.withTrailer ? ' (mit Anhänger)' : ''} | Rieprecht GmbH`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: ${primaryGreen}; margin: 0; padding: 0; background: ${lightGray};">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px;">
            
            <!-- Header -->
            <div style="background: ${primaryGreen}; color: white; padding: 25px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 1px;">Rieprecht GmbH</h1>
              <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Containerdienst Hamburg</p>
            </div>
            
            <!-- Recipient Info Bar with Logo -->
            <div style="padding: 18px 30px; background: ${lightGray}; border-bottom: 2px solid white;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; text-align: left;">
                    ${data.offerNumber ? `<p style="margin: 0 0 6px; color: ${primaryGreen}; opacity: 0.6; font-size: 12px; font-weight: 500;">Angebots-Nr.: ${data.offerNumber}</p>` : ''}
                    <p style="margin: 0; font-weight: 600; color: ${primaryGreen}; font-size: 15px;">Angebot für: ${fullName}</p>
                    ${safeCompanyName ? `<p style="margin: 4px 0 0; color: ${primaryGreen}; opacity: 0.7; font-size: 13px;">${safeCompanyName}</p>` : ""}
                  </td>
                  <td width="100" style="vertical-align: middle; text-align: right;">
                    <img src="${logoUrl}" alt="Rieprecht" width="80" height="auto" style="display: block; border-radius: 8px;">
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Content -->
            <div style="padding: 25px 30px;">
              <p style="font-size: 16px; margin: 0 0 15px; color: ${primaryGreen};">${greeting}</p>
              
              <p style="margin: 0 0 20px; color: ${primaryGreen}; opacity: 0.8;">vielen Dank für Ihr Interesse an unseren Container-Services! Hier ist Ihr individuelles Angebot:</p>
              
              <!-- Price Box -->
              <div style="background: ${primaryGreen}; color: white; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 13px; opacity: 0.9;">${mainPriceLabel}</p>
                <p style="font-size: 38px; font-weight: 700; margin: 8px 0;">€${safeToFixed(mainPrice, 2)}</p>
                <p style="font-size: 13px; opacity: 0.85; margin: 0;">${subPriceLabel}</p>
              </div>
              
              <h3 style="color: ${primaryGreen}; margin: 25px 0 15px; font-size: 16px; font-weight: 600;">Angebotsdetails</h3>
              
              <!-- Details Box -->
              <div style="background: ${lightGray}; border-radius: 8px; padding: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; color: ${primaryGreen};">
                  ${data.material2Name ? `
                  <!-- Two different materials -->
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7;">Anzahl Container</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">2 Stück${data.withTrailer ? ' (mit Anhänger)' : ''}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Container 1 - Abfallart</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">${safeMaterial}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Container 1 - Menge</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">ca. ${safeToFixed(data.volumeM3, 1)} m³ (≈ ${safeToFixed(data.estimatedWeightT, 2)} t)</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Container 2 - Abfallart</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">${escapeHtml(data.material2Name)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Container 2 - Menge</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">ca. ${safeToFixed(data.material2VolumeM3 || 0, 1)} m³ (≈ ${safeToFixed(data.material2WeightT || 0, 2)} t)</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Gesamtmenge</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">ca. ${safeToFixed(data.volumeM3 + (data.material2VolumeM3 || 0), 1)} m³ (≈ ${safeToFixed(data.estimatedWeightT + (data.material2WeightT || 0), 2)} t)</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Containergröße (beide)</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">${data.containerSize} m³</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Entfernung</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">${data.distanceKm} km</td>
                  </tr>
                  ` : `
                  <!-- Single material -->
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7;">Abfallart</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.articleNumber ? `<span style="opacity: 0.7; font-size: 12px;">${escapeHtml(data.articleNumber)}</span> ` : ''}${safeMaterial}</td>
                  </tr>
                  ${(data.quantity || 1) > 1 ? `
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Anzahl Container</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">${data.quantity} Stück${data.withTrailer ? ' (mit Anhänger)' : ''}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Geschätzte Menge</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">ca. ${safeToFixed(data.volumeM3 * (data.quantity || 1), 1)} m³ (≈ ${safeToFixed(data.estimatedWeightT * (data.quantity || 1), 2)} t)</td>
                  </tr>
                  `}
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Containergröße</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">${data.containerSize} m³</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; opacity: 0.7; border-top: 2px solid white;">Entfernung</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">${data.distanceKm} km</td>
                  </tr>
                </table>
              </div>
              
              <!-- Info Box -->
              <div style="background: ${lightGray}; border-radius: 8px; padding: 18px; margin: 20px 0;">
                <p style="margin: 0 0 10px; font-weight: 600; color: ${primaryGreen}; font-size: 14px;">Was ist im Preis enthalten?</p>
                <ul style="margin: 0; padding-left: 20px; color: ${primaryGreen}; opacity: 0.8; font-size: 13px;">
                  <li style="margin-bottom: 5px;">Anlieferung und Abholung des Containers</li>
                  <li style="margin-bottom: 5px;">Fachgerechte Entsorgung des Materials</li>
                  <li style="margin-bottom: 0;">Alle Transport- und Entsorgungskosten</li>
                </ul>
              </div>
              
              <!-- Container Pricing Info Box -->
              <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 18px; margin: 20px 0;">
                ${(data.quantity || 1) > 1 && data.withTrailer ? `
                <p style="margin: 0 0 10px; font-weight: 600; color: #856404; font-size: 14px;">Wichtiger Hinweis: Lieferung mit Anhänger</p>
                <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.5;">
                  Dieses Angebot beinhaltet die Lieferung von <strong>2 Containern am gleichen Tag per Anhänger</strong>. 
                  Dadurch sparen Sie eine komplette An- und Abfahrt.
                </p>
                <p style="margin: 10px 0 0; color: #856404; font-size: 13px; line-height: 1.5;">
                  <strong>Bitte beachten:</strong> Wenn beide Container mit Anhänger geliefert werden, müssen auch beide Container gemeinsam mit Anhänger abgeholt werden. 
                  Eine separate Abholung ohne Anhänger wird mit zusätzlichen 65,00 € netto berechnet.
                </p>
                ` : (data.quantity || 1) > 1 ? `
                <p style="margin: 0 0 10px; font-weight: 600; color: #856404; font-size: 14px;">Hinweis: 2 Container (separate Lieferung)</p>
                <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.5;">
                  Dieses Angebot umfasst <strong>2 Container</strong>, die an unterschiedlichen Tagen geliefert werden.
                  Jeder Container wird separat transportiert und abgerechnet.
                </p>
                <p style="margin: 10px 0 0; color: #856404; font-size: 13px; line-height: 1.5;">
                  Die <strong>erstmalige Anlieferung</strong> eines leeren Containers wird mit einer Gestellungspauschale von 65,00 € netto berechnet.
                </p>
                ` : `
                <p style="margin: 0 0 10px; font-weight: 600; color: #856404; font-size: 14px;">Hinweis zur Abrechnung</p>
                <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.5;">
                  Bei fortlaufenden Aufträgen bilden die Abholung des vollen Containers und die gleichzeitige Stellung eines neuen leeren Containers zusammen mit der Entsorgung einen <strong>Gesamtpreis</strong>.
                </p>
                <p style="margin: 10px 0 0; color: #856404; font-size: 13px; line-height: 1.5;">
                  Die <strong>erstmalige Anlieferung</strong> eines leeren Containers wird separat mit einer einmaligen Gestellungspauschale von 65,00 € netto berechnet.
                </p>
                `}
              </div>
              
              <!-- CTA Section -->
              <div style="text-align: center; margin: 25px 0; padding: 25px; background: ${lightGray}; border-radius: 8px;">
                <p style="margin: 0 0 15px; font-size: 15px; color: ${primaryGreen};">Möchten Sie ${(data.quantity || 1) > 1 ? 'die Container' : 'diesen Container'} bestellen?</p>
                <a href="mailto:${replyEmail}?subject=Container-Bestellung%20${(data.quantity || 1) > 1 ? `${data.quantity}x%20` : ''}${encodeURIComponent(data.materialName)}%20${data.containerSize}m³&body=Sehr%20geehrtes%20Rieprecht-Team,%0A%0Aich%20möchte%20${(data.quantity || 1) > 1 ? 'die%20Container' : 'den%20Container'}%20aus%20dem%20Angebot%20bestellen.%0A%0AMein%20Wunschtermin:%20%0A%0AMit%20freundlichen%20Grüßen%0A${encodeURIComponent(fullName)}" style="display: inline-block; background: ${primaryGreen}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Ja, ${(data.quantity || 1) > 1 ? 'Container bestellen' : 'Container bestellen'}
                </a>
                <p style="margin: 12px 0 0; font-size: 12px; color: ${primaryGreen}; opacity: 0.6;">Bitte teilen Sie uns Ihren Wunschtermin mit!</p>
              </div>
              
              <p style="font-size: 13px; color: ${primaryGreen}; opacity: 0.6; margin: 20px 0 0;">
                Bei Fragen stehen wir Ihnen gerne zur Verfügung. Antworten Sie einfach auf diese E-Mail oder rufen Sie uns an.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: ${primaryGreen}; color: white; padding: 20px 30px; text-align: center; font-size: 13px;">
              <p style="margin: 0; font-weight: 600;">Rieprecht GmbH</p>
              <p style="margin: 4px 0 0; opacity: 0.9;">Containerdienst Hamburg</p>
              <p style="margin: 12px 0 0;">
                <a href="https://shop.rieprecht-gmbh.de" style="color: white; opacity: 0.8; text-decoration: none;">shop.rieprecht-gmbh.de</a>
              </p>
              <p style="margin: 10px 0 0; font-size: 11px; opacity: 0.7;">
                Dieses Angebot ist unverbindlich und 14 Tage gültig.
              </p>
            </div>
            
          </div>
        </body>
        </html>
      `,
    });

    console.log('Quote email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send quote email:', error);
    return false;
  }
}

// Send price calculation comparison email
export interface PriceCalculationEmailData {
  to: string;
  materialName: string;
  avvCode: string;
  containerSize: number;
  weightT: number;
  volumeM3: number;
  pricePerTonne: number;
  materialCostTonne: number;
  containerPickup: number;
  totalNettTonne: number;
  totalBruttoTonne: number;
  pricePerM3: number;
  materialCostM3: number;
  totalNettM3: number;
  totalBruttoM3: number;
  surchargeLinesTonne?: { name: string; total: number }[];
  surchargeLinesCubic?: { name: string; total: number }[];
}

export async function sendPriceCalculationEmail(data: PriceCalculationEmailData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const primaryGreen = "#1a5a2e";
    const lightGray = "#f7f7f7";
    const logoUrl = `${getBaseUrl()}/rieprecht-logo.png`;
    
    // Format currency in German style
    const formatEur = (val: number) => {
      return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    };

    const result = await client.emails.send({
      from: fromEmail,
      to: [data.to],
      subject: `Preisberechnung: ${data.containerSize}m³ ${data.materialName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background: #e8e8e8; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: ${primaryGreen}; color: white; padding: 25px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 600;">Preisberechnung</h1>
              <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${data.containerSize}m³ ${escapeHtml(data.materialName)}</p>
            </div>
            
            <!-- Logo Bar -->
            <div style="background: ${lightGray}; padding: 15px 30px; text-align: center; border-bottom: 1px solid #ddd;">
              <img src="${logoUrl}" alt="Rieprecht GmbH" style="height: 40px; width: auto;">
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
              
              <p style="margin: 0 0 20px; color: ${primaryGreen};">
                <strong>Material:</strong> ${escapeHtml(data.materialName)} (AVV ${escapeHtml(data.avvCode)})<br>
                <strong>Container:</strong> ${data.containerSize} m³<br>
                <strong>Geschätztes Gewicht:</strong> ${data.weightT.toFixed(1)} t<br>
                <strong>Volumen:</strong> ${data.volumeM3.toFixed(1)} m³
              </p>
              
              <!-- Per Tonne Calculation -->
              <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px; color: #1565c0; font-size: 16px;">Variante 1: Nach Gewicht (Tonnen)</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Materialpreis</td>
                    <td style="padding: 6px 0; text-align: right;">${data.weightT.toFixed(1)} t × ${formatEur(data.pricePerTonne)}/t</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500; width: 100px;">${formatEur(data.materialCostTonne)}</td>
                  </tr>
                  ${(data.surchargeLinesTonne || []).map(s => `
                  <tr style="color: #e65100;">
                    <td style="padding: 6px 0;">${escapeHtml(s.name)}</td>
                    <td style="padding: 6px 0;"></td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">${formatEur(s.total)}</td>
                  </tr>`).join('')}
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Container Abholung/Tausch</td>
                    <td style="padding: 6px 0;"></td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">${formatEur(data.containerPickup)}</td>
                  </tr>
                  <tr style="border-top: 2px solid #1565c0;">
                    <td style="padding: 12px 0 6px; font-weight: 700; color: #1565c0;">Netto</td>
                    <td></td>
                    <td style="padding: 12px 0 6px; text-align: right; font-weight: 700; font-size: 18px; color: #1565c0;">${formatEur(data.totalNettTonne)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Brutto (inkl. 19% MwSt.)</td>
                    <td></td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #333;">${formatEur(data.totalBruttoTonne)}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Per m³ Calculation -->
              <div style="background: #f3e5f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px; color: #7b1fa2; font-size: 16px;">Variante 2: Nach Volumen (Kubikmeter)</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Materialpreis</td>
                    <td style="padding: 6px 0; text-align: right;">${data.volumeM3.toFixed(1)} m³ × ${formatEur(data.pricePerM3)}/m³</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500; width: 100px;">${formatEur(data.materialCostM3)}</td>
                  </tr>
                  ${(data.surchargeLinesCubic || []).map(s => `
                  <tr style="color: #e65100;">
                    <td style="padding: 6px 0;">${escapeHtml(s.name)}</td>
                    <td style="padding: 6px 0;"></td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">${formatEur(s.total)}</td>
                  </tr>`).join('')}
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Container Abholung/Tausch</td>
                    <td style="padding: 6px 0;"></td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500;">${formatEur(data.containerPickup)}</td>
                  </tr>
                  <tr style="border-top: 2px solid #7b1fa2;">
                    <td style="padding: 12px 0 6px; font-weight: 700; color: #7b1fa2;">Netto</td>
                    <td></td>
                    <td style="padding: 12px 0 6px; text-align: right; font-weight: 700; font-size: 18px; color: #7b1fa2;">${formatEur(data.totalNettM3)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666;">Brutto (inkl. 19% MwSt.)</td>
                    <td></td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #333;">${formatEur(data.totalBruttoM3)}</td>
                  </tr>
                </table>
              </div>
              
              ${(data.surchargeLinesTonne || []).length > 0 ? `<p style="font-size: 12px; color: #666; margin: 20px 0 0; padding-top: 15px; border-top: 1px solid #ddd;">
                <strong>Hinweis:</strong> Die Zuschläge werden gemäß der hinterlegten Zuschlagstabelle berechnet.
              </p>` : ''}
            </div>
            
            <!-- Footer -->
            <div style="background: ${primaryGreen}; color: white; padding: 20px 30px; text-align: center; font-size: 13px;">
              <p style="margin: 0; font-weight: 600;">Rieprecht GmbH</p>
              <p style="margin: 4px 0 0; opacity: 0.9;">Containerdienst Hamburg</p>
            </div>
            
          </div>
        </body>
        </html>
      `,
    });

    console.log('Price calculation email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send price calculation email:', error);
    return false;
  }
}

export async function sendReportEmail(to: string, reportHtml: string, date: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Kalkulationsvergleich Rieprecht GmbH – ${date}`,
      html: reportHtml,
    });

    console.log('Report email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send report email:', error);
    return false;
  }
}

export async function sendPriceListEmail(to: string, pdfBuffer: Buffer, customerName?: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const subject = customerName
      ? `Preisliste Containerservice – ${customerName} | Rieprecht GmbH`
      : `Aktuelle Preisliste Containerservice | Rieprecht GmbH`;

    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const greeting = customerName ? `Hallo ${customerName}` : 'Hallo';
    const fileName = `Preisliste_Rieprecht_${customerName?.replace(/\s+/g, '_') || 'Allgemein'}_${new Date().toISOString().split('T')[0]}.pdf`;

    const primaryGreen = "#1a5a2e";
    const lightGray = "#f7f7f7";
    const logoUrl = `${getBaseUrl()}/rieprecht-logo.png`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: ${primaryGreen}; margin: 0; padding: 0; background: ${lightGray};">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px;">

          <!-- Header -->
          <div style="background: ${primaryGreen}; color: white; padding: 25px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 1px;">Rieprecht GmbH</h1>
            <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Containerdienst Hamburg &amp; Umgebung</p>
          </div>

          <!-- Logo Bar -->
          <div style="padding: 18px 30px; background: ${lightGray}; border-bottom: 2px solid white; text-align: center;">
            <img src="${logoUrl}" alt="Rieprecht GmbH" width="100" height="auto" style="display: inline-block; border-radius: 8px;">
          </div>

          <!-- Content -->
          <div style="padding: 25px 30px;">
            <p style="font-size: 16px; margin: 0 0 15px; color: ${primaryGreen};">${greeting},</p>

            <p style="margin: 0 0 20px; color: ${primaryGreen}; opacity: 0.8;">anbei erhalten Sie unsere aktuelle Preisliste für Containerservice und Entsorgung.</p>

            <!-- Info Box -->
            <div style="background: ${lightGray}; border-radius: 8px; padding: 18px; margin: 20px 0;">
              <p style="margin: 0 0 10px; font-weight: 600; color: ${primaryGreen}; font-size: 14px;">Die Preisliste beinhaltet:</p>
              <ul style="margin: 0; padding-left: 20px; color: ${primaryGreen}; opacity: 0.8; font-size: 13px;">
                <li style="margin-bottom: 5px;">Entsorgungspreise pro m³ und Tonne</li>
                <li style="margin-bottom: 5px;">7 m³ Container – alle Abfallarten mit Pauschalpreisen</li>
                <li style="margin-bottom: 0;">10 m³ Container – alle Abfallarten mit Pauschalpreisen</li>
              </ul>
            </div>

            <!-- Service Prices -->
            <div style="background: ${lightGray}; border-radius: 8px; padding: 18px; margin: 20px 0;">
              <p style="margin: 0 0 10px; font-weight: 600; color: ${primaryGreen}; font-size: 14px;">Unsere Servicepreise (netto):</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: ${primaryGreen};">
                <tr>
                  <td style="padding: 6px 0; opacity: 0.7;">Containergestellung (einmalig)</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600;">65,00 €</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; opacity: 0.7; border-top: 2px solid white;">Containertausch / Abholung</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600; border-top: 2px solid white;">135,00 €</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: ${primaryGreen}; opacity: 0.6; margin: 20px 0;">
              Bei Fragen stehen wir Ihnen gerne zur Verfügung. Antworten Sie einfach auf diese E-Mail oder rufen Sie uns an.
            </p>

            <p style="margin-top: 20px; font-size: 14px;">
              Mit freundlichen Grüßen<br>
              <strong style="color: ${primaryGreen};">Rieprecht GmbH</strong>
            </p>
          </div>

          <!-- Footer -->
          <div style="background: ${primaryGreen}; color: white; padding: 20px 30px; text-align: center; font-size: 13px;">
            <p style="margin: 0; font-weight: 600;">Rieprecht GmbH</p>
            <p style="margin: 4px 0 0; opacity: 0.9;">Containerdienst Hamburg &amp; Umgebung</p>
            <p style="margin: 8px 0 0; opacity: 0.8; font-size: 12px;">Heinrichstraße 11 | 22946 Brunsbek</p>
            <p style="margin: 4px 0 0; opacity: 0.8; font-size: 12px;">Tel: (+49) 162 – 5231470 | info@rieprecht-gmbh.de</p>
            <p style="margin: 12px 0 0;">
              <a href="https://www.rieprecht-gmbh.de" style="color: white; opacity: 0.8; text-decoration: none;">www.rieprecht-gmbh.de</a>
            </p>
            <p style="margin: 12px 0 0; font-size: 15px; font-weight: 700; font-style: italic; color: #f4a261; letter-spacing: 1px;">
              Schnell. Sauber. Zuverlässig.
            </p>
            <p style="margin: 8px 0 0; font-size: 10px; opacity: 0.6;">
              Stand: ${today} | Alle Preise netto zzgl. 19% MwSt.
            </p>
          </div>

        </div>
      </body>
      </html>`;

    const result = await client.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html: emailHtml,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer.toString('base64'),
        },
      ],
    });

    console.log('Price list email sent with PDF attachment:', result);
    return true;
  } catch (error) {
    console.error('Failed to send price list email:', error);
    return false;
  }
}

// ============================================================
// Aufgaben & Notizen — Reminder & Eskalation
// ============================================================

interface TaskEmailRecipient {
  email: string;
  name: string;
}

interface TaskEmailData {
  id: number;
  title: string;
  description?: string | null;
  dueDate?: Date | string | null;
  priority: string;
  status: string;
}

function priorityLabel(p: string): string {
  switch (p) {
    case "niedrig": return "Niedrig";
    case "hoch": return "Hoch";
    case "dringend": return "Dringend";
    default: return "Mittel";
  }
}

function priorityColor(p: string): string {
  switch (p) {
    case "niedrig": return "#6b7280";
    case "hoch": return "#ea580c";
    case "dringend": return "#dc2626";
    default: return "#2563eb";
  }
}

function formatGermanDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function taskEmailShell(opts: {
  headlineColor: string;
  headline: string;
  intro: string;
  task: TaskEmailData;
  ctaLabel: string;
}): string {
  const taskUrl = `${getBaseUrl()}/tasks?taskId=${opts.task.id}`;
  const desc = opts.task.description
    ? `<p style="margin: 12px 0; color: #374151; white-space: pre-wrap;">${escapeHtml(opts.task.description).slice(0, 600)}</p>`
    : "";
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6;">
      <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden;">
        <div style="background: ${opts.headlineColor}; color: white; padding: 22px 28px;">
          <h1 style="margin: 0; font-size: 22px;">${opts.headline}</h1>
          <p style="margin: 4px 0 0; opacity: 0.9; font-size: 13px;">Rieprecht Container Calculator · Aufgaben</p>
        </div>
        <div style="padding: 24px 28px;">
          <p style="margin: 0 0 18px; font-size: 15px;">${opts.intro}</p>

          <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px 18px; background: #fafafa;">
            <h2 style="margin: 0 0 8px; font-size: 18px; color: #111827;">${escapeHtml(opts.task.title)}</h2>
            <p style="margin: 0 0 4px; font-size: 13px;">
              <strong>Fällig:</strong> ${formatGermanDateTime(opts.task.dueDate)}
              &nbsp;·&nbsp;
              <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; background: ${priorityColor(opts.task.priority)}; color: white; font-size: 11px; font-weight: 600;">
                ${priorityLabel(opts.task.priority)}
              </span>
            </p>
            ${desc}
          </div>

          <p style="text-align: center; margin: 24px 0;">
            <a href="${taskUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              ${opts.ctaLabel}
            </a>
          </p>

          <p style="font-size: 12px; color: #6b7280; margin: 24px 0 0;">
            Sie können E-Mail-Erinnerungen in den Benachrichtigungs-Einstellungen deaktivieren.
          </p>
        </div>
        <div style="background: #f3f4f6; padding: 14px; text-align: center; font-size: 11px; color: #6b7280;">
          Rieprecht GmbH · Diese E-Mail wurde automatisch generiert.
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendTaskAssignedEmail(args: {
  to: string;
  recipientName: string;
  task: TaskEmailData;
  creatorName: string;
}): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const html = taskEmailShell({
      headlineColor: "#2563eb",
      headline: "Neue Aufgabe für Sie",
      intro: `Hallo ${escapeHtml(args.recipientName)}, <strong>${escapeHtml(args.creatorName)}</strong> hat Ihnen eine neue Aufgabe zugewiesen:`,
      task: args.task,
      ctaLabel: "Aufgabe öffnen",
    });
    await client.emails.send({
      from: fromEmail,
      to: [args.to],
      subject: `Neue Aufgabe: ${args.task.title}`,
      html,
    });
    return true;
  } catch (error) {
    console.error("Failed to send task assigned email:", error);
    return false;
  }
}

export async function sendTaskReminderEmail(args: {
  recipients: TaskEmailRecipient[];
  task: TaskEmailData;
}): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const html = taskEmailShell({
      headlineColor: "#ea580c",
      headline: "Erinnerung: Aufgabe wird bald fällig",
      intro: `Diese Aufgabe ist in den nächsten 24 Stunden fällig:`,
      task: args.task,
      ctaLabel: "Jetzt öffnen",
    });
    await client.emails.send({
      from: fromEmail,
      to: args.recipients.map(r => r.email),
      subject: `Erinnerung: ${args.task.title} (fällig ${formatGermanDateTime(args.task.dueDate)})`,
      html,
    });
    return true;
  } catch (error) {
    console.error("Failed to send task reminder email:", error);
    return false;
  }
}

export async function sendTaskEscalationEmail(args: {
  recipients: TaskEmailRecipient[];
  cc: string[];
  task: TaskEmailData;
}): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const html = taskEmailShell({
      headlineColor: "#dc2626",
      headline: "Aufgabe überfällig",
      intro: `Diese Aufgabe ist überfällig und noch nicht erledigt:`,
      task: args.task,
      ctaLabel: "Jetzt erledigen",
    });
    const to = args.recipients.length > 0 ? args.recipients.map(r => r.email) : args.cc;
    const cc = args.recipients.length > 0 ? args.cc : [];
    await client.emails.send({
      from: fromEmail,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: `Überfällig: ${args.task.title}`,
      html,
    });
    return true;
  } catch (error) {
    console.error("Failed to send task escalation email:", error);
    return false;
  }
}
