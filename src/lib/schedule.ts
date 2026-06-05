import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { prisma } from './prisma';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export interface ScheduleStatus {
  abierto: boolean;
  ahora: string;          // HH:mm en zona configurada
  inicio: string;
  fin: string;
  zona: string;
  mensajeCerrado: string;
}

/**
 * Lee la configuracion del sistema y determina si el servicio esta abierto.
 * Se usa tanto en middleware como en handlers de API.
 */
export async function getScheduleStatus(): Promise<ScheduleStatus> {
  const config = await prisma.configSistema.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  const zona = config.zonaHoraria || process.env.TIMEZONE || 'America/Mexico_City';
  const ahoraDayjs = dayjs().tz(zona);
  const ahora = ahoraDayjs.format('HH:mm');

  const abierto = enRangoHorario(ahora, config.horarioInicio, config.horarioFin);

  return {
    abierto,
    ahora,
    inicio: config.horarioInicio,
    fin: config.horarioFin,
    zona,
    mensajeCerrado: config.servicioCerradoMsg,
  };
}

/**
 * Compara "HH:mm" actual contra inicio/fin.
 * Soporta horarios que cruzan medianoche (ej. 22:00 -> 06:00).
 */
export function enRangoHorario(ahora: string, inicio: string, fin: string): boolean {
  const a = toMinutes(ahora);
  const i = toMinutes(inicio);
  const f = toMinutes(fin);
  if (a === null || i === null || f === null) return false;
  if (i === f) return false;
  if (i < f) return a >= i && a < f;
  return a >= i || a < f; // cruza medianoche
}

function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
