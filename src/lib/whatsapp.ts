/**
 * Modulo WhatsApp pluggable.
 *
 * Drivers soportados:
 *   - 'walink'  : Genera enlace wa.me con mensaje prellenado (no envia, solo construye URL).
 *   - 'meta'    : WhatsApp Cloud API oficial de Meta.
 *   - 'twilio'  : Twilio Programmable Messaging para WhatsApp.
 *
 * Selecciona el driver con la env WHATSAPP_DRIVER.
 */

export type WhatsappDriver = 'walink' | 'meta' | 'twilio';

export interface NotificarPedidoArgs {
  telefono: string; // E.164 sin '+', ej "521XXXXXXXXXX"
  folio: string;
  tipoActa: string;
  curp: string;
  cliente: string;
  fechaHora: string;
}

export interface NotificarPedidoResult {
  driver: WhatsappDriver;
  enviado: boolean;
  url?: string;        // wa.me link cuando aplica
  messageId?: string;  // id del proveedor cuando envia
  error?: string;
}

function driver(): WhatsappDriver {
  const d = (process.env.WHATSAPP_DRIVER ?? 'walink') as WhatsappDriver;
  return ['walink', 'meta', 'twilio'].includes(d) ? d : 'walink';
}

function plantilla(args: NotificarPedidoArgs, raw: string): string {
  return raw
    .replaceAll('{{folio}}', args.folio)
    .replaceAll('{{tipoActa}}', args.tipoActa.toLowerCase())
    .replaceAll('{{curp}}', args.curp)
    .replaceAll('{{cliente}}', args.cliente)
    .replaceAll('{{fechaHora}}', args.fechaHora);
}

export async function notificarProveedorPedido(
  args: NotificarPedidoArgs,
  plantillaRaw: string,
): Promise<NotificarPedidoResult> {
  const mensaje = plantilla(args, plantillaRaw);
  const drv = driver();
  const tel = args.telefono.replace(/[^\d]/g, '');
  try {
    switch (drv) {
      case 'walink': {
        const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
        return { driver: 'walink', enviado: false, url };
      }
      case 'meta':
        return await enviarMeta(tel, mensaje, args);
      case 'twilio':
        return await enviarTwilio(tel, mensaje);
    }
  } catch (e) {
    return { driver: drv, enviado: false, error: (e as Error).message };
  }
}

async function enviarMeta(
  tel: string,
  mensaje: string,
  args: NotificarPedidoArgs,
): Promise<NotificarPedidoResult> {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
  const tplName = process.env.WHATSAPP_META_TEMPLATE_NAME;
  if (!token || !phoneId) {
    return { driver: 'meta', enviado: false, error: 'Meta no configurado' };
  }

  // Si hay template name, usa plantilla aprobada (recomendado para 24h+).
  // Si no, intenta enviar texto plano (solo funciona dentro de la ventana de 24h).
  const body = tplName
    ? {
        messaging_product: 'whatsapp',
        to: tel,
        type: 'template',
        template: {
          name: tplName,
          language: { code: 'es_MX' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: args.folio },
                { type: 'text', text: args.tipoActa.toLowerCase() },
                { type: 'text', text: args.curp },
                { type: 'text', text: args.cliente },
              ],
            },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: tel,
        type: 'text',
        text: { body: mensaje },
      };

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
  if (!res.ok) {
    return { driver: 'meta', enviado: false, error: data.error?.message ?? 'Error Meta' };
  }
  return { driver: 'meta', enviado: true, messageId: data.messages?.[0]?.id };
}

async function enviarTwilio(tel: string, mensaje: string): Promise<NotificarPedidoResult> {
  const sid = process.env.WHATSAPP_TWILIO_SID;
  const token = process.env.WHATSAPP_TWILIO_TOKEN;
  const from = process.env.WHATSAPP_TWILIO_FROM;
  if (!sid || !token || !from) {
    return { driver: 'twilio', enviado: false, error: 'Twilio no configurado' };
  }
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({
    From: `whatsapp:${from}`,
    To: `whatsapp:+${tel}`,
    Body: mensaje,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) {
    return { driver: 'twilio', enviado: false, error: data.message ?? 'Error Twilio' };
  }
  return { driver: 'twilio', enviado: true, messageId: data.sid };
}
