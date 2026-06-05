import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { authOptions } from './auth';

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new AuthError(401, 'No autenticado');
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new AuthError(403, 'Permiso insuficiente');
  }
  return session;
}

export function handleAuthError(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/**
 * Wrap helper para no repetir try/catch en cada handler.
 */
export function withAuth<T extends (...args: never[]) => Promise<Response>>(
  fn: T,
): (...args: Parameters<T>) => Promise<Response> {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      const handled = handleAuthError(err);
      if (handled) return handled;
      console.error('[api error]', err);
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
  };
}
