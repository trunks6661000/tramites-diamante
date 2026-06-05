import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { PedidoEstado, Role } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StatCard } from '@/components/StatCard';
import { HorarioBanner } from '@/components/HorarioBanner';
import { EstadoBadge } from '@/components/EstadoBadge';
import { fmtFecha, fmtCreditos, fmtTipoActa } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ClienteDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== Role.CLIENTE) {
    redirect(session.user.role === Role.ADMIN ? '/admin' : '/proveedor');
  }

  const userId = session.user.id;
  const [cliente, pendientes, listos, ultimosPedidos, ultimasRecargas] = await Promise.all([
    prisma.cliente.findUnique({ where: { userId }, select: { id: true, razonSocial: true, creditos: true } }),
    prisma.pedido.count({
      where: { userClienteId: userId, estado: { in: [PedidoEstado.PENDIENTE, PedidoEstado.EN_PROCESO] } },
    }),
    prisma.pedido.count({ where: { userClienteId: userId, estado: PedidoEstado.LISTO } }),
    prisma.pedido.findMany({
      where: { userClienteId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, folio: true, tipoActa: true, estado: true, createdAt: true, creditosCobrados: true },
    }),
    cliente_recargas(userId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-diamond-900">Hola, {cliente?.razonSocial}</h1>
          <p className="text-sm text-slate-500">Resumen de tu cuenta</p>
        </div>
        <Link
          href="/cliente/pedidos/nuevo"
          className="rounded bg-diamond-800 px-4 py-2 text-sm font-medium text-white hover:bg-diamond-700"
        >
          + Nuevo pedido
        </Link>
      </div>

      <HorarioBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          titulo="Creditos disponibles"
          valor={fmtCreditos(cliente?.creditos ?? 0)}
          subtexto="1 credito = 1 MXN"
          acento="azul"
        />
        <StatCard titulo="Pedidos en curso" valor={pendientes} subtexto="Pendientes o en proceso" acento="amarillo" />
        <StatCard titulo="Listos para descargar" valor={listos} acento="verde" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ultimos pedidos</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {ultimosPedidos.length === 0 && (
              <p className="py-4 text-sm text-slate-400">Aun no has hecho pedidos.</p>
            )}
            {ultimosPedidos.map((p) => (
              <Link
                key={p.id}
                href={`/cliente/pedidos/${p.id}`}
                className="flex items-center justify-between py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-mono text-sm font-medium text-diamond-900">{p.folio}</p>
                  <p className="text-xs text-slate-500">
                    {fmtTipoActa(p.tipoActa)} - {fmtFecha(p.createdAt)}
                  </p>
                </div>
                <EstadoBadge value={p.estado} />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ultimas recargas</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {ultimasRecargas.length === 0 && <p className="py-4 text-sm text-slate-400">Sin recargas.</p>}
            {ultimasRecargas.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-mono text-sm font-medium text-diamond-900">{r.folio}</p>
                  <p className="text-xs text-slate-500">{fmtFecha(r.createdAt)} - {r.monto} creditos</p>
                </div>
                <EstadoBadge value={r.estado} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

async function cliente_recargas(userId: string) {
  const c = await prisma.cliente.findUnique({ where: { userId }, select: { id: true } });
  if (!c) return [];
  return prisma.recarga.findMany({
    where: { clienteId: c.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, folio: true, monto: true, estado: true, createdAt: true },
  });
}
