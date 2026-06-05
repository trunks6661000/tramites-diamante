export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, withAuth } from '@/lib/rbac';

export const GET = withAuth(async () => {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      cliente: {
        select: {
          id: true,
          razonSocial: true,
          rfc: true,
          telefono: true,
          creditos: true,
        },
      },
    },
  });
  return NextResponse.json({ user });
});
