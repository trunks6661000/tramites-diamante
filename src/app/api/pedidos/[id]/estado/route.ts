import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  MovimientoTipo,
  NotificacionTipo,
  PedidoEstado,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, withAuth, AuthError } from '@/lib/rbac';
import { logAccion } from '@/lib/logger';

const PatchSchema = z.object({
  estado: z.nativeEnum(PedidoEstado),
  motivo: z.string().max(500).optional(),
});

/**
 * PATCH /api/pedidos/:id/estado
 * Solo ADMIN (o PROVEEDOR para EN_PROCESO).
 * Transiciones validas:
 *   PENDIENTE  -> EN_PROCESO | RECHAZADO | CANCELADO
 *   EN_PROCESO -> LISTO | RECHAZADO | PENDIENTE
 *   RECHAZADO / CANCELADO con monto > 0: si la transicion es admin desde estado no-LISTO,
 *   se reembolsan los creditos.
 *   LISTO no se mueve por este endpoint (se setea automatico al subir PDF).
 */
export const PATCH = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireRole(Role.ADMIN, Role.PROVEEDOR);
    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos', detalle: parsed.error.flatten() }, { status: 400 });
    }
    const { estado: nuevo, motivo } = parsed.data;

    const pedido = await prisma.pedido.findUnique({ where: { id: params.id } });
    if (!pedido) throw new AuthError(404, 'Pedido no encontrado');

    if (session.user.role === Role.PROVEEDOR && nuevo !== PedidoEstado.EN_PROCESO) {
      throw new AuthError(403, 'El proveedor solo puede marcar EN_PROCESO');
    }
    if (nuevo === PedidoEstado.LISTO) {
      return NextResponse.json(
        { error: 'El estado LISTO se establece automaticamente al subir el PDF' },
        { status: 400 },
      );
    }

    const valido = transicionValida(pedido.estado, nuevo);
    if (!valido) {
      return NextResponse.json(
        { error: `Transicion invalida ${pedido.estado} -> ${nuevo}` },
        { status: 400 },
      );
    }

    const debeReembolsar =
      (nuevo === PedidoEstado.RECHAZADO || nuevo === PedidoEstado.CANCELADO) &&
      pedido.estado !== PedidoEstado.RECHAZADO &&
      pedido.estado !== PedidoEstado.CANCELADO &&
      pedido.estado !== PedidoEstado.LISTO &&
      pedido.creditosCobrados > 0;

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.pedido.update({
        where: { id: pedido.id },
        data: {
          estado: nuevo,
          motivoRechazo: nuevo === PedidoEstado.RECHAZADO ? motivo ?? null : pedido.motivoRechazo,
        },
      });
      await tx.pedidoHistorial.create({
        data: {
          pedidoId: pedido.id,
          estadoAnterior: pedido.estado,
          estadoNuevo: nuevo,
          actorId: session.user.id,
          motivo,
        },
      });
      if (debeReembolsar) {
        const cliente = await tx.cliente.update({
          where: { id: pedido.clienteId },
          data: { creditos: { increment: pedido.creditosCobrados } },
          select: { creditos: true },
        });
        await tx.movimientoCredito.create({
          data: {
            clienteId: pedido.clienteId,
            tipo: MovimientoTipo.REEMBOLSO,
            monto: pedido.creditosCobrados,
            saldoAntes: cliente.creditos - pedido.creditosCobrados,
            saldoDespues: cliente.creditos,
            pedidoId: pedido.id,
            actorId: session.user.id,
            motivo: `Reembolso por ${nuevo.toLowerCase()} de ${pedido.folio}`,
          },
        });
      }
      // Notificar al cliente
      if (nuevo === PedidoEstado.RECHAZADO) {
        await tx.notificacion.create({
          data: {
            userId: pedido.userClienteId,
            tipo: NotificacionTipo.PEDIDO_RECHAZADO,
            titulo: 'Pedido rechazado',
            mensaje: `Tu pedido ${pedido.folio} fue rechazado.${motivo ? ` Motivo: ${motivo}` : ''}`,
            payload: { pedidoId: pedido.id, motivo },
          },
        });
      }
      return p;
    });

    await logAccion({
      actorId: session.user.id,
      accion: `PEDIDO_ESTADO_${nuevo}`,
      recursoTipo: 'Pedido',
      recursoId: pedido.id,
      payload: { de: pedido.estado, a: nuevo, motivo, reembolso: debeReembolsar },
      req,
    });

    return NextResponse.json({ ok: true, pedido: updated, reembolso: debeReembolsar });
  },
);

function transicionValida(actual: PedidoEstado, nuevo: PedidoEstado): boolean {
  if (actual === nuevo) return false;
  const mapa: Record<PedidoEstado, PedidoEstado[]> = {
    [PedidoEstado.PENDIENTE]: [PedidoEstado.EN_PROCESO, PedidoEstado.RECHAZADO, PedidoEstado.CANCELADO],
    [PedidoEstado.EN_PROCESO]: [PedidoEstado.LISTO, PedidoEstado.RECHAZADO, PedidoEstado.PENDIENTE],
    [PedidoEstado.LISTO]: [],
    [PedidoEstado.RECHAZADO]: [PedidoEstado.PENDIENTE],
    [PedidoEstado.CANCELADO]: [],
  };
  return mapa[actual].includes(nuevo);
}
