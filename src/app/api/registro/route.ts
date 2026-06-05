import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAccion } from '@/lib/logger';

const RegistroSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(72),
  name: z.string().min(2).max(120),
  razonSocial: z.string().min(2).max(160),
  rfc: z.string().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i).optional().or(z.literal('')),
  telefono: z.string().regex(/^\d{10,15}$/).optional().or(z.literal('')),
});

/**
 * Registro publico de clientes mayoristas.
 * El usuario queda en estado PENDIENTE hasta que un admin lo apruebe.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegistroSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', detalle: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { email, password, name, razonSocial, rfc, telefono } = parsed.data;
    const emailLower = email.toLowerCase().trim();

    const existente = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existente) {
      return NextResponse.json({ error: 'El correo ya esta registrado' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        name,
        role: Role.CLIENTE,
        status: UserStatus.PENDIENTE,
        phone: telefono || null,
        cliente: {
          create: {
            razonSocial,
            rfc: rfc || null,
            telefono: telefono || null,
            creditos: 0,
          },
        },
      },
      select: { id: true, email: true, name: true, status: true },
    });

    await logAccion({ actorId: user.id, accion: 'REGISTRO_SOLICITADO', recursoTipo: 'User', recursoId: user.id, req });

    return NextResponse.json({
      ok: true,
      mensaje: 'Solicitud de registro recibida. Un administrador revisara tu cuenta.',
      user,
    });
  } catch (e) {
    console.error('[registro]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
