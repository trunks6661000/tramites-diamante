'use client';

import { useMemo } from 'react';
import { validarCurp } from '@/lib/curp';

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function CurpInput({ value, onChange, disabled }: Props) {
  const upper = value.toUpperCase();
  const validacion = useMemo(() => {
    if (upper.length === 0) return null;
    return validarCurp(upper);
  }, [upper]);
  const ok = validacion?.valido === true;
  const error = validacion?.valido === false ? validacion.error : null;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">CURP *</label>
      <input
        type="text"
        value={upper}
        onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 18))}
        disabled={disabled}
        placeholder="XAXX010101HDFXXX01"
        maxLength={18}
        className={`mt-1 w-full rounded border px-3 py-2 font-mono uppercase tracking-wider focus:outline-none focus:ring-2 ${
          ok
            ? 'border-emerald-400 focus:ring-emerald-200'
            : error
            ? 'border-red-400 focus:ring-red-200'
            : 'border-slate-300 focus:ring-diamond-300'
        }`}
        autoComplete="off"
      />
      <div className="mt-1 flex items-center justify-between">
        <p className={`text-xs ${ok ? 'text-emerald-700' : error ? 'text-red-700' : 'text-slate-500'}`}>
          {ok ? 'CURP valida' : error ?? 'Escribe la CURP de 18 caracteres'}
        </p>
        <p className="text-xs text-slate-500">{upper.length}/18</p>
      </div>
    </div>
  );
}
