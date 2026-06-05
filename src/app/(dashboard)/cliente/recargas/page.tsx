'use client';

import { useEffect, useState } from 'react';
import { EstadoBadge } from '@/components/EstadoBadge';
import { Modal } from '@/components/Modal';
import { fmtFecha } from '@/lib/format';

interface Recarga {
  id: string;
  folio: string;
  monto: number;
  estado: string;
  referencia: string | null;
  createdAt: string;
}

export default function RecargasCliente() {
  const [items, setItems] = useState<Recarga[] | null>(null);
  const [open, setOpen] = useState(false);

  function recargar() {
    fetch('/api/admin/recargas')
      .then((r) => r.json())
      .then((d) => setItems(d.items));
  }
  useEffect(recargar, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-diamond-900">Recargas</h1>
        <button
          onClick={() => setOpen(true)}
          className="rounded bg-diamond-800 px-4 py-2 text-sm font-medium text-white hover:bg-diamond-700"
        >
          + Solicitar recarga
        </button>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <p className="font-medium">Como funcionan las recargas:</p>
        <ol className="ml-4 mt-1 list-decimal space-y-0.5">
          <li>Haz la transferencia al banco.</li>
          <li>Sube el comprobante con el formulario.</li>
          <li>El administrador la aprueba y los creditos se acreditan a tu cuenta.</li>
        </ol>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <Th>Folio</Th><Th>Monto</Th><Th>Referencia</Th><Th>Estado</Th><Th>Fecha</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items === null && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Cargando...</td></tr>}
            {items?.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Sin recargas.</td></tr>}
            {items?.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono">{r.folio}</Td>
                <Td>+{r.monto}</Td>
                <Td className="text-xs">{r.referencia ?? '-'}</Td>
                <Td><EstadoBadge value={r.estado} /></Td>
                <Td className="text-xs">{fmtFecha(r.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalRecarga open={open} onClose={() => { setOpen(false); recargar(); }} />
    </div>
  );
}

function ModalRecarga({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [monto, setMonto] = useState(0);
  const [referencia, setReferencia] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (monto <= 0) { setError('Monto invalido'); return; }
    setLoading(true);
    try {
      let comprobanteKey: string | undefined;
      let comprobanteName: string | undefined;
      if (file) {
        const pres = await fetch('/api/uploads/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tipo: 'comprobante', mimeType: file.type, size: file.size }),
        });
        const presData = await pres.json();
        if (!pres.ok) throw new Error(presData.error ?? 'Error al preparar subida');
        const put = await fetch(presData.url, { method: 'PUT', headers: presData.headers, body: file });
        if (!put.ok) throw new Error('Fallo subida del comprobante');
        comprobanteKey = presData.key;
        comprobanteName = file.name;
      }
      const res = await fetch('/api/admin/recargas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ monto, referencia, comprobanteKey, comprobanteName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Solicitar recarga">
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Monto en creditos (= MXN)</label>
          <input
            type="number"
            min={1}
            value={monto || ''}
            onChange={(e) => setMonto(parseInt(e.target.value || '0', 10))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Referencia bancaria</label>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Numero de operacion / SPEI"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Comprobante (PDF/JPG/PNG)</label>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </div>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-diamond-800 py-2 font-medium text-white hover:bg-diamond-700 disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>
    </Modal>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
