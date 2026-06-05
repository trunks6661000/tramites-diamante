'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { EstadoBadge } from '@/components/EstadoBadge';
import { fmtCreditos, fmtFecha, fmtTipoActa } from '@/lib/format';

interface Detalle {
  user: {
    id: string;
    email: string;
    name: string;
    status: string;
    createdAt: string;
    lastLoginAt: string | null;
    cliente: { id: string; razonSocial: string; rfc: string | null; telefono: string | null; creditos: number; notas: string | null } | null;
    pedidosComoCliente: { id: string; folio: string; tipoActa: string; estado: string; creditosCobrados: number; createdAt: string }[];
  };
}

interface MovHistorial {
  saldoActual: number;
  items: {
    id: string;
    tipo: string;
    monto: number;
    saldoAntes: number;
    saldoDespues: number;
    motivo: string | null;
    createdAt: string;
    actor: { name: string; role: string } | null;
    recarga: { folio: string } | null;
    pedido: { folio: string; tipoActa: string } | null;
  }[];
}

export default function ClienteDetallePage({ params }: { params: { id: string } }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [m, setM] = useState<MovHistorial | null>(null);
  const [accion, setAccion] = useState<string | null>(null);

  const cargar = useCallback(() => {
    fetch(`/api/admin/clientes/${params.id}`).then((r) => r.json()).then(setD);
    fetch(`/api/admin/clientes/${params.id}/creditos`).then((r) => r.json()).then(setM);
  }, [params.id]);

  useEffect(cargar, [cargar]);

  async function cambiarStatus(status: 'APROBADO' | 'SUSPENDIDO') {
    setAccion(status);
    await fetch(`/api/admin/clientes/${params.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setAccion(null);
    cargar();
  }

  if (!d) return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  const u = d.user;
  return (
    <div className="space-y-6">
      <Link href="/admin/clientes" className="text-sm text-diamond-700 hover:underline">&larr; Volver</Link>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-diamond-900">{u.cliente?.razonSocial ?? u.name}</h1>
            <p className="text-sm text-slate-500">{u.email}</p>
            <p className="mt-1 text-xs text-slate-500">Alta {fmtFecha(u.createdAt)} - Ultimo login {u.lastLoginAt ? fmtFecha(u.lastLoginAt) : 'nunca'}</p>
          </div>
          <div className="flex items-center gap-3">
            <EstadoBadge value={u.status} />
            {u.status !== 'APROBADO' && (
              <button onClick={() => cambiarStatus('APROBADO')} disabled={accion !== null} className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
                Aprobar
              </button>
            )}
            {u.status !== 'SUSPENDIDO' && (
              <button onClick={() => cambiarStatus('SUSPENDIDO')} disabled={accion !== null} className="rounded bg-orange-600 px-3 py-1.5 text-xs text-white hover:bg-orange-700 disabled:opacity-50">
                Suspender
              </button>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Saldo">{fmtCreditos(u.cliente?.creditos ?? 0)} creditos</Field>
          <Field label="RFC"><span className="font-mono">{u.cliente?.rfc ?? '-'}</span></Field>
          <Field label="Telefono">{u.cliente?.telefono ?? '-'}</Field>
          <Field label="Notas">{u.cliente?.notas ?? '-'}</Field>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ultimos pedidos</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {u.pedidosComoCliente.length === 0 && <p className="py-3 text-sm text-slate-400">Sin pedidos.</p>}
            {u.pedidosComoCliente.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-mono text-sm">{p.folio}</p>
                  <p className="text-xs text-slate-500">{fmtTipoActa(p.tipoActa)} - {fmtFecha(p.createdAt)}</p>
                </div>
                <EstadoBadge value={p.estado} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Movimientos de creditos</h2>
          {m === null && <p className="mt-3 text-sm text-slate-400">Cargando...</p>}
          <div className="mt-3 max-h-96 overflow-y-auto divide-y divide-slate-100">
            {m?.items.length === 0 && <p className="py-3 text-sm text-slate-400">Sin movimientos.</p>}
            {m?.items.map((it) => (
              <div key={it.id} className="py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{it.tipo.replace('_', ' ')}</span>
                  <span className={it.monto >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>
                    {it.monto >= 0 ? '+' : ''}{it.monto}
                  </span>
                </div>
                <div className="text-slate-500">
                  {fmtFecha(it.createdAt)}
                  {it.recarga && ` - ${it.recarga.folio}`}
                  {it.pedido && ` - ${it.pedido.folio}`}
                </div>
                {it.motivo && <div className="mt-0.5 text-slate-600">{it.motivo}</div>}
                <div className="text-slate-400">Saldo: {it.saldoAntes} &rarr; {it.saldoDespues}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}
