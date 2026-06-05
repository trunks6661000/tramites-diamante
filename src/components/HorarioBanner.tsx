'use client';

import { useEffect, useState } from 'react';

interface Estado {
  abierto: boolean;
  ahora: string;
  inicio: string;
  fin: string;
  zona: string;
  mensajeCerrado: string;
}

export function HorarioBanner() {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      try {
        const res = await fetch('/api/horario');
        if (!res.ok) return;
        const data = (await res.json()) as Estado;
        if (!cancelado) setEstado(data);
      } catch {
        /* silencioso */
      }
    };
    cargar();
    const iv = setInterval(cargar, 60 * 1000);
    return () => {
      cancelado = true;
      clearInterval(iv);
    };
  }, []);

  if (!estado) return null;
  if (estado.abierto) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Servicio abierto - Horario {estado.inicio} a {estado.fin} ({estado.zona})
      </div>
    );
  }
  return (
    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <strong>Servicio cerrado.</strong> {estado.mensajeCerrado} (Horario {estado.inicio}-{estado.fin})
    </div>
  );
}
