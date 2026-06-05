'use client';

import { useCallback, useEffect, useState } from 'react';
import { EstadoBadge } from '@/components/EstadoBadge';
import { Modal } from '@/components/Modal';
import { fmtFecha, fmtTipoActa } from '@/lib/format';

interface PedidoRow {
  id: string;
  folio: string;
  tipoActa: string;
  curp: string;
  estado: string;
  creditosCobrados: number;
  motivoRechazo: string | null;
  createdAt: string;
  cliente: { razonSocial: string };
}

const ESTADOS = ['', 'PENDIENTE', 'EN_PROCESO', 'LISTO', 'RECHAZADO', 'CANCELADO'] as const;

export default function AdminPedidosPage() {
  const [items, setItems] = useState<PedidoRow[] | null>(null);
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('PENDIENTE');
  const [accion, setAccion] = useState<{ pedido: PedidoRow; tipo: 'EN_PROCESO' | 'RECHAZADO' | 'CANCELADO' } | null>(null);

  const cargar = useCallback(() => {
    const url = `/api/pedidos${estado ? `?estado=${estado}&` : '?'}pageSize=50`;
    fetch(url).then((r) => r.json()).then((d) => setItems(d.items));
  }, [estado]);

  useEffect(cargar, [cargar]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-diamond-900">Pedidos</h1>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e || 'all'}
            onClick={() => setEstado(e)}
            className={`rounded-full border px-3 py-1 text-xs ${
              estado === e ? 'border-diamond-700 bg-diamond-800 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {e || 'TODOS'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <Th>Folio</Th><Th>Cliente</Th><Th>Tipo</Th><Th>CURP</Th><Th>Estado</Th><Th>Cobro</Th><Th>Creado</Th><Th>{''}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items === null && <tr><td colSpan={8} className="p-6 text-center text-slate-400">Cargando...</td></tr>}
            {items?.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">Sin pedidos.</td></tr>}
            {items?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td className="font-mono">{p.folio}</Td>
                <Td className="text-xs">{p.cliente.razonSocial}</Td>
                <Td>{fmtTipoActa(p.tipoActa)}</Td>
                <Td className="font-mono text-xs">{p.curp}</Td>
                <Td><EstadoBadge value={p.estado} /></Td>
                <Td>{p.creditosCobrados}</Td>
                <Td className="text-xs">{fmtFecha(p.createdAt)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {p.estado === 'PENDIENTE' && (
                      <button onClick={() => setAccion({ pedido: p, tipo: 'EN_PROCESO' })} className="rounded bg-diamond-700 px-2 py-1 text-xs text-white hover:bg-diamond-800">
                        Procesar
                      </button>
                    )}
                    {(p.estado === 'PENDIENTE' || p.estado === 'EN_PROCESO') && (
                      <button onClick={() => setAccion({ pedido: p, tipo: 'RECHAZADO' })} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">
                        Rechazar
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalCambio
        accion={accion}
        onClose={(refresh) => { setAccion(null); if (refresh) cargar(); }}
      />
    </div>
  );
}

function ModalCambio({ accion, onClose }: { accion: { pedido: PedidoRow; tipo: 'EN_PROCESO' | 'RECHAZADO' | 'CANCELADO' } | null; onClose: (refresh: boolean) => void }) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!accion) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/pedidos/${accion.pedido.id}/estado`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estado: accion.tipo, motivo }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error ?? 'Error'); return; }
    setMotivo('');
    onClose(true);
  }

  if (!accion) return null;
  return (
    <Modal open={!!accion} onClose={() => onClose(false)} title={`Cambiar a ${accion.tipo.replace('_', ' ')}`}>
      <p className="text-sm text-slate-600">
        Pedido <strong className="font-mono">{accion.pedido.folio}</strong>
      </p>
      {accion.tipo === 'RECHAZADO' && (
        <p className="mt-2 rounded bg-yellow-50 p-2 text-xs text-yellow-800">
          Al rechazar, los {accion.pedido.creditosCobrados} creditos se reembolsaran automaticamente al cliente.
        </p>
      )}
      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700">Motivo / nota</label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <button onClick={enviar} disabled={loading} className="mt-4 w-full rounded bg-diamond-800 py-2 font-medium text-white hover:bg-diamond-700 disabled:opacity-50">
        {loading ? 'Aplicando...' : 'Confirmar'}
      </button>
    </Modal>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
