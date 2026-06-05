import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession, withAuth, AuthError } from '@/lib/rbac';

// GET /api/pedidos/:id  -> detalle (cliente solo el suyo)
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const pedido = await prisma.pedido.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, razonSocial: true, user: { select: { name: true, email: true } } } },
        historial: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { name: true, role: true } } },
        },
      },
    });
    if (!pedido) throw new AuthError(404, 'Pedido no encontrado');
    if (session.user.role === Role.CLIENTE && pedido.userClienteId !== session.user.id) {
      throw new AuthError(403, 'No autorizado');
    }
    return NextResponse.json({ pedido });
  },
);
