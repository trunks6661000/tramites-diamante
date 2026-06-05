import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, withAuth } from '@/lib/rbac';

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireSession();
  const { searchParams } = new URL(req.url);
  const soloNoLeidas = searchParams.get('soloNoLeidas') === '1';
  const items = await prisma.notificacion.findMany({
    where: { userId: session.user.id, ...(soloNoLeidas ? { leida: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ items });
});

const PatchSchema = z.object({
  ids: z.array(z.string()).min(1),
  leida: z.boolean(),
});

export const PATCH = withAuth(async (req: NextRequest) => {
  const session = await requireSession();
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  await prisma.notificacion.updateMany({
    where: { id: { in: parsed.data.ids }, userId: session.user.id },
    data: { leida: parsed.data.leida },
  });
  return NextResponse.json({ ok: true });
});
