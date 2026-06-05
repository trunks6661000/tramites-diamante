import { prisma } from './prisma';
import type { NextRequest } from 'next/server';

export interface LogArgs {
  actorId?: string | null;
  accion: string;
  recursoTipo?: string;
  recursoId?: string;
  payload?: unknown;
  req?: NextRequest | Request;
}

/**
 * Persiste un evento en LogAccion. Nunca lanza: si falla, solo logea consola
 * para no romper el flujo del request principal.
 */
export async function logAccion(args: LogArgs): Promise<void> {
  try {
    const ip =
      args.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      args.req?.headers.get('x-real-ip') ||
      undefined;
    const userAgent = args.req?.headers.get('user-agent') ?? undefined;
    await prisma.logAccion.create({
      data: {
        actorId: args.actorId ?? null,
        accion: args.accion,
        recursoTipo: args.recursoTipo,
        recursoId: args.recursoId,
        payload: args.payload as never,
        ip,
        userAgent,
      },
    });
  } catch (e) {
    console.error('[logAccion]', e);
  }
}
