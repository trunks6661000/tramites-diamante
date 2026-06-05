import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  MovimientoTipo,
  NotificacionTipo,
  RecargaEstado,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, withAuth, AuthError } from '@/lib/rbac';
import { logAccion } from '@/lib/logger';

const PatchSchema = z.object({
  estado: z.enum([RecargaEstado.APROBADA, RecargaEstado.RECHAZADA]),
  notas: z.string().max(500).optional(),
});

/**
 * PATCH /api/admin/recargas/:id  -> aprobar o rechazar
 * Aprobar: incrementa saldo, crea movimiento, notifica.
 * Rechazar: solo cambia estado y notifica.
 * Idempotente para misma transicion (devuelve 409 si ya esta resuelta).
 */
export const PATCH = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireRole(Role.ADMIN);
    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos', detalle: parsed.error.flatten() }, { status: 400 });
    }
    const { estado, notas } = parsed.data;

    const recarga = await prisma.recarga.findUnique({
      where: { id: params.id },
      include: { cliente: { include: { user: true } } },
    });
    if (!recarga) throw new AuthError(404, 'Recarga no encontrada');
    if (recarga.estado !== RecargaEstado.PENDIENTE) {
      return NextResponse.json({ error: `Recarga ya esta en estado ${recarga.estado}` }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.recarga.update({
        where: { id: recarga.id },
        data: {
          estado,
          revisadoPorId: session.user.id,
          revisadoAt: new Date(),
          notas: notas ?? recarga.notas,
        },
      });
      if (estado === RecargaEstado.APROBADA) {
        const cli = await tx.cliente.update({
          where: { id: recarga.clienteId },
          data: { creditos: { increment: recarga.monto } },
          select: { creditos: true, userId: true },
        });
        await tx.movimientoCredito.create({
          data: {
            clienteId: recarga.clienteId,
            tipo: MovimientoTipo.RECARGA,
            monto: recarga.monto,
            saldoAntes: cli.creditos - recarga.monto,
            saldoDespues: cli.creditos,
            recargaId: recarga.id,
            actorId: session.user.id,
            motivo: `Recarga ${recarga.folio}`,
          },
        });
        await tx.notificacion.create({
          data: {
            userId: cli.userId,
            tipo: NotificacionTipo.RECARGA_APROBADA,
            titulo: 'Recarga aprobada',
            mensaje: `Tu recarga ${recarga.folio} por ${recarga.monto} creditos fue aprobada.`,
            payload: { recargaId: recarga.id, saldo: cli.creditos },
          },
        });
      } else {
        await tx.notificacion.create({
          data: {
            userId: recarga.cliente.userId,
            tipo: NotificacionTipo.RECARGA_RECHAZADA,
            titulo: 'Recarga rechazada',
            mensaje: `Tu recarga ${recarga.folio} fue rechazada.${notas ? ` Motivo: ${notas}` : ''}`,
            payload: { recargaId: recarga.id },
          },
        });
      }
      return r;
    });

    await logAccion({
      actorId: session.user.id,
      accion: `RECARGA_${estado}`,
      recursoTipo: 'Recarga',
      recursoId: recarga.id,
      payload: { monto: recarga.monto, notas },
      req,
    });

    return NextResponse.json({ ok: true, recarga: result });
  },
);
