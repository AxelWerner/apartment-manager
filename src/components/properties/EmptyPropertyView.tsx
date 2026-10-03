import { useState } from 'react';
import { Building2, Plus, Sparkles, CheckCircle2 } from 'lucide-react';
import { CreatePropertyModal } from './CreatePropertyModal';

export function EmptyPropertyView() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="text-center mb-8">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 items-center justify-center text-white shadow-xl shadow-rose-500/25 mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Comienza añadiendo tu primer apartamento
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Para ver el panel de control, sincronizar tus reservas de Airbnb y gestionar finanzas, agrega tu primera propiedad.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-left text-xs space-y-2.5 text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span>¿Qué podrás hacer una vez añadido?</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Importar reservas desde CSV de Airbnb en segundos</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Controlar gastos fijos, servicios públicos y aseo</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Invitar a socios, administradores o personal de limpieza</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir mi primer Apartamento</span>
          </button>
        </div>
      </div>

      <CreatePropertyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
