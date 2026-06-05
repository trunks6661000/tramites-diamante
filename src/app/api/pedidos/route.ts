import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  MovimientoTipo,
  NotificacionTipo,
  PedidoEstado,
  Role,
  TipoActa,
} from '@prisma/client';
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma';
import { requireSession, withAuth, AuthError } from '@/lib/rbac';
import { validarCurp } from '@/lib/curp';
import { getScheduleStatus } from '@/lib/schedule';
import { costoPorTipo, getConfig } from '@/lib/config';
import { generarFolioPedido } from '@/lib/folio';
import { notificarProveedorPedido } from '@/lib/whatsapp';
import { logAccion } from '@/lib/logger';

const CrearPedidoSchema = z.object({
  tipoActa: z.nativeEnum(TipoActa),
  curp: z.string().min(18).max(18),
  datosAdicionales: z.record(z.string(), z.unknown()).optional(),
});

// =====================================================================
// GET /api/pedidos
// Cliente: solo sus pedidos. Admin/Proveedor: todos con filtros.
// Query: ?estado=PENDIENTE&page=1&pageSize=20
// =====================================================================
export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireSession();
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado') as PedidoEstado | null;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (session.user.role === Role.CLIENTE) {
    where.userClienteId = session.user.id;
  }

  const [items, total] = await prisma.$transaction([
    prisma.pedido.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        folio: true,
        tipoActa: true,
        curp: true,
        estado: true,
        creditosCobrados: true,
        motivoRechazo: true,
        createdAt: true,
        updatedAt: true,
        pdfSubidoAt: true,
        cliente: { select: { razonSocial: true } },
      },
    }),
    prisma.pedido.count({ where }),
  ]);

  return NextResponse.json({ items, page, pageSize, total });
});

// =====================================================================
// POST /api/pedidos
// Crear pedido (solo CLIENTE). Aplica:
//   1) Validacion de horario de servicio
//   2) Validacion estricta de CURP
//   3) Verificacion + descuento atomico de creditos
//   4) Generacion de folio unico
//   5) Notificacion WhatsApp al proveedor (no bloqueante)
// =====================================================================
export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireSession();
  if (session.user.role !== Role.CLIENTE) {
    throw new AuthError(403, 'Solo clientes pueden crear pedidos');
  }

  // 1) Horario
  const horario = await getScheduleStatus();
  if (!horario.abierto) {
    return NextResponse.json(
      {
        error: horario.mensajeCerrado,
        horario: { inicio: horario.inicio, fin: horario.fin, ahora: horario.ahora },
        cerrado: true,
      },
      { status: 423 }, // 423 Locked
    );
  }

  // 2) Validacion entrada
  const body = await req.json().catch(() => null);
  const parsed = CrearPedidoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos invalidos', detalle: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { tipoActa, datosAdicionales } = parsed.data;

  const curpVal = validarCurp(parsed.data.curp);
  if (!curpVal.valido) {
    return NextResponse.json({ error: curpVal.error, campo: 'curp' }, { status: 400 });
  }
  const curp = curpVal.curp!;

  // 3) Cliente + costo
  const cliente = await prisma.cliente.findUnique({
    where: { userId: session.user.id },
    select: { id: true, creditos: true, razonSocial: true },
  });
  if (!cliente) {
    return NextResponse.json({ error: 'Perfil de cliente no encontrado' }, { status: 404 });
  }
  const costo = await costoPorTipo(tipoActa);
  if (cliente.creditos < costo) {
    return NextResponse.json(
      {
        error: `Creditos insuficientes. Necesitas ${costo}, tienes ${cliente.creditos}.`,
        requeridos: costo,
        disponibles: cliente.creditos,
      },
      { status: 402 }, // Payment Required
    );
  }

  // 4) Transaccion: folio + pedido + descuento + movimiento + historial
  const folio = await generarFolioPedido();
  const pedido = await prisma.$transaction(async (tx) => {
    // Lock optimista: re-leer y validar saldo dentro de la transaccion
    const clienteFresh = await tx.cliente.findUniqueOrThrow({
      where: { id: cliente.id },
      select: { id: true, creditos: true },
    });
    if (clienteFresh.creditos < costo) {
      throw new AuthError(402, 'Creditos insuficientes (saldo cambio durante la operacion)');
    }
    const saldoAntes = clienteFresh.creditos;
    const saldoDespues = saldoAntes - costo;

    const p = await tx.pedido.create({
      data: {
        folio,
        clienteId: cliente.id,
        userClienteId: session.user.id,
        tipoActa,
        curp,
        datosAdicionales: (datosAdicionales ?? null) as any,
        creditosCobrados: costo,
        estado: PedidoEstado.PENDIENTE,
      },
    });
    await tx.cliente.update({
      where: { id: cliente.id },
      data: { creditos: saldoDespues },
    });
    await tx.movimientoCredito.create({
      data: {
        clienteId: cliente.id,
        tipo: MovimientoTipo.CARGO_PEDIDO,
        monto: -costo,
        saldoAntes,
        saldoDespues,
        pedidoId: p.id,
        actorId: session.user.id,
        motivo: `Cargo por pedido ${folio}`,
      },
    });
    await tx.pedidoHistorial.create({
      data: {
        pedidoId: p.id,
        estadoAnterior: null,
        estadoNuevo: PedidoEstado.PENDIENTE,
        actorId: session.user.id,
        motivo: 'Pedido creado por cliente',
      },
    });
    await tx.notificacion.create({
      data: {
        userId: session.user.id,
        tipo: NotificacionTipo.PEDIDO_CREADO,
        titulo: 'Pedido creado',
        mensaje: `Tu pedido ${folio} se creo correctamente.`,
        payload: { pedidoId: p.id, folio },
      },
    });
    return p;
  });

  // 5) Notificacion WhatsApp al proveedor (best effort, no bloqueamos respuesta)
  const config = await getConfig();
  const phone = config.whatsappProveedor ?? process.env.WHATSAPP_PROVIDER_PHONE ?? '';
  let whatsapp: Awaited<ReturnType<typeof notificarProveedorPedido>> | null = null;
  if (phone) {
    whatsapp = await notificarProveedorPedido(
      {
        telefono: phone,
        folio: pedido.folio,
        tipoActa: pedido.tipoActa,
        curp: pedido.curp,
        cliente: cliente.razonSocial,
        fechaHora: pedido.createdAt.toISOString(),
      },
      config.whatsappPlantilla,
    );
  }

  await logAccion({
    actorId: session.user.id,
    accion: 'PEDIDO_CREAR',
    recursoTipo: 'Pedido',
    recursoId: pedido.id,
    payload: { folio: pedido.folio, costo },
    req,
  });

  return NextResponse.json(
    {
      ok: true,
      pedido: {
        id: pedido.id,
        folio: pedido.folio,
        tipoActa: pedido.tipoActa,
        curp: pedido.curp,
        estado: pedido.estado,
        creditosCobrados: pedido.creditosCobrados,
        createdAt: pedido.createdAt,
      },
      whatsapp,
    },
    { status: 201 },
  );
});
