import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "");
  }
  return _resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "iArtisan <noreply@iartisan.io>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.iartisan.io";

// ============================================================
// Template wrapper — design professionnel iArtisan
// ============================================================
function emailLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#1e3a5f,#2d5a8e);padding:28px 32px;text-align:center">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px">iArtisan</h1>
<p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Votre assistant IA pour artisans du BTP</p>
</td></tr>
<!-- Body -->
<tr><td style="padding:32px">${content}</td></tr>
<!-- Footer -->
<tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
<p style="margin:0;color:#94a3b8;font-size:12px">iArtisan &mdash; L'IA qui travaille pour votre entreprise</p>
<p style="margin:4px 0 0;color:#94a3b8;font-size:11px">Cet email a &eacute;t&eacute; envoy&eacute; automatiquement, merci de ne pas y r&eacute;pondre.</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function button(text: string, url: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
<tr><td align="center">
<a href="${url}" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${text}</a>
</td></tr></table>`;
}

// ============================================================
// Email : Bienvenue nouveau client (après conversion lead)
// ============================================================
export async function sendWelcomeEmail(to: string, data: {
  firstName: string;
  tempPassword: string;
  plan: string;
}) {
  const content = `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">Bienvenue ${data.firstName} !</h2>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Votre espace iArtisan est pr&ecirc;t. Voici vos identifiants pour vous connecter :
</p>
<table width="100%" style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
<tr><td>
<p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600">EMAIL</p>
<p style="margin:0 0 16px;color:#1e293b;font-size:15px;font-weight:500">${to}</p>
<p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600">MOT DE PASSE TEMPORAIRE</p>
<p style="margin:0;color:#1e293b;font-size:18px;font-weight:700;font-family:monospace;letter-spacing:2px">${data.tempPassword}</p>
</td></tr></table>
<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px">
Plan activ&eacute; : <strong>${data.plan}</strong> &mdash; P&eacute;riode d'essai de 14 jours
</p>
${button("Se connecter", `${APP_URL}/client/login`)}
<p style="color:#94a3b8;font-size:13px;margin:0;text-align:center">
Pensez &agrave; changer votre mot de passe apr&egrave;s la premi&egrave;re connexion.
</p>`;

  return sendEmail(to, `Bienvenue sur iArtisan, ${data.firstName} !`, emailLayout("Bienvenue", content));
}

// ============================================================
// Email : Nouveau mot de passe (forgot password)
// ============================================================
export async function sendPasswordResetEmail(to: string, data: {
  firstName: string;
  newPassword: string;
}) {
  const content = `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">R&eacute;initialisation du mot de passe</h2>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Bonjour ${data.firstName}, votre mot de passe a &eacute;t&eacute; r&eacute;initialis&eacute;. Voici votre nouveau mot de passe :
</p>
<table width="100%" style="background:#f1f5f9;border-radius:8px;padding:20px;margin:16px 0;text-align:center">
<tr><td>
<p style="margin:0;color:#1e293b;font-size:22px;font-weight:700;font-family:monospace;letter-spacing:3px">${data.newPassword}</p>
</td></tr></table>
${button("Se connecter", `${APP_URL}/client/login`)}
<p style="color:#ef4444;font-size:13px;margin:0;text-align:center">
Si vous n'avez pas demand&eacute; cette r&eacute;initialisation, contactez-nous imm&eacute;diatement.
</p>`;

  return sendEmail(to, "Votre nouveau mot de passe iArtisan", emailLayout("Mot de passe", content));
}

// ============================================================
// Email : Notification admin (nouveau lead, nouveau client, etc.)
// ============================================================
export async function sendAdminNotification(subject: string, data: {
  title: string;
  details: Record<string, string>;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL || "faicel@iartisan.io";

  let detailsHtml = "";
  for (const [key, value] of Object.entries(data.details)) {
    detailsHtml += `<tr>
<td style="padding:8px 12px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #f1f5f9">${key}</td>
<td style="padding:8px 12px;color:#1e293b;font-size:14px;border-bottom:1px solid #f1f5f9">${value}</td>
</tr>`;
  }

  const content = `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">${data.title}</h2>
<table width="100%" style="border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;margin:16px 0">
${detailsHtml}
</table>
${data.ctaLabel && data.ctaUrl ? button(data.ctaLabel, data.ctaUrl) : ""}`;

  return sendEmail(adminEmail, subject, emailLayout("Notification", content));
}

// ============================================================
// Email : Fin de période d'essai (rappel J-3)
// ============================================================
export async function sendTrialEndingEmail(to: string, data: {
  firstName: string;
  daysLeft: number;
  plan: string;
}) {
  const content = `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">Votre essai se termine bient&ocirc;t</h2>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Bonjour ${data.firstName}, votre p&eacute;riode d'essai du plan <strong>${data.plan}</strong> se termine dans <strong>${data.daysLeft} jour${data.daysLeft > 1 ? "s" : ""}</strong>.
</p>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Pour continuer &agrave; b&eacute;n&eacute;ficier de vos agents IA sans interruption, pensez &agrave; activer votre abonnement.
</p>
${button("G\u00e9rer mon abonnement", `${APP_URL}/client`)}
<p style="color:#94a3b8;font-size:13px;margin:0;text-align:center">
Des questions ? R&eacute;pondez directement sur Telegram ou contactez-nous.
</p>`;

  return sendEmail(to, `${data.firstName}, votre essai iArtisan se termine dans ${data.daysLeft} jours`, emailLayout("Essai", content));
}

// ============================================================
// Email : Confirmation d'abonnement activé
// ============================================================
export async function sendSubscriptionActiveEmail(to: string, data: {
  firstName: string;
  plan: string;
  amount: string;
}) {
  const content = `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">Abonnement activ&eacute; !</h2>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Bonjour ${data.firstName}, votre abonnement <strong>${data.plan}</strong> est maintenant actif.
</p>
<table width="100%" style="background:#ecfdf5;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
<tr><td>
<p style="margin:0;color:#059669;font-size:14px;font-weight:600">&#10003; Abonnement actif</p>
<p style="margin:8px 0 0;color:#1e293b;font-size:20px;font-weight:700">${data.amount}&euro;/mois</p>
</td></tr></table>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Vos agents IA sont d&eacute;sormais op&eacute;rationnels 24h/24. Acc&eacute;dez &agrave; votre espace pour suivre leur activit&eacute;.
</p>
${button("Mon espace client", `${APP_URL}/client`)}`;

  return sendEmail(to, `Abonnement ${data.plan} activé - iArtisan`, emailLayout("Abonnement", content));
}

// ============================================================
// Email : Devis envoyé au client final (client de l'artisan)
// ============================================================
export async function sendDevisEmail(to: string, data: {
  clientName: string;
  artisanCompany: string;
  devisNumber: string;
  objet: string;
  totalTTC: string;
  validUntil?: string;
  pdfUrl: string;
}) {
  const content = `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">Nouveau devis</h2>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Bonjour ${data.clientName},
</p>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
<strong>${data.artisanCompany}</strong> vous a envoy&eacute; un devis pour les travaux suivants :
</p>
<table width="100%" style="background:#f1f5f9;border-radius:8px;margin:16px 0;border-collapse:collapse">
<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">Devis N&deg;</td>
<td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:700;border-bottom:1px solid #e2e8f0">${data.devisNumber}</td>
</tr>
<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">Objet</td>
<td style="padding:12px 16px;color:#1e293b;font-size:14px;border-bottom:1px solid #e2e8f0">${data.objet}</td>
</tr>
<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">Montant TTC</td>
<td style="padding:12px 16px;color:#1e293b;font-size:18px;font-weight:700;border-bottom:1px solid #e2e8f0">${data.totalTTC}&nbsp;&euro;</td>
</tr>
${data.validUntil ? `<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600">Valide jusqu'au</td>
<td style="padding:12px 16px;color:#1e293b;font-size:14px">${data.validUntil}</td>
</tr>` : ""}
</table>
${button("Voir le devis", data.pdfUrl)}
<p style="color:#94a3b8;font-size:13px;margin:0;text-align:center">
Pour accepter ce devis, contactez directement ${data.artisanCompany}.
</p>`;

  return sendEmail(to, `Devis ${data.devisNumber} — ${data.artisanCompany}`, emailLayout("Devis", content));
}

// ============================================================
// Email : Facture disponible (client de l'artisan)
// ============================================================
export async function sendFactureEmail(to: string, data: {
  clientName: string;
  artisanCompany: string;
  factureNumber: string;
  totalTTC: string;
  echeance?: string;
  pdfUrl: string;
}) {
  const content = `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">Nouvelle facture</h2>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Bonjour ${data.clientName},
</p>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
<strong>${data.artisanCompany}</strong> vous a envoy&eacute; une facture :
</p>
<table width="100%" style="background:#f1f5f9;border-radius:8px;margin:16px 0;border-collapse:collapse">
<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">Facture N&deg;</td>
<td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:700;border-bottom:1px solid #e2e8f0">${data.factureNumber}</td>
</tr>
<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">Montant TTC</td>
<td style="padding:12px 16px;color:#1e293b;font-size:18px;font-weight:700;border-bottom:1px solid #e2e8f0">${data.totalTTC}&nbsp;&euro;</td>
</tr>
${data.echeance ? `<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600">&Eacute;ch&eacute;ance</td>
<td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:600">${data.echeance}</td>
</tr>` : ""}
</table>
${button("Voir la facture", data.pdfUrl)}
<p style="color:#94a3b8;font-size:13px;margin:0;text-align:center">
Merci de proc&eacute;der au r&egrave;glement dans les d&eacute;lais indiqu&eacute;s.
</p>`;

  return sendEmail(to, `Facture ${data.factureNumber} — ${data.artisanCompany}`, emailLayout("Facture", content));
}

// ============================================================
// Email : Rappel de paiement (client de l'artisan)
// ============================================================
export async function sendPaymentReminderEmail(to: string, data: {
  clientName: string;
  artisanCompany: string;
  factureNumber: string;
  totalTTC: string;
  echeance: string;
  daysOverdue: number;
  pdfUrl: string;
  artisanPhone?: string;
}) {
  const urgencyColor = data.daysOverdue > 30 ? "#dc2626" : data.daysOverdue > 14 ? "#ea580c" : "#d97706";
  const urgencyLabel = data.daysOverdue > 30 ? "Rappel urgent" : data.daysOverdue > 14 ? "Second rappel" : "Rappel de paiement";

  const content = `
<div style="background:${urgencyColor}10;border-left:4px solid ${urgencyColor};border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px">
<p style="margin:0;color:${urgencyColor};font-size:14px;font-weight:700">${urgencyLabel} &mdash; ${data.daysOverdue} jour${data.daysOverdue > 1 ? "s" : ""} de retard</p>
</div>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Bonjour ${data.clientName},
</p>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
Sauf erreur de notre part, nous n'avons pas encore re&ccedil;u le r&egrave;glement de la facture suivante :
</p>
<table width="100%" style="background:#f1f5f9;border-radius:8px;margin:16px 0;border-collapse:collapse">
<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">Facture N&deg;</td>
<td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:700;border-bottom:1px solid #e2e8f0">${data.factureNumber}</td>
</tr>
<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">Montant d&ucirc;</td>
<td style="padding:12px 16px;color:${urgencyColor};font-size:18px;font-weight:700;border-bottom:1px solid #e2e8f0">${data.totalTTC}&nbsp;&euro;</td>
</tr>
<tr>
<td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600">&Eacute;ch&eacute;ance d&eacute;pass&eacute;e</td>
<td style="padding:12px 16px;color:${urgencyColor};font-size:14px;font-weight:600">${data.echeance}</td>
</tr>
</table>
<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px">
Nous vous remercions de bien vouloir proc&eacute;der au r&egrave;glement dans les meilleurs d&eacute;lais. Si le paiement a d&eacute;j&agrave; &eacute;t&eacute; effectu&eacute;, merci de ne pas tenir compte de ce message.
</p>
${button("Voir la facture", data.pdfUrl)}
${data.artisanPhone ? `<p style="color:#94a3b8;font-size:13px;margin:0;text-align:center">Une question ? Appelez le ${data.artisanPhone}</p>` : ""}`;

  return sendEmail(to, `${urgencyLabel} — Facture ${data.factureNumber} — ${data.artisanCompany}`, emailLayout("Rappel", content));
}

// ============================================================
// Core send function with error handling
// ============================================================
async function sendEmail(to: string, subject: string, html: string) {
  // Si pas de clé API, log et skip (dev mode)
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SKIP] No RESEND_API_KEY. Would send to ${to}: ${subject}`);
    return { success: false, reason: "no_api_key" };
  }

  try {
    const result: any = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    // Resend SDK returns { data, error } — un échec ne throw PAS, il revient
    // dans `result.error`. On doit donc le checker explicitement.
    if (result?.error) {
      console.error(
        `[EMAIL ERROR] Resend rejected to ${to} | subject="${subject}" | from="${FROM_EMAIL}" | error=${JSON.stringify(
          result.error
        )}`
      );
      return { success: false, error: result.error };
    }
    console.log(
      `[EMAIL OK] Sent to ${to} | subject="${subject}" | id=${result?.data?.id || "?"}`
    );
    return { success: true, data: result?.data };
  } catch (error: any) {
    console.error(
      `[EMAIL ERROR] Throw to ${to} | subject="${subject}" | err=${error?.message || String(error)}`
    );
    return { success: false, error: error?.message || String(error) };
  }
}
