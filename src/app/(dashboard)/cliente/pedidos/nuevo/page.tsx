'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CurpInput } from '@/components/CurpInput';
import { HorarioBanner } from '@/components/HorarioBanner';
import { validarCurp } from '@/lib/curp';

interface Me {
  user: { cliente: { creditos: number; razonSocial: string } | null } | null;
}

interface PublicConfig {
  costos: { NACIMIENTO: number; MATRIMONIO: number; DEFUNCION: number };
}

const TIPOS = [
  { value: 'NACIMIENTO', label: 'Acta de nacimiento' },
  { value: 'MATRIMONIO', label: 'Acta de matrimonio' },
  { value: 'DEFUNCION', label: 'Acta de defuncion' },
] as const;

export default function NuevoPedidoPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [costos, setCostos] = useState<PublicConfig['costos'] | null>(null);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]['value']>('NACIMIENTO');
  const [curp, setCurp] = useState('');
  const [extra, setExtra] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then((r) => r.json()),
      fetch('/api/config/public').then((r) => r.json() as Promise<PublicConfig>),
    ]).then(([meData, cfg]) => {
      setMe(meData);
      setCostos(cfg.costos);
    });
  }, []);

  const costoActual = costos ? costos[tipo] : undefined;
  const saldo = me?.user?.cliente?.creditos ?? 0;
  const saldoOk = costoActual !== undefined && saldo >= costoActual;
  const curpOk = validarCurp(curp).valido;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!curpOk) {
      setError('CURP invalida');
      return;
    }
    setLoading(true);
    const body: Record<string, unknown> = { tipoActa: tipo, curp };
    if (extra.trim()) body.datosAdicionales = { notas: extra.trim() };
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'No se pudo crear el pedido');
      return;
    }
    router.push(`/cliente/pedidos/${data.pedido.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-diamond-900">Nuevo pedido</h1>
        <p className="text-sm text-slate-500">Solicita un acta del Registro Civil mexicano.</p>
      </div>

      <HorarioBanner />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between rounded bg-slate-50 px-4 py-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Saldo disponible</p>
            <p className="text-2xl font-bold text-diamond-900">{saldo} <span className="text-sm font-normal">creditos</span></p>
          </div>
          {costoActual !== undefined && (
            <div className="text-right">
              <p className="text-xs uppercase text-slate-500">Costo de este pedido</p>
              <p className={`text-2xl font-bold ${saldoOk ? 'text-emerald-700' : 'text-red-700'}`}>
                -{costoActual}
              </p>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tipo de acta *</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TIPOS.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTipo(t.value)}
                  className={`rounded border px-3 py-3 text-sm transition ${
                    tipo === t.value
                      ? 'border-diamond-500 bg-diamond-500/10 text-diamond-900'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <CurpInput value={curp} onChange={setCurp} disabled={loading} />

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Notas adicionales (opcional)
            </label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ej. nombre completo del padre, fecha exacta de matrimonio, etc."
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-diamond-500 focus:outline-none focus:ring-2 focus:ring-diamond-200"
            />
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {!saldoOk && costoActual !== undefined && (
            <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Saldo insuficiente. Necesitas {costoActual} y tienes {saldo}.{' '}
              <a href="/cliente/recargas" className="font-medium underline">
                Solicita una recarga
              </a>
              .
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !curpOk || !saldoOk}
            className="w-full rounded bg-diamond-800 py-3 font-medium text-white hover:bg-diamond-700 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : `Crear pedido (-${costoActual ?? '?'} creditos)`}
          </button>
        </form>
      </div>
    </div>
  );
}
