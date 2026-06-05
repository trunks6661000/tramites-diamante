'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EstadoBadge } from '@/components/EstadoBadge';
import { fmtFecha, fmtTipoActa } from '@/lib/format';

interface Detalle {
  pedido: {
    id: string;
    folio: string;
    tipoActa: string;
    curp: string;
    estado: string;
    creditosCobrados: number;
    motivoRechazo: string | null;
    createdAt: string;
    updatedAt: string;
    pdfSubidoAt: string | null;
    datosAdicionales: Record<string, unknown> | null;
    cliente: { razonSocial: string; user: { name: string; email: string } };
    historial: { estadoAnterior: string | null; estadoNuevo: string; motivo: string | null; createdAt: string; actor: { name: string; role: string } | null }[];
  };
}

export default function DetallePedido({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    fetch(`/api/pedidos/${params.id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) setError(d.error ?? 'No se pudo cargar');
        else setData(d);
      });
  }, [params.id]);

  async function descargar() {
    setDescargando(true);
    const res = await fetch(`/api/pedidos/${params.id}/pdf`);
    const d = await res.json();
    setDescargando(false);
    if (!res.ok) {
      alert(d.error ?? 'No disponible');
      return;
    }
    window.open(d.url, '_blank');
  }

  if (error) return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-center text-slate-400">Cargando...</div>;

  const p = data.pedido;
  const datosExtra = p.datosAdicionales ?? {};

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/cliente/pedidos" className="text-sm text-diamond-700 hover:underline">
        &larr; Volver a pedidos
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-2xl font-bold text-diamond-900">{p.folio}</p>
            <p className="text-sm text-slate-500">{fmtTipoActa(p.tipoActa)} - creado {fmtFecha(p.createdAt)}</p>
          </div>
          <EstadoBadge value={p.estado} />
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Field label="CURP"><span className="font-mono">{p.curp}</span></Field>
          <Field label="Cobro">{p.creditosCobrados} creditos</Field>
          {p.motivoRechazo && <Field label="Motivo de rechazo">{p.motivoRechazo}</Field>}
          {Object.keys(datosExtra).length > 0 && (
            <Field label="Datos adicionales">
              <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(datosExtra, null, 2)}</pre>
            </Field>
          )}
        </dl>

        {p.estado === 'LISTO' && (
          <button
            onClick={descargar}
            disabled={descargando}
            className="mt-6 w-full rounded bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {descargando ? 'Generando enlace...' : 'Descargar PDF'}
          </button>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Historial</h2>
        <ol className="mt-3 space-y-3">
          {p.historial.map((h, i) => (
            <li key={i} className="flex gap-3 border-l-2 border-diamond-300 pl-4">
              <div>
                <p className="text-sm">
                  {h.estadoAnterior ? <><EstadoBadge value={h.estadoAnterior} /> &rarr; </> : null}
                  <EstadoBadge value={h.estadoNuevo} />
                </p>
                <p className="text-xs text-slate-500">
                  {fmtFecha(h.createdAt)}{h.actor ? ` - ${h.actor.name} (${h.actor.role})` : ''}
                </p>
                {h.motivo && <p className="mt-1 text-xs text-slate-600">{h.motivo}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
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
