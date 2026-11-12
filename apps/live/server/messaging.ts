import nodemailer from 'nodemailer';
import { isProduction } from './security';

/** Résultat réel d'un envoi. « demo » n'existe qu'hors production, sans fournisseur configuré. */
export type Delivery = 'sent' | 'demo' | 'failed' | 'not_configured';

const env = (k: string, d = '') => (process.env[k] ?? d).trim();
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const emailProviderReady = () => Boolean(env('RESEND_API_KEY') || env('BREVO_API_KEY') || (env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS')));
export const phoneProviderReady = () => Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN'));

/* ───────── E-mail (Resend, Brevo ou SMTP) ───────── */
export async function sendEmail(to: string, subject: string, text: string): Promise<Delivery> {
  if (!to) return 'not_configured';
  const fromEmail = env('MAIL_FROM_EMAIL', 'notifications@pelify.app');
  const fromName = env('MAIL_FROM_NAME', 'PELIFY Arena');
  const html = `<div style="font-family:Montserrat,Arial,sans-serif;color:#141414;max-width:560px;margin:auto;border-top:4px solid #00ffcc;padding:20px"><p style="font-weight:700;color:#0a7a66;margin:0 0 12px">PELIFY Arena</p>${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;

  if (!emailProviderReady()) {
    if (isProduction()) return 'not_configured';
    console.log(`[démo] e-mail à ${to}\nObjet : ${subject}\n${text}\n`);
    return 'demo';
  }

  if (env('RESEND_API_KEY')) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, text, html }),
      });
      if (r.ok) return 'sent';
      console.error('[Resend]', r.status, await r.text().catch(() => ''));
    } catch (e: any) {
      console.error('[Resend]', e.message);
    }
  }
  if (env('BREVO_API_KEY')) {
    try {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env('BREVO_API_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: { name: fromName, email: fromEmail }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
      });
      if (r.ok) return 'sent';
      console.error('[Brevo]', r.status, await r.text().catch(() => ''));
    } catch (e: any) {
      console.error('[Brevo]', e.message);
    }
  }
  if (env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS')) {
    try {
      const transporter = nodemailer.createTransport({
        host: env('SMTP_HOST'),
        port: parseInt(env('SMTP_PORT', '587'), 10),
        secure: env('SMTP_SECURE') === 'true',
        auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
      });
      await transporter.sendMail({ from: `"${fromName}" <${env('MAIL_FROM_EMAIL') || env('SMTP_USER')}>`, to, subject, text, html });
      return 'sent';
    } catch (e: any) {
      console.error('[SMTP]', e.message);
    }
  }
  return 'failed';
}

/* ───────── SMS et WhatsApp (Twilio) ───────── */
export async function sendPhoneMessage(channel: 'sms' | 'whatsapp', toE164: string, body: string, template?: { contentSid: string; variables: string[] }): Promise<Delivery> {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  const from = channel === 'whatsapp' ? env('TWILIO_WHATSAPP_FROM') : env('TWILIO_SMS_FROM');
  if (!toE164) return 'not_configured';
  if (!sid || !token || !from) {
    if (isProduction()) return 'not_configured';
    console.log(`[démo] ${channel} à ${toE164}\n${body}\n`);
    return 'demo';
  }
  try {
    const wa = (n: string) => (channel === 'whatsapp' ? `whatsapp:${n}` : n);
    const params = new URLSearchParams({ From: wa(from), To: wa(toE164) });
    if (channel === 'whatsapp' && template?.contentSid) {
      params.set('ContentSid', template.contentSid);
      params.set('ContentVariables', JSON.stringify(Object.fromEntries(template.variables.map((v, i) => [String(i + 1), v]))));
    } else {
      params.set('Body', body);
    }
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (r.ok) return 'sent';
    console.error('[Twilio]', r.status, await r.text().catch(() => ''));
    return 'failed';
  } catch (e: any) {
    console.error('[Twilio]', e.message);
    return 'failed';
  }
}

/* ───────── Code de vérification ───────── */
export type CodeChannel = 'email' | 'sms' | 'whatsapp';

/** True si le canal peut réellement transmettre le code (ou simuler en développement). */
export const channelAvailable = (c: CodeChannel) => (c === 'email' ? emailProviderReady() : phoneProviderReady()) || !isProduction();
export const isDemoChannel = (c: CodeChannel) => !isProduction() && !(c === 'email' ? emailProviderReady() : phoneProviderReady());

export async function deliverCode(channel: CodeChannel, target: { email: string; phoneE164: string }, code: string): Promise<Delivery> {
  const text = `Votre code de vérification PELIFY Arena est ${code}. Il expire dans 10 minutes. Ne le communiquez à personne.`;
  if (channel === 'email') return sendEmail(target.email, `Votre code PELIFY Arena : ${code}`, text);
  return sendPhoneMessage(channel, target.phoneE164, text, channel === 'whatsapp' && env('TWILIO_WHATSAPP_OTP_CONTENT_SID') ? { contentSid: env('TWILIO_WHATSAPP_OTP_CONTENT_SID'), variables: [code] } : undefined);
}
