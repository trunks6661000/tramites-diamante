'use client';

import { useEffect, useState } from 'react';

interface Config {
  horarioInicio: string;
  horarioFin: string;
  zonaHoraria: string;
  servicioCerradoMsg: string;
  costoNacimiento: number;
  costoMatrimonio: number;
  costoDefuncion: number;
  whatsappProveedor: string | null;
  whatsappPlantilla: string;
  emailListoAsunto: string;
}

export default function AdminConfigPage() {
  const [c, setC] = useState<Config | null>(null);
  const [original, setOriginal] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/config').then((r) => r.json()).then((d) => {
      setC(d.config);
      setOriginal(d.config);
    });
  }, []);

  function set<K extends keyof Config>(k: K, v: Config[K]) {
    if (!c) return;
    setC({ ...c, [k]: v });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!c) return;
    setLoading(true);
    setMsg(null);
    const cambios: Partial<Config> = {};
    (Object.keys(c) as (keyof Config)[]).forEach((k) => {
      if (JSON.stringify(c[k]) !== JSON.stringify(original?.[k])) {
        (cambios as Record<string, unknown>)[k] = c[k];
      }
    });
    const res = await fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setMsg({ tipo: 'err', texto: d.error ?? 'Error' }); return; }
    setOriginal(d.config);
    setMsg({ tipo: 'ok', texto: 'Configuracion guardada' });
  }

  if (!c) return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-diamond-900">Configuracion del sistema</h1>

      <form onSubmit={guardar} className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Horario de servicio</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input l="Hora inicio (HH:mm)" v={c.horarioInicio} on={(v) => set('horarioInicio', v)} />
            <Input l="Hora fin (HH:mm)" v={c.horarioFin} on={(v) => set('horarioFin', v)} />
            <Input l="Zona horaria" v={c.zonaHoraria} on={(v) => set('zonaHoraria', v)} />
          </div>
          <Input l="Mensaje cuando esta cerrado" v={c.servicioCerradoMsg} on={(v) => set('servicioCerradoMsg', v)} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Costos por tipo de acta</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input l="Nacimiento" type="number" v={String(c.costoNacimiento)} on={(v) => set('costoNacimiento', parseInt(v || '0', 10))} />
            <Input l="Matrimonio" type="number" v={String(c.costoMatrimonio)} on={(v) => set('costoMatrimonio', parseInt(v || '0', 10))} />
            <Input l="Defuncion" type="number" v={String(c.costoDefuncion)} on={(v) => set('costoDefuncion', parseInt(v || '0', 10))} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">WhatsApp proveedor</h2>
          <Input l="Telefono E.164 sin + (ej. 521555...)" v={c.whatsappProveedor ?? ''} on={(v) => set('whatsappProveedor', v)} />
          <Input
            l="Plantilla mensaje (variables: {{folio}}, {{tipoActa}}, {{curp}}, {{cliente}}, {{fechaHora}})"
            v={c.whatsappPlantilla}
            on={(v) => set('whatsappPlantilla', v)}
            multiline
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Email</h2>
          <Input l="Asunto del correo cuando acta esta lista" v={c.emailListoAsunto} on={(v) => set('emailListoAsunto', v)} />
        </section>

        {msg && (
          <div className={`rounded p-3 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {msg.texto}
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full rounded bg-diamond-800 py-3 font-medium text-white hover:bg-diamond-700 disabled:opacity-50">
          {loading ? 'Guardando...' : 'Guardar configuracion'}
        </button>
      </form>
    </div>
  );
}

function Input({ l, v, on, type, multiline }: { l: string; v: string; on: (v: string) => void; type?: string; multiline?: boolean }) {
  return (
    <div className={multiline ? 'mt-3' : 'mt-3'}>
      <label className="block text-xs font-medium text-slate-700">{l}</label>
      {multiline ? (
        <textarea value={v} onChange={(e) => on(e.target.value)} rows={3} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      ) : (
        <input type={type ?? 'text'} value={v} onChange={(e) => on(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      )}
    </div>
  );
}
