'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const MENUS = {
  ADMIN: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/pedidos', label: 'Pedidos' },
    { href: '/admin/clientes', label: 'Clientes' },
    { href: '/admin/recargas', label: 'Recargas' },
    { href: '/admin/config', label: 'Configuracion' },
  ],
  CLIENTE: [
    { href: '/cliente/dashboard', label: 'Inicio' },
    { href: '/cliente/pedidos/nuevo', label: 'Nuevo pedido' },
    { href: '/cliente/pedidos', label: 'Mis pedidos' },
    { href: '/cliente/recargas', label: 'Recargas' },
  ],
  PROVEEDOR: [{ href: '/proveedor', label: 'Pedidos por procesar' }],
};

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  if (!session) return null;
  const role = session.user.role as keyof typeof MENUS;
  const items = MENUS[role] ?? [];

  return (
    <header className="sticky top-0 z-30 border-b border-diamond-700 bg-diamond-900 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-diamond-300">Tramites</span> Diamante
          </Link>
          <nav className="hidden gap-1 md:flex">
            {items.map((it) => {
              const active = pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`rounded px-3 py-1.5 text-sm transition ${
                    active ? 'bg-diamond-700 text-white' : 'text-diamond-300 hover:bg-diamond-800 hover:text-white'
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right text-xs sm:block">
            <p className="font-medium">{session.user.name}</p>
            <p className="text-diamond-300">{role}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded border border-diamond-500 px-3 py-1.5 text-xs font-medium hover:bg-diamond-700"
          >
            Salir
          </button>
        </div>
      </div>
      {/* Menu movil */}
      <nav className="flex gap-1 overflow-x-auto border-t border-diamond-700 px-4 py-2 md:hidden">
        {items.map((it) => {
          const active = pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`whitespace-nowrap rounded px-3 py-1 text-xs ${
                active ? 'bg-diamond-700 text-white' : 'text-diamond-300'
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
