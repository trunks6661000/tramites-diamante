import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  MovimientoTipo,
  NotificacionTipo,
  RecargaEstado,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSession, withAuth, AuthError } from '@/lib/rbac';
import { generarFolioRecarga } from '@/lib/folio';
import { logAccion } from '@/lib/logger';

/**
 * GET /api/admin/recargas
 *   ?estado=PENDIENTE|APROBADA|RECHAZADA  (default todas)
 *   ?clienteId=xxx
 * Tambien accesible para CLIENTE pero filtrado a sus propias recargas.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireSession();
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado') as RecargaEstado | null;
  const clienteIdQ = searchParams.get('clienteId');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;

  if (session.user.role === Role.CLIENTE) {
    const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
    if (!cliente) throw new AuthError(404, 'Perfil cliente no encontrado');
    where.clienteId = cliente.id;
  } else if (clienteIdQ) {
    where.clienteId = clienteIdQ;
  }

  const [items, total] = await prisma.$transaction([
    prisma.recarga.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        cliente: { include: { user: { select: { email: true, name: true } } } },
        revisadoPor: { select: { name: true } },
      },
    }),
    prisma.recarga.count({ where }),
  ]);

  return NextResponse.json({ items, page, pageSize, total });
});

// POST: cliente registra solicitud de recarga (subio transferencia)
//       admin tambien puede crear y aprobar en el mismo paso.
const CrearSchema = z.object({
  monto: z.number().int().positive(),
  referencia: z.string().max(120).optional(),
  comprobanteKey: z.string().max(300).optional(),
  comprobanteName: z.string().max(200).optional(),
  clienteId: z.string().optional(),     // requerido solo si lo crea el admin
  aprobarAhora: z.boolean().optional(), // solo admin
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = CrearSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const { monto, referencia, comprobanteKey, comprobanteName, clienteId, aprobarAhora } = parsed.data;

  let clienteIdResuelto: string;
  if (session.user.role === Role.CLIENTE) {
    const c = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
    if (!c) throw new AuthError(404, 'Perfil cliente no encontrado');
    clienteIdResuelto = c.id;
  } else if (session.user.role === Role.ADMIN) {
    if (!clienteId) {
      return NextResponse.json({ error: 'clienteId requerido para admin' }, { status: 400 });
    }
    clienteIdResuelto = clienteId;
  } else {
    throw new AuthError(403, 'No autorizado');
  }

  const folio = await generarFolioRecarga();
  const aprueba = session.user.role === Role.ADMIN && aprobarAhora === true;

  const recarga = await prisma.$transaction(async (tx) => {
    const r = await tx.recarga.create({
      data: {
        folio,
        clienteId: clienteIdResuelto,
        monto,
        referencia: referencia ?? null,
        comprobanteKey: comprobanteKey ?? null,
        comprobanteName: comprobanteName ?? null,
        estado: aprueba ? RecargaEstado.APROBADA : RecargaEstado.PENDIENTE,
        revisadoPorId: aprueba ? session.user.id : null,
        revisadoAt: aprueba ? new Date() : null,
      },
    });
    if (aprueba) {
      const cli = await tx.cliente.update({
        where: { id: clienteIdResuelto },
        data: { creditos: { increment: monto } },
        select: { creditos: true, userId: true },
      });
      await tx.movimientoCredito.create({
        data: {
          clienteId: clienteIdResuelto,
          tipo: MovimientoTipo.RECARGA,
          monto,
          saldoAntes: cli.creditos - monto,
          saldoDespues: cli.creditos,
          recargaId: r.id,
          actorId: session.user.id,
          motivo: `Recarga ${folio}`,
        },
      });
      await tx.notificacion.create({
        data: {
          userId: cli.userId,
          tipo: NotificacionTipo.RECARGA_APROBADA,
          titulo: 'Recarga aprobada',
          mensaje: `Tu recarga ${folio} por ${monto} creditos fue aprobada.`,
          payload: { recargaId: r.id, saldo: cli.creditos },
        },
      });
    }
    return r;
  });

  await logAccion({
    actorId: session.user.id,
    accion: aprueba ? 'RECARGA_CREAR_Y_APROBAR' : 'RECARGA_SOLICITAR',
    recursoTipo: 'Recarga',
    recursoId: recarga.id,
    payload: { monto, referencia, clienteIdResuelto },
    req,
  });

  return NextResponse.json({ ok: true, recarga }, { status: 201 });
});
