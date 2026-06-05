import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { PedidoEstado, RecargaEstado, Role, UserStatus } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StatCard } from '@/components/StatCard';
import { fmtCreditos } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== Role.ADMIN) redirect('/');

  const ahora = new Date();
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  const [pendientes, enProceso, listos, rechazados, u24, capr, cpen, csus, rpen, agg] = await prisma.$transaction([
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-diamond-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumen del sistema</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard titulo="Pedidos hoy" valor={u24} subtexto="Ultimas 24 horas" acento="azul" />
        <StatCard titulo="Pendientes" valor={pendientes + enProceso} acento="amarillo" />
        <StatCard titulo="Listos" valor={listos} acento="verde" />
        <StatCard titulo="Rechazados" valor={rechazados} acento="rojo" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Clientes activos" valor={capr} acento="verde" />
        <StatCard titulo="Por aprobar" valor={cpen} acento="amarillo" />
        <StatCard titulo="Suspendidos" valor={csus} acento="gris" />
        <StatCard
          titulo="Creditos en circulacion"
          valor={fmtCreditos(agg._sum.creditos ?? 0)}
          subtexto="Suma de saldos"
          acento="azul"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Quick href="/admin/pedidos" title="Gestionar pedidos" desc="Revisar y cambiar estados" badge={pendientes + enProceso} />
        <Quick href="/admin/clientes" title="Clientes" desc="Aprobar, suspender, ajustar creditos" badge={cpen} />
        <Quick href="/admin/recargas" title="Recargas" desc="Aprobar transferencias pendientes" badge={rpen} />
      </div>
    </div>
  );
}

function Quick({ href, title, desc, badge }: { href: string; title: string; desc: string; badge: number }) {
  return (
    <Link href={href} className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-diamond-500 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-diamond-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{desc}</p>
        </div>
        {badge > 0 && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">{badge}</span>
        )}
      </div>
    </Link>
  );
}
