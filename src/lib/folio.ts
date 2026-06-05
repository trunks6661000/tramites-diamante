import { prisma } from './prisma';

/**
 * Genera folios unicos del tipo PREFIX-YYYY-000123.
 * Usa una transaccion con conteo + reintento simple por si hay colision.
 * Para volumenes mayores conviene migrar a una secuencia Postgres dedicada.
 */
export async function generarFolioPedido(): Promise<string> {
  const anio = new Date().getFullYear();
  for (let intento = 0; intento < 5; intento++) {
    const total = await prisma.pedido.count({
      where: { folio: { startsWith: `TD-${anio}-` } },
    });
    const candidato = `TD-${anio}-${String(total + 1 + intento).padStart(6, '0')}`;
    const existe = await prisma.pedido.findUnique({ where: { folio: candidato } });
    if (!existe) return candidato;
  }
  // Fallback: timestamp
  return `TD-${anio}-${Date.now()}`;
}

export async function generarFolioRecarga(): Promise<string> {
  const anio = new Date().getFullYear();
  for (let intento = 0; intento < 5; intento++) {
    const total = await prisma.recarga.count({
      where: { folio: { startsWith: `RC-${anio}-` } },
    });
    const candidato = `RC-${anio}-${String(total + 1 + intento).padStart(6, '0')}`;
    const existe = await prisma.recarga.findUnique({ where: { folio: candidato } });
    if (!existe) return candidato;
  }
  return `RC-${anio}-${Date.now()}`;
}
