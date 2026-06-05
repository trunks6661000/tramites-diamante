'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EstadoBadge } from '@/components/EstadoBadge';
import { fmtFecha, fmtTipoActa } from '@/lib/format';

type Pedido = {
  id: string;
  folio: string;
  tipoActa: string;
  estado: string;
  creditosCobrados: number;
  createdAt: string;
};

const FILTROS = ['', 'PENDIENTE', 'EN_PROCESO', 'LISTO', 'RECHAZADO'] as const;

export default function PedidosCliente() {
  const [estado, setEstado] = useState<(typeof FILTROS)[number]>('');
  const [items, setItems] = useState<Pedido[] | null>(null);

  useEffect(() => {
    const url = `/api/pedidos${estado ? `?estado=${estado}` : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setItems(d.items));
  }, [estado]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-diamond-900">Mis pedidos</h1>
        <Link href="/cliente/pedidos/nuevo" className="rounded bg-diamond-800 px-4 py-2 text-sm font-medium text-white hover:bg-diamond-700">
          + Nuevo pedido
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f || 'todos'}
            onClick={() => setEstado(f)}
            className={`rounded-full px-3 py-1 text-xs ${
              estado === f ? 'bg-diamond-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            } border border-slate-300`}
          >
            {f || 'TODOS'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <Th>Folio</Th>
              <Th>Tipo</Th>
              <Th>Estado</Th>
              <Th>Cobro</Th>
              <Th>Creado</Th>
              <Th>{''}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items === null && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Cargando...</td></tr>
            )}
            {items?.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Sin pedidos.</td></tr>
            )}
            {items?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td className="font-mono font-medium">{p.folio}</Td>
                <Td>{fmtTipoActa(p.tipoActa)}</Td>
                <Td><EstadoBadge value={p.estado} /></Td>
                <Td>-{p.creditosCobrados}</Td>
                <Td className="whitespace-nowrap text-xs">{fmtFecha(p.createdAt)}</Td>
                <Td>
                  <Link href={`/cliente/pedidos/${p.id}`} className="text-diamond-700 hover:underline">
                    Ver detalle
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
