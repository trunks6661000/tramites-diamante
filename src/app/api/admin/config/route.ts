import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, withAuth } from '@/lib/rbac';
import { logAccion } from '@/lib/logger';
import { enRangoHorario } from '@/lib/schedule';

const HHMM = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:mm requerido');

const PatchSchema = z.object({
  horarioInicio: HHMM.optional(),
  horarioFin: HHMM.optional(),
  zonaHoraria: z.string().min(3).optional(),
  servicioCerradoMsg: z.string().max(300).optional(),
  costoNacimiento: z.number().int().positive().optional(),
  costoMatrimonio: z.number().int().positive().optional(),
  costoDefuncion: z.number().int().positive().optional(),
  whatsappProveedor: z.string().regex(/^\d{10,15}$/, 'Numero E.164 sin +').optional().or(z.literal('')),
  whatsappPlantilla: z.string().max(500).optional(),
  emailListoAsunto: z.string().max(200).optional(),
});

export const GET = withAuth(async () => {
  await requireRole(Role.ADMIN);
  const config = await prisma.configSistema.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  return NextResponse.json({ config });
});

export const PATCH = withAuth(async (req: NextRequest) => {
  const session = await requireRole(Role.ADMIN);
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos', detalle: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Validacion logica horario
  if (data.horarioInicio && data.horarioFin) {
    const prueba = enRangoHorario(data.horarioInicio, data.horarioInicio, data.horarioFin);
    if (!prueba && data.horarioInicio === data.horarioFin) {
      return NextResponse.json({ error: 'Inicio y fin no pueden ser iguales' }, { status: 400 });
    }
  }
  if (data.whatsappProveedor === '') data.whatsappProveedor = undefined;

  const config = await prisma.configSistema.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });

  await logAccion({
    actorId: session.user.id,
    accion: 'CONFIG_ACTUALIZAR',
    recursoTipo: 'ConfigSistema',
    payload: data,
    req,
  });

  return NextResponse.json({ ok: true, config });
});
