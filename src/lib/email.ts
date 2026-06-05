import nodemailer from 'nodemailer';

let transporterCache: nodemailer.Transporter | null = null;

function transporter() {
  if (transporterCache) return transporterCache;
  transporterCache = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporterCache;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function enviarEmail({ to, subject, html, text }: SendArgs) {
  // No bloqueamos el flujo si SMTP no esta configurado, solo log y false.
  if (!process.env.SMTP_HOST) {
    console.warn('[email] SMTP no configurado, no se envia email a', to);
    return { sent: false, reason: 'smtp_no_configurado' };
  }
  const from = process.env.SMTP_FROM ?? 'no-reply@tramitesdiamante.mx';
  await transporter().sendMail({ from, to, subject, html, text });
  return { sent: true };
}

export function plantillaActaLista(args: {
  nombreCliente: string;
  folio: string;
  tipoActa: string;
  urlDescarga: string;
}) {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0b1437">
    <div style="background:#0b1437;color:white;padding:24px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:22px">Tramites Diamante</h1>
    </div>
    <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
      <p>Hola <strong>${escapeHtml(args.nombreCliente)}</strong>,</p>
      <p>Tu pedido <strong>${escapeHtml(args.folio)}</strong> de acta de
         <strong>${escapeHtml(args.tipoActa.toLowerCase())}</strong> esta listo para descargar.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${args.urlDescarga}"
           style="background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
          Descargar acta
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">
        Este enlace caduca por seguridad. Si expira, ingresa al panel para descargarlo desde tu historial.
      </p>
    </div>
  </div>`;
  const text = `Tu pedido ${args.folio} esta listo. Descarga: ${args.urlDescarga}`;
  return { html, text };
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}
