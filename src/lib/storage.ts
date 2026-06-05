import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Capa de almacenamiento. Hoy: S3-compatible (AWS / R2 / MinIO).
 * La interfaz publica esta pensada para que un futuro driver local sea drop-in.
 */

const region = process.env.S3_REGION ?? 'us-east-1';
const endpoint = process.env.S3_ENDPOINT || undefined;
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
const bucket = process.env.S3_BUCKET ?? 'tramites-diamante';
const ttl = parseInt(process.env.S3_SIGNED_URL_TTL ?? '300', 10);

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle,
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export interface SubirArchivoArgs {
  key: string;
  body: Buffer | Uint8Array;
  mimeType: string;
  metadata?: Record<string, string>;
}

export async function subirArchivo({ key, body, mimeType, metadata }: SubirArchivoArgs) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      Metadata: metadata,
      ServerSideEncryption: 'AES256',
    }),
  );
  return { bucket, key };
}

export async function urlDescargaFirmada(key: string, ttlSeconds = ttl, downloadName?: string) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: downloadName
      ? `attachment; filename="${encodeURIComponent(downloadName)}"`
      : undefined,
  });
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds });
}

export async function borrarArchivo(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Construye keys deterministas y aislados por recurso.
 * IMPORTANTE: no incluir el folio en el path publicamente reusable; usar el id del pedido.
 */
export const storageKeys = {
  pedidoPdf: (pedidoId: string) => `pedidos/${pedidoId}/acta.pdf`,
  recargaComprobante: (recargaId: string, ext: string) =>
    `recargas/${recargaId}/comprobante.${ext.replace(/[^a-z0-9]/gi, '')}`,
};

export const PDF_MIME = 'application/pdf';
export const PDF_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export function validarPdfBuffer(buf: Buffer): { ok: boolean; error?: string } {
  if (buf.byteLength === 0) return { ok: false, error: 'Archivo vacio' };
  if (buf.byteLength > PDF_MAX_BYTES) return { ok: false, error: 'Archivo demasiado grande (max 20MB)' };
  // Magic bytes PDF: %PDF-
  if (
    buf[0] !== 0x25 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x44 ||
    buf[3] !== 0x46 ||
    buf[4] !== 0x2d
  ) {
    return { ok: false, error: 'El archivo no es un PDF valido' };
  }
  return { ok: true };
}
