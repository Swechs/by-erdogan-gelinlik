// New-booking e-mails to the atelier through Resend's HTTP API (free tier: 3 000 e-mails a month).
// Secrets: RESEND_API_KEY, NOTIFY_EMAIL (the atelier's inbox). Optional NOTIFY_FROM, e.g.
// "By Erdoğan <randevu@alanadi.com>" once the domain is verified in Resend; until then Resend's
// shared sender only delivers to the Resend account owner's own address.
import {env} from './env.mjs';

export function mailConfigured() {
  return Boolean(env.RESEND_API_KEY && /^\S+@\S+\.\S+$/.test(env.NOTIFY_EMAIL || ''));
}

const escape = text => String(text).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export async function sendBookingNotice({name, phone, start, model, wedding, origin}) {
  if (!mailConfigured()) return {sent: false, reason: 'not-configured'};
  const when = new Date(start).toLocaleString('tr-TR', {timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});
  const rows = [['Ad soyad', name], ['Telefon', phone], ['Prova', when], ['Model', model || 'Atölyede birlikte seçilecek'], ['Düğün tarihi', wedding || 'Belirtilmedi']];
  const text = 'Yeni prova randevusu talebi\n\n' + rows.map(([k, v]) => k + ': ' + v).join('\n') + '\n\nOnaylamak veya saatini değiştirmek için: ' + origin + '/yonetim';
  const html = '<div style="font-family:Georgia,serif;color:#2b2a28"><h2 style="font-weight:400">Yeni prova randevusu talebi</h2><table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">' +
    rows.map(([k, v]) => '<tr><td style="color:#5b564f">' + escape(k) + '</td><td>' + escape(v) + '</td></tr>').join('') +
    '</table><p style="font-family:Arial,sans-serif;font-size:14px"><a href="' + escape(origin) + '/yonetim">Yönetim panelinde aç</a></p></div>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({from: env.NOTIFY_FROM || 'By Erdoğan <onboarding@resend.dev>', to: [env.NOTIFY_EMAIL], subject: 'Yeni randevu talebi: ' + when, text, html}),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('mail ' + response.status);
  return {sent: true};
}
