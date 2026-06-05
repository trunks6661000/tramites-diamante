import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware de routing y RBAC.
 * NOTE: el bloqueo por horario se aplica EN la API de crear pedido,
 * no aqui, porque necesita lectura de DB (no permitida en edge runtime).
 */

const PUBLIC_PATHS = new Set(['/', '/login', '/registro', '/api/auth', '/closed']);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/public/')) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string | undefined;

  // RBAC por prefijo de ruta
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (role !== 'ADMIN') {
      return pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 })
        : NextResponse.redirect(new URL('/', req.url));
    }
  }
  if (pathname.startsWith('/proveedor') || pathname.startsWith('/api/proveedor')) {
    if (role !== 'PROVEEDOR' && role !== 'ADMIN') {
      return pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 })
        : NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
