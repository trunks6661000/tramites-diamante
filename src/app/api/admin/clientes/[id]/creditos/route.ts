import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  MovimientoTipo,
  NotificacionTipo,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, withAuth, AuthError } from '@/lib/rbac';
import { logAccion } from '@/lib/logger';

const AjusteSchema = z.object({
  monto: z.number().int().refine((n) => n !== 0, { message: 'El monto no puede ser cero' }),
  tipo: z.enum(['AJUSTE_MANUAL', 'RECARGA']).default('AJUSTE_MANUAL'),
  motivo: z.string().max(500).optional(),
  referencia: z.string().max(120).optional(),
});

/**
 * POST /api/admin/clientes/:id/creditos
 *
 * Ajusta el saldo de creditos del cliente.
 *   - monto positivo: agrega creditos (recarga manual o ajuste)
 *   - monto negativo: retira creditos (ajuste / correccion). No puede dejar saldo negativo.
 *
 * Cada ajuste:
 *   1) Crea/usa un movimiento atomico
 *   2) Si tipo=RECARGA y monto>0: crea Recarga en estado APROBADA enlazada
 *   3) Notifica al cliente
 *   4) Registra log de accion
 */
export const POST = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireRole(Role.ADMIN);
    const body = await req.json().catch(() => null);
    const parsed = AjusteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos', detalle: parsed.error.flatten() }, { status: 400 });
    }
    const { monto, tipo, motivo, referencia } = parsed.data;

    // params.id es el ID del USUARIO (cliente)
    const user = await prisma.user.findFirst({
      where: { id: params.id, role: Role.CLIENTE },
      include: { cliente: true },
    });
    if (!user?.cliente) throw new AuthError(404, 'Cliente no encontrado');

    const cliente = user.cliente;
    if (cliente.creditos + monto < 0) {
      return NextResponse.json(
        { error: `El cliente solo tiene ${cliente.creditos} creditos; el ajuste lo dejaria en negativo.` },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const saldoAntes = cliente.creditos;
      const saldoDespues = saldoAntes + monto;
      await tx.cliente.update({
        where: { id: cliente.id },
        data: { creditos: saldoDespues },
      });

      let recargaId: string | undefined;
      if (tipo === 'RECARGA' && monto > 0) {
        const { generarFolioRecarga } = await import('@/lib/folio');
        const folio = await generarFolioRecarga();
        const recarga = await tx.recarga.create({
          data: {
            folio,
            clienteId: cliente.id,
            monto,
            referencia: referencia ?? null,
            estado: 'APROBADA',
            revisadoPorId: session.user.id,
            revisadoAt: new Date(),
            notas: motivo ?? null,
          },
        });
        recargaId = recarga.id;
      }

      const mov = await tx.movimientoCredito.create({
        data: {
          clienteId: cliente.id,
          tipo: tipo === 'RECARGA' ? MovimientoTipo.RECARGA : MovimientoTipo.AJUSTE_MANUAL,
          monto,
          saldoAntes,
          saldoDespues,
          recargaId,
          actorId: session.user.id,
          motivo,
        },
      });

      await tx.notificacion.create({
        data: {
          userId: user.id,
          tipo: NotificacionTipo.RECARGA_APROBADA,
          titulo: monto > 0 ? 'Creditos abonados' : 'Ajuste de creditos',
          mensaje: `Se ${monto > 0 ? 'abonaron' : 'descontaron'} ${Math.abs(monto)} creditos a tu cuenta. Saldo: ${saldoDespues}.`,
          payload: { movimientoId: mov.id, saldoDespues },
        },
      });

      return { movimiento: mov, saldoDespues, recargaId };
    });

    await logAccion({
      actorId: session.user.id,
      accion: monto > 0 ? 'CREDITOS_ABONAR' : 'CREDITOS_DEBITAR',
      recursoTipo: 'Cliente',
      recursoId: cliente.id,
      payload: { monto, tipo, motivo, referencia, recargaId: result.recargaId },
      req,
    });

    return NextResponse.json({ ok: true, saldoDespues: result.saldoDespues, movimientoId: result.movimiento.id });
  },
);

// GET /api/admin/clientes/:id/creditos -> historial de movimientos
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    await requireRole(Role.ADMIN);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));

    const user = await prisma.user.findFirst({
      where: { id: params.id, role: Role.CLIENTE },
      include: { cliente: true },
    });
    if (!user?.cliente) throw new AuthError(404, 'Cliente no encontrado');

    const [items, total] = await prisma.$transaction([
      prisma.movimientoCredito.findMany({
        where: { clienteId: user.cliente.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { name: true, role: true } },
          recarga: { select: { folio: true } },
          pedido: { select: { folio: true, tipoActa: true } },
        },
      }),
      prisma.movimientoCredito.count({ where: { clienteId: user.cliente.id } }),
    ]);

    return NextResponse.json({
      saldoActual: user.cliente.creditos,
      items,
      page,
      pageSize,
      total,
    });
  },
);
