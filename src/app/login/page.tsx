'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError(res.error === 'CredentialsSignin' ? 'Credenciales invalidas' : res.error);
      return;
    }
    // Redireccion segun rol -- lo resolvemos despues con /api/me
    const me = await fetch('/api/me').then((r) => r.json());
    const role = me.user?.role;
    const destino =
      callbackUrl !== '/'
        ? callbackUrl
        : role === 'ADMIN'
        ? '/admin'
        : role === 'PROVEEDOR'
        ? '/proveedor'
        : '/cliente/dashboard';
    router.push(destino);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-diamond-900 to-diamond-700 px-4">
      <div className="w-full max-w-md">
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-diamond-300">Tramites</span> Diamante
          </h1>
          <p className="mt-1 text-sm text-diamond-300">Plataforma de actas para mayoristas</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5 rounded-xl bg-white p-7 shadow-2xl"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-diamond-500 focus:outline-none focus:ring-2 focus:ring-diamond-200"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Contrasena</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-diamond-500 focus:outline-none focus:ring-2 focus:ring-diamond-200"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-diamond-800 py-2.5 font-medium text-white hover:bg-diamond-700 disabled:opacity-50"
          >
            {loading ? 'Validando...' : 'Iniciar sesion'}
          </button>
          <p className="text-center text-sm text-slate-500">
            No tienes cuenta?{' '}
            <Link href="/registro" className="font-medium text-diamond-700 hover:underline">
              Solicitar acceso
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
