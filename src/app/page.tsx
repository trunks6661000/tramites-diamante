import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Role } from '@prisma/client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    if (session.user.role === Role.ADMIN) redirect('/admin');
    if (session.user.role === Role.PROVEEDOR) redirect('/proveedor');
    redirect('/cliente/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-diamond-900 via-diamond-800 to-diamond-700 px-4 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          <span className="text-diamond-300">Tramites</span> Diamante
        </h1>
        <p className="mt-4 text-lg text-diamond-300 md:text-xl">
          Plataforma privada de actas para clientes mayoristas
        </p>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-300">
          Actas de nacimiento, matrimonio y defuncion en PDF, con sistema de creditos
          prepagados. Acceso solo para clientes autorizados (papelerias y gestorias).
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-white px-6 py-3 font-medium text-diamond-900 shadow-lg transition hover:bg-diamond-300"
          >
            Iniciar sesion
          </Link>
          <Link
            href="/registro"
            className="rounded-lg border border-white/30 px-6 py-3 font-medium text-white backdrop-blur hover:bg-white/10"
          >
            Solicitar acceso
          </Link>
        </div>
        <p className="mt-12 text-xs text-slate-400">
          Las cuentas nuevas requieren aprobacion del administrador.
        </p>
      </div>
    </main>
  );
}
