'use client';

export type ToastTipo = 'success' | 'error' | 'info';
export interface ToastData {
  tipo: ToastTipo;
  mensaje: string;
}

export function Toast({ data, onClose }: { data: ToastData | null; onClose: () => void }) {
  if (!data) return null;
  const colores = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-diamond-700',
  };
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg ${colores[data.tipo]}`}>
        <span className="text-sm">{data.mensaje}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
      </div>
    </div>
  );
}
