import dayjs from 'dayjs';
import 'dayjs/locale/es-mx';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('es-mx');

export function fmtFecha(d: Date | string) {
  return dayjs(d).format('DD/MM/YYYY HH:mm');
}
export function fmtRelativo(d: Date | string) {
  return dayjs(d).fromNow();
}
export function fmtCreditos(n: number) {
  return new Intl.NumberFormat('es-MX').format(n);
}
export function fmtTipoActa(t: string) {
  return ({ NACIMIENTO: 'Nacimiento', MATRIMONIO: 'Matrimonio', DEFUNCION: 'Defuncion' } as Record<string, string>)[t] ?? t;
}
