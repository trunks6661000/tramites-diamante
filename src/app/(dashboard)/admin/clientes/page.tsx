'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EstadoBadge } from '@/components/EstadoBadge';
import { Modal } from '@/components/Modal';
import { fmtCreditos, fmtFecha } from '@/lib/format';

interface ClienteRow {
  id: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  cliente: { id: string; razonSocial: string; rfc: string | null; telefono: string | null; creditos: number } | null;
}

const STATUS = ['', 'PENDIENTE', 'APROBADO', 'SUSPENDIDO'] as const;

export default function AdminClientesPage() {
  const [items, setItems] = useState<ClienteRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS)[number]>('');
  const [crear, setCrear] = useState(false);
  const [credito, setCredito] = useState<ClienteRow | null>(null);

  const cargar = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (status) p.set('status', status);
    fetch(`/api/admin/clientes?${p}`).then((r) => r.json()).then((d) => setItems(d.items));
  }, [search, status]);

  useEffect(cargar, [cargar]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-diamond-900">Clientes</h1>
        <button onClick={() => setCrear(true)} className="rounded bg-diamond-800 px-4 py-2 text-sm font-medium text-white hover:bg-diamond-700">
          + Nuevo cliente
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Buscar por nombre, email, RFC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof STATUS)[number])}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {STATUS.map((s) => <option key={s || 'all'} value={s}>{s || 'TODOS'}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <Th>Razon social</Th><Th>Email</Th><Th>RFC</Th><Th>Saldo</Th><Th>Estado</Th><Th>Alta</Th><Th>{''}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items === null && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Cargando...</td></tr>}
            {items?.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Sin resultados.</td></tr>}
            {items?.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td className="font-medium">{u.cliente?.razonSocial ?? u.name}</Td>
                <Td className="text-xs">{u.email}</Td>
                <Td className="font-mono text-xs">{u.cliente?.rfc ?? '-'}</Td>
                <Td className="font-medium">{fmtCreditos(u.cliente?.creditos ?? 0)}</Td>
                <Td><EstadoBadge value={u.status} /></Td>
                <Td className="text-xs">{fmtFecha(u.createdAt)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => setCredito(u)} className="text-xs text-diamond-700 hover:underline">
                      Creditos
                    </button>
                    <Link href={`/admin/clientes/${u.id}`} className="text-xs text-diamond-700 hover:underline">
                      Detalle
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalCrear open={crear} onClose={() => { setCrear(false); cargar(); }} />
      <ModalCreditos cliente={credito} onClose={() => { setCredito(null); cargar(); }} />
    </div>
  );
}

function ModalCrear({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: '', razonSocial: '', email: '', password: '', rfc: '', telefono: '', creditosIniciales: 0, aprobado: true });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/clientes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(f),
    });
    setLoading(false);
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? 'Error'); return; }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo cliente mayorista">
      <form onSubmit={enviar} className="space-y-3">
        <Mi l="Nombre contacto" v={f.name} on={(v) => setF({ ...f, name: v })} req />
        <Mi l="Razon social" v={f.razonSocial} on={(v) => setF({ ...f, razonSocial: v })} req />
        <div className="grid grid-cols-2 gap-3">
          <Mi l="Email" type="email" v={f.email} on={(v) => setF({ ...f, email: v })} req />
          <Mi l="Contrasena" type="password" v={f.password} on={(v) => setF({ ...f, password: v })} req />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Mi l="RFC" v={f.rfc} on={(v) => setF({ ...f, rfc: v.toUpperCase() })} />
          <Mi l="Telefono" v={f.telefono} on={(v) => setF({ ...f, telefono: v })} />
        </div>
        <Mi l="Creditos iniciales" type="number" v={String(f.creditosIniciales)} on={(v) => setF({ ...f, creditosIniciales: parseInt(v || '0', 10) })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.aprobado} onChange={(e) => setF({ ...f, aprobado: e.target.checked })} />
          Aprobar inmediatamente
        </label>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded bg-diamond-800 py-2 font-medium text-white hover:bg-diamond-700 disabled:opacity-50">
          {loading ? 'Guardando...' : 'Crear cliente'}
        </button>
      </form>
    </Modal>
  );
}

function ModalCreditos({ cliente, onClose }: { cliente: ClienteRow | null; onClose: () => void }) {
  const [monto, setMonto] = useState(0);
  const [tipo, setTipo] = useState<'RECARGA' | 'AJUSTE_MANUAL'>('RECARGA');
  const [motivo, setMotivo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/clientes/${cliente.id}/creditos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monto, tipo, motivo, referencia }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error ?? 'Error'); return; }
    onClose();
  }

  if (!cliente) return null;
  return (
    <Modal open={!!cliente} onClose={onClose} title={`Ajustar creditos - ${cliente.cliente?.razonSocial ?? cliente.name}`}>
      <p className="mb-3 text-sm text-slate-500">
        Saldo actual: <strong>{fmtCreditos(cliente.cliente?.creditos ?? 0)}</strong> creditos
      </p>
      <form onSubmit={enviar} className="space-y-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTipo('RECARGA')} className={`flex-1 rounded border px-3 py-2 text-sm ${tipo === 'RECARGA' ? 'border-diamond-500 bg-diamond-500/10' : 'border-slate-300'}`}>Recarga</button>
          <button type="button" onClick={() => setTipo('AJUSTE_MANUAL')} className={`flex-1 rounded border px-3 py-2 text-sm ${tipo === 'AJUSTE_MANUAL' ? 'border-diamond-500 bg-diamond-500/10' : 'border-slate-300'}`}>Ajuste manual</button>
        </div>
        <Mi l="Monto (negativo para descontar)" type="number" v={String(monto || '')} on={(v) => setMonto(parseInt(v || '0', 10))} req />
        {tipo === 'RECARGA' && <Mi l="Referencia bancaria" v={referencia} on={setReferencia} />}
        <Mi l="Motivo / nota" v={motivo} on={setMotivo} />
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded bg-diamond-800 py-2 font-medium text-white hover:bg-diamond-700 disabled:opacity-50">
          {loading ? 'Guardando...' : 'Aplicar'}
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
function Mi(props: { l: string; v: string; on: (v: string) => void; type?: string; req?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700">{props.l}</label>
      <input
        type={props.type ?? 'text'}
        required={props.req}
        value={props.v}
        onChange={(e) => props.on(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
      />
    </div>
  );
}
