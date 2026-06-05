import { NextRequest, NextResponse } from 'next/server';
import {
  NotificacionTipo,
  PedidoEstado,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, withAuth, AuthError } from '@/lib/rbac';
import { subirArchivo, storageKeys, validarPdfBuffer, PDF_MIME, urlDescargaFirmada } from '@/lib/storage';
import { enviarEmail, plantillaActaLista } from '@/lib/email';
import { getConfig } from '@/lib/config';
import { logAccion } from '@/lib/logger';

export const runtime = 'nodejs';
// Required for handling >1MB uploads in Next 14 API routes
export const dynamic = 'force-dynamic';

/**
 * POST /api/proveedor/upload
 *
 * multipart/form-data:
 *   - pedidoId: string
 *   - file: PDF (max 20MB)
 *
 * Flujo:
 *   1) Solo PROVEEDOR o ADMIN
 *   2) Valida que el pedido este en PENDIENTE o EN_PROCESO
 *   3) Valida que el archivo sea PDF real (magic bytes)
 *   4) Sube a S3 con clave determinista
 *   5) Marca pedido como LISTO, registra historial, notifica al cliente por email
 */
export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireRole(Role.PROVEEDOR, Role.ADMIN);
  const formData = await req.formData();
  const pedidoId = formData.get('pedidoId');
  const file = formData.get('file');

  if (typeof pedidoId !== 'string' || !pedidoId) {
    return NextResponse.json({ error: 'pedidoId requerido' }, { status: 400 });
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Archivo PDF requerido' }, { status: 400 });
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { cliente: { include: { user: true } } },
  });
  if (!pedido) throw new AuthError(404, 'Pedido no encontrado');
  if (
    pedido.estado !== PedidoEstado.PENDIENTE &&
    pedido.estado !== PedidoEstado.EN_PROCESO
  ) {
    return NextResponse.json(
      { error: `No se puede subir PDF a un pedido en estado ${pedido.estado}` },
      { status: 409 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const check = validarPdfBuffer(buffer);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const originalName = (file as File).name ?? `${pedido.folio}.pdf`;
  const key = storageKeys.pedidoPdf(pedido.id);
  await subirArchivo({
    key,
    body: buffer,
    mimeType: PDF_MIME,
    metadata: {
      folio: pedido.folio,
      pedidoId: pedido.id,
      uploadedBy: session.user.id,
    },
  });

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.pedido.update({
      where: { id: pedido.id },
      data: {
        estado: PedidoEstado.LISTO,
        pdfStorageKey: key,
        pdfOriginalName: originalName,
        pdfSize: buffer.byteLength,
        pdfMimeType: PDF_MIME,
        pdfSubidoPorId: session.user.id,
        pdfSubidoAt: new Date(),
      },
    });
    await tx.pedidoHistorial.create({
      data: {
        pedidoId: pedido.id,
        estadoAnterior: pedido.estado,
        estadoNuevo: PedidoEstado.LISTO,
        actorId: session.user.id,
        motivo: 'PDF subido',
      },
    });
    await tx.notificacion.create({
      data: {
        userId: pedido.userClienteId,
        tipo: NotificacionTipo.PEDIDO_LISTO,
        titulo: 'Tu acta esta lista',
        mensaje: `El pedido ${pedido.folio} ya esta disponible para descargar.`,
        payload: { pedidoId: pedido.id, folio: pedido.folio },
      },
    });
    return p;
  });

  // Email al cliente (best effort)
  try {
    const config = await getConfig();
    const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    // URL firmada para descarga directa desde el email (corta duracion)
    const urlDescarga = await urlDescargaFirmada(key, 3600, originalName);
    const tpl = plantillaActaLista({
      nombreCliente: pedido.cliente.user.name,
      folio: pedido.folio,
      tipoActa: pedido.tipoActa,
      urlDescarga: urlDescarga, // o `${appUrl}/cliente/pedidos/${pedido.id}` si prefieres ruta interna
    });
    await enviarEmail({
      to: pedido.cliente.user.email,
      subject: config.emailListoAsunto,
      html: tpl.html,
      text: tpl.text,
    });
    // El uso de appUrl quedaria si decides cambiar a ruta interna
    void appUrl;
  } catch (e) {
    console.error('[email acta lista]', e);
  }

  await logAccion({
    actorId: session.user.id,
    accion: 'PEDIDO_PDF_SUBIR',
    recursoTipo: 'Pedido',
    recursoId: pedido.id,
    payload: { folio: pedido.folio, size: buffer.byteLength },
    req,
  });

  return NextResponse.json({ ok: true, pedido: { id: updated.id, folio: updated.folio, estado: updated.estado } });
});
