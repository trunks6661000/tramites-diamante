export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

/**
 * GET /api/config/public  (requiere sesion via middleware, no expone admin-only)
 * Devuelve solo los campos que el frontend necesita para construir formularios:
 *  - costos por tipo de acta
 *  - horario de servicio
 */
export const GET = async () => {
  const c = await getConfig();
  return NextResponse.json({
    costos: {
      NACIMIENTO: c.costoNacimiento,
      MATRIMONIO: c.costoMatrimonio,
      DEFUNCION: c.costoDefuncion,
    },
    horario: { inicio: c.horarioInicio, fin: c.horarioFin, zona: c.zonaHoraria },
  });
};
