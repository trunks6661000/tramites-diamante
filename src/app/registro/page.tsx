'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegistroPage() {
  const [form, setForm] = useState({
    name: '',
    razonSocial: '',
    rfc: '',
    telefono: '',
    email: '',
    password: '',
  });
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Error al registrar');
      return;
    }
    setOk(true);
  }

  if (ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border border-emerald-200 bg-white p-8 text-center shadow">
          <h1 className="text-2xl font-bold text-emerald-700">Solicitud recibida</h1>
          <p className="mt-3 text-slate-600">
            Un administrador revisara tu cuenta. Recibiras una notificacion cuando sea aprobada.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded bg-diamond-800 px-5 py-2 text-white hover:bg-diamond-700"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-xl bg-white p-7 shadow">
        <h1 className="text-2xl font-bold text-diamond-900">Solicitar acceso mayorista</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tu cuenta quedara pendiente hasta que un administrador la apruebe.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input label="Nombre del contacto" required value={form.name} onChange={(v) => set('name', v)} />
          <Input label="Razon social" required value={form.razonSocial} onChange={(v) => set('razonSocial', v)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="RFC (opcional)" value={form.rfc} onChange={(v) => set('rfc', v.toUpperCase())} />
            <Input label="Telefono (opcional)" value={form.telefono} onChange={(v) => set('telefono', v)} />
          </div>
          <Input label="Correo" type="email" required value={form.email} onChange={(v) => set('email', v)} />
          <Input label="Contrasena (min 8)" type="password" required value={form.password} onChange={(v) => set('password', v)} />
          {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-diamond-800 py-2.5 font-medium text-white hover:bg-diamond-700 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
          <p className="text-center text-sm text-slate-500">
            Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-diamond-700 hover:underline">Inicia sesion</Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{props.label}</label>
      <input
        type={props.type ?? 'text'}
        required={props.required}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-diamond-500 focus:outline-none focus:ring-2 focus:ring-diamond-200"
      />
    </div>
  );
}
