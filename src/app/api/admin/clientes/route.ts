import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, withAuth } from '@/lib/rbac';
import { logAccion } from '@/lib/logger';

// GET /api/admin/clientes  ?status=...&search=...&page=...
export const GET = withAuth(async (req: NextRequest) => {
  await requireRole(Role.ADMIN);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as UserStatus | null;
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));

  const where: Record<string, unknown> = { role: Role.CLIENTE };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { cliente: { razonSocial: { contains: search, mode: 'insensitive' } } },
      { cliente: { rfc: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        cliente: {
          select: { id: true, razonSocial: true, rfc: true, telefono: true, creditos: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ items, page, pageSize, total });
});

// POST /api/admin/clientes  -> crear cliente manualmente (admin alta directa)
const CrearSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  razonSocial: z.string().min(2),
  rfc: z.string().optional(),
  telefono: z.string().optional(),
  creditosIniciales: z.number().int().min(0).optional(),
  aprobado: z.boolean().optional(),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireRole(Role.ADMIN);
  const body = await req.json().catch(() => null);
  const parsed = CrearSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const {
    email,
    password,
    name,
    razonSocial,
    rfc,
    telefono,
    creditosIniciales = 0,
    aprobado = true,
  } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  const dup = await prisma.user.findUnique({ where: { email: emailLower } });
  if (dup) return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      email: emailLower,
      passwordHash: await bcrypt.hash(password, 12),
      name,
      role: Role.CLIENTE,
      status: aprobado ? UserStatus.APROBADO : UserStatus.PENDIENTE,
      phone: telefono ?? null,
      cliente: {
        create: { razonSocial, rfc: rfc ?? null, telefono: telefono ?? null, creditos: creditosIniciales },
      },
    },
    include: { cliente: true },
  });

  await logAccion({
    actorId: session.user.id,
    accion: 'CLIENTE_CREAR',
    recursoTipo: 'User',
    recursoId: user.id,
    payload: { email: user.email, creditosIniciales, aprobado },
    req,
  });

  return NextResponse.json({ ok: true, user }, { status: 201 });
});
