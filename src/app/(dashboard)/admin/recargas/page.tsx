'use client';

import { useCallback, useEffect, useState } from 'react';
import { EstadoBadge } from '@/components/EstadoBadge';
import { Modal } from '@/components/Modal';
import { fmtFecha } from '@/lib/format';

interface RecargaRow {
  id: string;
  folio: string;
  monto: number;
  estado: string;
  referencia: string | null;
  comprobanteKey: string | null;
  notas: string | null;
  createdAt: string;
  cliente: { razonSocial: string; user: { email: string; name: string } };
  revisadoPor: { name: string } | null;
}

const ESTADOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA', ''] as const;

export default function AdminRecargasPage() {
  const [items, setItems] = useState<RecargaRow[] | null>(null);
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('PENDIENTE');
  const [accion, setAccion] = useState<{ r: RecargaRow; tipo: 'APROBADA' | 'RECHAZADA' } | null>(null);

  const cargar = useCallback(() => {
    const url = `/api/admin/recargas${estado ? `?estado=${estado}` : ''}`;
    fetch(url).then((r) => r.json()).then((d) => setItems(d.items));
  }, [estado]);
  useEffect(cargar, [cargar]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-diamond-900">Recargas</h1>

      <div className="flex gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e || 'all'}
            onClick={() => setEstado(e)}
            className={`rounded-full border px-3 py-1 text-xs ${
              estado === e ? 'border-diamond-700 bg-diamond-800 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {e || 'TODAS'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <Th>Folio</Th><Th>Cliente</Th><Th>Monto</Th><Th>Referencia</Th><Th>Comprobante</Th><Th>Estado</Th><Th>Fecha</Th><Th>{''}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items === null && <tr><td colSpan={8} className="p-6 text-center text-slate-400">Cargando...</td></tr>}
            {items?.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">Sin recargas.</td></tr>}
            {items?.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td className="font-mono">{r.folio}</Td>
                <Td className="text-xs">{r.cliente.razonSocial}</Td>
                <Td className="font-bold text-emerald-700">+{r.monto}</Td>
                <Td className="text-xs">{r.referencia ?? '-'}</Td>
                <Td className="text-xs">{r.comprobanteKey ? <span className="text-emerald-700">Adjunto</span> : <span className="text-slate-400">Sin</span>}</Td>
                <Td><EstadoBadge value={r.estado} /></Td>
                <Td className="text-xs">{fmtFecha(r.createdAt)}</Td>
                <Td>
                  {r.estado === 'PENDIENTE' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => setAccion({ r, tipo: 'APROBADA' })} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">Aprobar</button>
                      <button onClick={() => setAccion({ r, tipo: 'RECHAZADA' })} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Rechazar</button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDecidir
        accion={accion}
        onClose={(refresh) => { setAccion(null); if (refresh) cargar(); }}
      />
    </div>
  );
}

function ModalDecidir({ accion, onClose }: { accion: { r: { id: string; folio: string; monto: number }; tipo: 'APROBADA' | 'RECHAZADA' } | null; onClose: (refresh: boolean) => void }) {
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!accion) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/recargas/${accion.r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estado: accion.tipo, notas }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error ?? 'Error'); return; }
    setNotas('');
    onClose(true);
  }

  if (!accion) return null;
  return (
    <Modal open={!!accion} onClose={() => onClose(false)} title={accion.tipo === 'APROBADA' ? 'Aprobar recarga' : 'Rechazar recarga'}>
      <p className="text-sm text-slate-600">Folio <strong className="font-mono">{accion.r.folio}</strong> por <strong>{accion.r.monto}</strong> creditos.</p>
      <div className="mt-3">
        <label className="block text-sm font-medium text-slate-700">Notas (opcional)</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
      {error && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <button onClick={enviar} disabled={loading} className={`mt-4 w-full rounded py-2 font-medium text-white disabled:opacity-50 ${accion.tipo === 'APROBADA' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
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
