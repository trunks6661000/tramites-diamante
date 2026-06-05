export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireSession, withAuth } from '@/lib/rbac';

/**
 * POST /api/uploads/presign
 *
 * Genera una URL firmada para que el cliente suba un comprobante de transferencia
 * directamente a S3, sin que pase por el backend.
 *
 * Body:
 *   { tipo: 'comprobante', mimeType: 'image/jpeg', size: 123456 }
 *
 * Devuelve { url, key, headers } para hacer un PUT directo.
 */

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const Schema = z.object({
  tipo: z.enum(['comprobante']),
  mimeType: z.string(),
  size: z.number().int().positive(),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }
  const { tipo, mimeType, size } = parsed.data;
  if (!ALLOWED_MIME[mimeType]) {
    return NextResponse.json({ error: 'Tipo MIME no permitido' }, { status: 400 });
  }
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: 'Archivo demasiado grande (max 10MB)' }, { status: 400 });
  }

  const ext = ALLOWED_MIME[mimeType];
  const ts = Date.now();
  const key = `uploads/${tipo}/${session.user.id}/${ts}.${ext}`;

  const s3 = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET ?? 'tramites-diamante',
    Key: key,
    ContentType: mimeType,
    ContentLength: size,
    ServerSideEncryption: 'AES256',
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });

  return NextResponse.json({
    url,
    key,
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    expiresIn: 300,
  });
});
