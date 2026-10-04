import React, { useState } from 'react';
import { Building2, X, Plus, Loader2, Info, Crown, Briefcase } from 'lucide-react';
import { useActiveProperty } from '@/context/PropertyContext';

interface CreatePropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePropertyModal({ isOpen, onClose }: CreatePropertyModalProps) {
  const { createProperty } = useActiveProperty();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Medellín');
  const [isOwner, setIsOwner] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del apartamento es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createProperty({
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || 'Medellín',
        currency: 'COP',
        default_nightly_rate: 250000,
        default_cleaning_fee: 80000,
        monthly_revenue_target: 3000000,
        creatorRole: isOwner ? 'PRIMARY_OWNER' : 'ADMINISTRATOR',
      });
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Error al crear el apartamento.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nuevo Apartamento
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registra la propiedad para comenzar a gestionarla
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nombre del Apartamento *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Apto 502 - Edificio Manila"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Ciudad
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Medellín"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Dirección (Opcional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej. Calle 10 # 43D - 25, El Poblado"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-colors"
            />
          </div>

          {/* Titularidad / Dueño */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              ¿Cuál es tu rol en esta propiedad?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsOwner(true)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  isOwner
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${isOwner ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Soy el Dueño</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Propietario del inmueble con control total
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsOwner(false)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  !isOwner
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${!isOwner ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Soy Gestor / Co-host</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Administro el apto en nombre del dueño
                  </div>
                </div>
              </button>
            </div>
            {!isOwner && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-snug">
                ℹ️ Tendrás permisos de Administrador y podrás invitar al dueño real desde la pestaña de Equipo.
              </p>
            )}
          </div>

          {/* Info notice about rates */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2.5 text-slate-500 dark:text-slate-400 text-xs">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Tarifas por noche, costo de aseo y comisión se configuran en los Ajustes del apartamento.
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Crear Apartamento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
