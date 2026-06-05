import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  NotificacionTipo,
  Role,
  UserStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, withAuth, AuthError } from '@/lib/rbac';
import { logAccion } from '@/lib/logger';

const PatchSchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
  name: z.string().min(2).max(120).optional(),
  razonSocial: z.string().min(2).max(160).optional(),
  rfc: z.string().optional().or(z.literal('')),
  telefono: z.string().optional().or(z.literal('')),
  notas: z.string().max(1000).optional(),
});

export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    await requireRole(Role.ADMIN);
    const user = await prisma.user.findFirst({
      where: { id: params.id, role: Role.CLIENTE },
      include: {
        cliente: true,
        pedidosComoCliente: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, folio: true, tipoActa: true, estado: true, creditosCobrados: true, createdAt: true },
        },
      },
    });
    if (!user) throw new AuthError(404, 'Cliente no encontrado');
    return NextResponse.json({ user });
  },
);

export const PATCH = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireRole(Role.ADMIN);
    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos', detalle: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const user = await prisma.user.findFirst({
      where: { id: params.id, role: Role.CLIENTE },
      include: { cliente: true },
    });
    if (!user) throw new AuthError(404, 'Cliente no encontrado');

    const userUpdate: Record<string, unknown> = {};
    if (data.status) userUpdate.status = data.status;
    if (data.name) userUpdate.name = data.name;

    const clienteUpdate: Record<string, unknown> = {};
    if (data.razonSocial) clienteUpdate.razonSocial = data.razonSocial;
    if (data.rfc !== undefined) clienteUpdate.rfc = data.rfc || null;
    if (data.telefono !== undefined) clienteUpdate.telefono = data.telefono || null;
    if (data.notas !== undefined) clienteUpdate.notas = data.notas || null;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: user.id }, data: userUpdate });
      if (user.cliente && Object.keys(clienteUpdate).length > 0) {
        await tx.cliente.update({ where: { id: user.cliente.id }, data: clienteUpdate });
      }
      if (data.status === UserStatus.APROBADO && user.status !== UserStatus.APROBADO) {
        await tx.notificacion.create({
          data: {
            userId: user.id,
            tipo: NotificacionTipo.CUENTA_APROBADA,
            titulo: 'Cuenta aprobada',
            mensaje: 'Tu cuenta ha sido aprobada. Ya puedes iniciar sesion y solicitar actas.',
          },
        });
      }
      if (data.status === UserStatus.SUSPENDIDO) {
        await tx.notificacion.create({
          data: {
            userId: user.id,
            tipo: NotificacionTipo.CUENTA_SUSPENDIDA,
            titulo: 'Cuenta suspendida',
            mensaje: 'Tu cuenta ha sido suspendida. Contacta al administrador.',
          },
        });
      }
      return u;
    });

    await logAccion({
      actorId: session.user.id,
      accion: 'CLIENTE_ACTUALIZAR',
      recursoTipo: 'User',
      recursoId: user.id,
      payload: data,
      req,
    });

    return NextResponse.json({ ok: true, user: updated });
  },
);

// DELETE -> soft delete (status = ELIMINADO). Mantiene historial de pedidos.
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireRole(Role.ADMIN);
    const user = await prisma.user.findFirst({ where: { id: params.id, role: Role.CLIENTE } });
    if (!user) throw new AuthError(404, 'Cliente no encontrado');
    await prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ELIMINADO },
    });
    await logAccion({
      actorId: session.user.id,
      accion: 'CLIENTE_ELIMINAR',
      recursoTipo: 'User',
      recursoId: user.id,
      req,
    });
    return NextResponse.json({ ok: true });
  },
);
