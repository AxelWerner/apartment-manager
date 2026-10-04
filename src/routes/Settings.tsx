import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Save,
  Download,
  Users,
} from 'lucide-react';
import { useActiveProperty } from '@/context/PropertyContext';
import { useBookings } from '@/hooks/use-bookings';
import { useExpenses } from '@/hooks/use-expenses';
import { useDamages } from '@/hooks/use-damages';
import { usePropertyMembers } from '@/hooks/use-team';
import { CurrencyInput } from '@/components/ui/currency-input';
import { TeamManagementTab } from '@/components/team/TeamManagementTab';
import type { Property, Booking, Expense, Damage, UserRole } from '@/types/database';
import { toast } from 'sonner';

export default function Settings() {
  const { activeProperty, updateProperty, activePropertyId, role, isOwner } = useActiveProperty();
  const { data: bookings = [] } = useBookings(activePropertyId);
  const { data: expenses = [] } = useExpenses(activePropertyId);
  const { data: damages = [] } = useDamages(activePropertyId);
  const { data: members = [] } = usePropertyMembers(activePropertyId);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'team' || rawTab === 'members' || rawTab === 'usuarios' ? 'team' : 'property';

  const handleTabChange = (tab: 'property' | 'team') => {
    setSearchParams(tab === 'team' ? { tab: 'team' } : {});
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => handleTabChange('property')}
          className={`flex items-center gap-2.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'property'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Inmueble y Tarifas</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('team')}
          className={`flex items-center gap-2.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'team'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Equipo y Usuarios</span>
          {members.length > 0 && (
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                activeTab === 'team'
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {members.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Property Profile & Backup */}
      {activeTab === 'property' && (
        <SettingsContent
          key={activeProperty?.id || 'empty'}
          activeProperty={activeProperty}
          updateProperty={updateProperty}
          bookings={bookings}
          expenses={expenses}
          damages={damages}
        />
      )}

      {/* Tab 2: Team Members & Invitations */}
      {activeTab === 'team' && (
        <TeamManagementTab
          key={`team-${activePropertyId}`}
          propertyId={activePropertyId}
          propertyName={activeProperty?.name || ''}
          currentUserRole={role as UserRole}
          isCurrentUserOwner={isOwner}
        />
      )}
    </div>
  );
}

interface SettingsContentProps {
  activeProperty: Property | null;
  updateProperty: (updates: Partial<Property>) => Promise<Property>;
  bookings: Booking[];
  expenses: Expense[];
  damages: Damage[];
}

function SettingsContent({
  activeProperty,
  updateProperty,
  bookings,
  expenses,
  damages,
}: SettingsContentProps) {
  const [name, setName] = useState(activeProperty?.name || '');
  const [address, setAddress] = useState(activeProperty?.address || '');
  const [city, setCity] = useState(activeProperty?.city || 'Medellín');
  const [nightRate, setNightRate] = useState<number>(activeProperty?.default_nightly_rate || 250000);
  const [cleanFee, setCleanFee] = useState<number>(activeProperty?.default_cleaning_fee || 80000);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(activeProperty?.monthly_revenue_target || 3000000);
  const [managementFeeRate, setManagementFeeRate] = useState<number>(activeProperty?.management_fee_rate ?? 20.0);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProperty({
        name,
        address,
        city,
        default_nightly_rate: nightRate,
        default_cleaning_fee: cleanFee,
        monthly_revenue_target: monthlyTarget,
        management_fee_rate: managementFeeRate,
      });
      toast.success('Configuración del apartamento guardada');
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleExportData = () => {
    const backup = {
      property: activeProperty,
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
    <div className="space-y-6">
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
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer"
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
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Descargar JSON de Respaldo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
