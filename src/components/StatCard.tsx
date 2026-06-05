export function StatCard({
  titulo,
  valor,
  subtexto,
  acento,
}: {
  titulo: string;
  valor: string | number;
  subtexto?: string;
  acento?: 'azul' | 'verde' | 'amarillo' | 'rojo' | 'gris';
}) {
  const acentos = {
    azul: 'border-l-diamond-500',
    verde: 'border-l-emerald-500',
    amarillo: 'border-l-yellow-500',
    rojo: 'border-l-red-500',
    gris: 'border-l-slate-400',
  };
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${acentos[acento ?? 'azul']}`}>
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-2 text-3xl font-bold text-diamond-900">{valor}</p>
      {subtexto && <p className="mt-1 text-xs text-slate-500">{subtexto}</p>}
    </div>
  );
}
