const COLORS: Record<string, string> = {
  // pedidos
  PENDIENTE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  EN_PROCESO: 'bg-blue-100 text-blue-800 border-blue-300',
  LISTO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  RECHAZADO: 'bg-red-100 text-red-800 border-red-300',
  CANCELADO: 'bg-slate-100 text-slate-700 border-slate-300',
  // recargas
  APROBADA: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  RECHAZADA: 'bg-red-100 text-red-800 border-red-300',
  // usuarios
  APROBADO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  SUSPENDIDO: 'bg-orange-100 text-orange-800 border-orange-300',
  ELIMINADO: 'bg-slate-200 text-slate-700 border-slate-300',
};

export function EstadoBadge({ value }: { value: string }) {
  const cls = COLORS[value] ?? 'bg-slate-100 text-slate-700 border-slate-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {value.replace('_', ' ')}
    </span>
  );
}
