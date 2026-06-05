import { NextRequest, NextResponse } from 'next/server';
import { PedidoEstado, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession, withAuth, AuthError } from '@/lib/rbac';
import { urlDescargaFirmada } from '@/lib/storage';
import { logAccion } from '@/lib/logger';

/**
 * GET /api/pedidos/:id/pdf
 *
 * Devuelve una URL firmada de corta duracion para descargar el PDF.
 * Reglas:
 *   - El pedido debe existir y estar en estado LISTO.
 *   - El usuario debe ser el dueno del pedido, ADMIN o PROVEEDOR.
 *   - Nunca se expone el bucket key crudo.
 */
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const pedido = await prisma.pedido.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        folio: true,
        userClienteId: true,
        estado: true,
        pdfStorageKey: true,
        pdfOriginalName: true,
      },
    });
    if (!pedido) throw new AuthError(404, 'Pedido no encontrado');

    const esDueno = pedido.userClienteId === session.user.id;
    const esAdminOprov = session.user.role === Role.ADMIN || session.user.role === Role.PROVEEDOR;
    if (!esDueno && !esAdminOprov) throw new AuthError(403, 'No autorizado');

    if (pedido.estado !== PedidoEstado.LISTO || !pedido.pdfStorageKey) {
      throw new AuthError(409, 'El acta aun no esta lista para descargar');
    }

    const downloadName = pedido.pdfOriginalName ?? `${pedido.folio}.pdf`;
    const url = await urlDescargaFirmada(pedido.pdfStorageKey, undefined, downloadName);

    await logAccion({
      actorId: session.user.id,
      accion: 'PEDIDO_DESCARGAR_PDF',
      recursoTipo: 'Pedido',
      recursoId: pedido.id,
      payload: { folio: pedido.folio },
      req,
    });

    return NextResponse.json({ url, expiresIn: parseInt(process.env.S3_SIGNED_URL_TTL ?? '300', 10) });
  },
);
