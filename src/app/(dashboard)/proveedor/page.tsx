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
  createdAt: string;
  cliente: { razonSocial: string };
}

export default function ProveedorPage() {
  const [pendientes, setPendientes] = useState<PedidoRow[] | null>(null);
  const [enProceso, setEnProceso] = useState<PedidoRow[] | null>(null);
  const [subir, setSubir] = useState<PedidoRow | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    fetch('/api/pedidos?estado=PENDIENTE&pageSize=50').then((r) => r.json()).then((d) => setPendientes(d.items));
    fetch('/api/pedidos?estado=EN_PROCESO&pageSize=50').then((r) => r.json()).then((d) => setEnProceso(d.items));
  }, []);

  useEffect(cargar, [cargar]);

  async function marcarEnProceso(p: PedidoRow) {
    setMarcando(p.id);
    await fetch(`/api/pedidos/${p.id}/estado`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estado: 'EN_PROCESO' }),
    });
    setMarcando(null);
    cargar();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-diamond-900">Pedidos por procesar</h1>
        <p className="text-sm text-slate-500">Toma un pedido pendiente, procesalo y sube el PDF cuando este listo.</p>
      </div>

      <Seccion
        titulo="Pendientes"
        items={pendientes}
        action={(p) => (
          <button
            onClick={() => marcarEnProceso(p)}
            disabled={marcando === p.id}
            className="rounded bg-diamond-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-diamond-800 disabled:opacity-50"
          >
            {marcando === p.id ? '...' : 'Tomar (EN PROCESO)'}
          </button>
        )}
      />

      <Seccion
        titulo="En proceso"
        items={enProceso}
        action={(p) => (
          <button
            onClick={() => setSubir(p)}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Subir PDF
          </button>
        )}
      />

      <ModalSubir pedido={subir} onClose={(refresh) => { setSubir(null); if (refresh) cargar(); }} />
    </div>
  );
}

function Seccion({
  titulo,
  items,
  action,
}: {
  titulo: string;
  items: PedidoRow[] | null;
  action: (p: PedidoRow) => React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {titulo} ({items?.length ?? 0})
        </h2>
      </header>
      <div className="divide-y divide-slate-100">
        {items === null && <p className="p-6 text-center text-slate-400">Cargando...</p>}
        {items?.length === 0 && <p className="p-6 text-center text-slate-400">Nada por aqui.</p>}
        {items?.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="font-mono text-sm font-medium text-diamond-900">{p.folio}</p>
              <p className="text-xs text-slate-500">
                {fmtTipoActa(p.tipoActa)} - <span className="font-mono">{p.curp}</span>
              </p>
              <p className="text-xs text-slate-500">
                {p.cliente.razonSocial} - {fmtFecha(p.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <EstadoBadge value={p.estado} />
              {action(p)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModalSubir({ pedido, onClose }: { pedido: PedidoRow | null; onClose: (refresh: boolean) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pedido || !file) { setError('Selecciona un PDF'); return; }
    if (file.type !== 'application/pdf') { setError('El archivo debe ser PDF'); return; }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append('pedidoId', pedido.id);
    fd.append('file', file);
    const res = await fetch('/api/proveedor/upload', { method: 'POST', body: fd });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error ?? 'Error al subir'); return; }
    setFile(null);
    onClose(true);
  }

  if (!pedido) return null;
  return (
    <Modal open={!!pedido} onClose={() => onClose(false)} title={`Subir PDF - ${pedido.folio}`}>
      <p className="text-sm text-slate-600">
        {fmtTipoActa(pedido.tipoActa)} - CURP <span className="font-mono">{pedido.curp}</span>
      </p>
      <form onSubmit={enviar} className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Archivo PDF (max 20MB)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
            required
          />
          {file && <p className="mt-1 text-xs text-slate-500">{file.name} ({Math.round(file.size / 1024)} KB)</p>}
        </div>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-800">
          Al subir, el pedido pasa a LISTO y se envia automaticamente un correo al cliente.
        </p>
        <button type="submit" disabled={loading || !file} className="w-full rounded bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {loading ? 'Subiendo...' : 'Subir y marcar LISTO'}
        </button>
      </form>
    </Modal>
  );
}
