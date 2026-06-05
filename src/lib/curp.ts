/**
 * Validacion de CURP mexicana.
 *
 * Estructura oficial (18 caracteres):
 *   AAAA######HCCXXX##
 *   AAAA   = 4 letras de nombre/apellidos
 *   ######  = AAMMDD (fecha nacimiento)
 *   H      = H o M (sexo)
 *   CC     = clave de entidad federativa (lista cerrada)
 *   XXX    = 3 consonantes internas
 *   #      = caracter de homonimia (0-9 o A-Z)
 *   #      = digito verificador
 */

const ENTIDADES = new Set([
  'AS','BC','BS','CC','CL','CM','CS','CH','DF','DG','GT','GR','HG','JC',
  'MC','MN','MS','NT','NL','OC','PL','QT','QR','SP','SL','SR','TC','TS',
  'TL','VZ','YN','ZS','NE', // NE = Nacido en el extranjero
]);

const CURP_REGEX =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM][A-Z]{2}[BCDFGHJKLMNPQRSTVWXYZ]{3}[A-Z\d]\d$/;

export interface CurpValidationResult {
  valido: boolean;
  curp?: string;
  error?: string;
}

export function validarCurp(rawInput: string): CurpValidationResult {
  if (!rawInput) return { valido: false, error: 'CURP requerida' };

  const curp = rawInput.trim().toUpperCase();

  if (curp.length !== 18) {
    return { valido: false, error: 'La CURP debe tener exactamente 18 caracteres' };
  }
  if (!CURP_REGEX.test(curp)) {
    return { valido: false, error: 'Formato de CURP invalido' };
  }
  if (!ENTIDADES.has(curp.substring(11, 13))) {
    return { valido: false, error: 'Clave de entidad federativa invalida' };
  }

  // Digito verificador
  const tabla = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ';
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const idx = tabla.indexOf(curp[i]);
    if (idx === -1) return { valido: false, error: 'Caracter invalido en CURP' };
    suma += idx * (18 - i);
  }
  const digitoCalculado = (10 - (suma % 10)) % 10;
  if (digitoCalculado !== parseInt(curp[17], 10)) {
    return { valido: false, error: 'Digito verificador de CURP incorrecto' };
  }

  return { valido: true, curp };
}
