import { useState } from 'react';
import {
  Building2,
  Save,
  Download,
} from 'lucide-react';
import { useProperty, useUpdateProperty } from '@/hooks/use-property';
import { useBookings } from '@/hooks/use-bookings';
import { useExpenses } from '@/hooks/use-expenses';
import { useDamages } from '@/hooks/use-damages';
import { CurrencyInput } from '@/components/ui/currency-input';
import { toast } from 'sonner';

export default function Settings() {
  const { data: property } = useProperty();
  const updatePropertyMutation = useUpdateProperty();
  const { data: bookings = [] } = useBookings();
  const { data: expenses = [] } = useExpenses();
  const { data: damages = [] } = useDamages();

  const [name, setName] = useState(property?.name || 'Apto 502 - El Poblado');
  const [address, setAddress] = useState(property?.address || 'Carrera 43A # 1-50, Medellín');
  const [city, setCity] = useState(property?.city || 'Medellín');
  const [nightRate, setNightRate] = useState<number>(property?.default_nightly_rate || 280000);
  const [cleanFee, setCleanFee] = useState<number>(property?.default_cleaning_fee || 60000);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(property?.monthly_revenue_target || 3000000);
  const [managementFeeRate, setManagementFeeRate] = useState<number>(property?.management_fee_rate ?? 20.0);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = {
        ...property,
        name,
        address,
        city,
        default_nightly_rate: nightRate,
        default_cleaning_fee: cleanFee,
        monthly_revenue_target: monthlyTarget,
        management_fee_rate: managementFeeRate,
      };
      localStorage.setItem('apt_mgr_property', JSON.stringify(updated));
      await updatePropertyMutation.mutateAsync(updated);
      toast.success('Configuración del apartamento guardada');
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleExportData = () => {
    const backup = {
      property,
      bookings,
      expenses,
      damages,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-apto-manager-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Copia de seguridad descargada');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Configuración del Apartamento
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Datos de la propiedad, tarifas predeterminadas en COP y exportación de respaldos
        </p>
      </div>

      {/* Property Profile Form */}
      <form
        onSubmit={handleSaveProfile}
        className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Perfil del Inmueble
            </h2>
            <p className="text-xs text-slate-400">Parámetros base para reservas y reportes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nombre o Identificador *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ciudad / Ubicación
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Dirección Completa
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {/* Default Rates */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Tarifas Base Predeterminadas (COP)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tarifa Noche Base ($ COP)
              </label>
              <CurrencyInput
                value={nightRate}
                onChange={setNightRate}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tarifa de Limpieza Base ($ COP)
              </label>
              <CurrencyInput
                value={cleanFee}
                onChange={setCleanFee}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Comisión Empresa Administradora (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={managementFeeRate}
                  onChange={(e) => setManagementFeeRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  %
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Porcentaje deducido al valor de cada reserva para calcular los ingresos netos del propietario y la tarifa por noche (20% por defecto).
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Meta Mensual de Ingresos por Reservas ($ COP)
              </label>
              <CurrencyInput
                value={monthlyTarget}
                onChange={setMonthlyTarget}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-rose-600 dark:text-rose-400"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Meta mensual para monitorear en el Dashboard (Meta Anual automática: 12 meses × este valor).
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Configuración</span>
          </button>
        </div>
      </form>

      {/* Data Export Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Copia de Seguridad y Exportación
            </h2>
            <p className="text-xs text-slate-400">
              Descarga un archivo con todas tus reservas, gastos, facturas y reportes de daños
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            Total registros: <strong>{bookings.length}</strong> reservas,{' '}
            <strong>{expenses.length}</strong> gastos, <strong>{damages.length}</strong> daños.
          </div>
          <button
            type="button"
            onClick={handleExportData}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Descargar JSON de Respaldo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
