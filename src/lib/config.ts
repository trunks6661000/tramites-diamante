import { TipoActa } from '@prisma/client';
import { prisma } from './prisma';

export async function getConfig() {
  return prisma.configSistema.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
}

export async function costoPorTipo(tipo: TipoActa): Promise<number> {
  const c = await getConfig();
  switch (tipo) {
    case TipoActa.NACIMIENTO:
      return c.costoNacimiento;
    case TipoActa.MATRIMONIO:
      return c.costoMatrimonio;
    case TipoActa.DEFUNCION:
      return c.costoDefuncion;
  }
}
