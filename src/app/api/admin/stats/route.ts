import { NextResponse } from 'next/server';
import {
  PedidoEstado,
  RecargaEstado,
  Role,
  UserStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, withAuth } from '@/lib/rbac';

export const dynamic = 'force-dynamic'
/**
 * GET /api/admin/stats
 *
 * Devuelve metricas para el dashboard del admin:
 *   - Conteo de pedidos por estado
 *   - Conteo de clientes por status
 *   - Recargas pendientes
 *   - Total creditos en circulacion
 *   - Pedidos de las ultimas 24h
 */
export const GET = withAuth(async () => {
  await requireRole(Role.ADMIN);

  const ahora = new Date();
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

  const [
    pedidosPendientes,
    pedidosEnProceso,
    pedidosListos,
    pedidosRechazados,
    pedidosUltimas24h,
    clientesAprobados,
    clientesPendientes,
    clientesSuspendidos,
    recargasPendientes,
    creditosTotalesAgg,
  ] = await prisma.$transaction([
    prisma.pedido.count({ where: { estado: PedidoEstado.PENDIENTE } }),
    prisma.pedido.count({ where: { estado: PedidoEstado.EN_PROCESO } }),
    prisma.pedido.count({ where: { estado: PedidoEstado.LISTO } }),
    prisma.pedido.count({ where: { estado: PedidoEstado.RECHAZADO } }),
    prisma.pedido.count({ where: { createdAt: { gte: hace24h } } }),
    prisma.user.count({ where: { role: Role.CLIENTE, status: UserStatus.APROBADO } }),
    prisma.user.count({ where: { role: Role.CLIENTE, status: UserStatus.PENDIENTE } }),
    prisma.user.count({ where: { role: Role.CLIENTE, status: UserStatus.SUSPENDIDO } }),
    prisma.recarga.count({ where: { estado: RecargaEstado.PENDIENTE } }),
    prisma.cliente.aggregate({ _sum: { creditos: true } }),
  ]);

  return NextResponse.json({
    pedidos: {
      pendientes: pedidosPendientes,
      enProceso: pedidosEnProceso,
      listos: pedidosListos,
      rechazados: pedidosRechazados,
      ultimas24h: pedidosUltimas24h,
    },
    clientes: {
      aprobados: clientesAprobados,
      pendientes: clientesPendientes,
      suspendidos: clientesSuspendidos,
    },
    recargas: { pendientes: recargasPendientes },
    creditosEnCirculacion: creditosTotalesAgg._sum.creditos ?? 0,
  });
});
