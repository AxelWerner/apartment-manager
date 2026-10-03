import { useState } from 'react';
import {
  Home,
  Users,
  Info,
  ChevronDown,
  ChevronUp,
  Building2,
  Wifi,
  Zap,
  Droplets,
  Flame,
  ShieldCheck,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { formatCOP, formatMonthYear } from '@/lib/formatters';
import type { DailyCostsCalculation, CostItemBreakdown } from '@/lib/daily-costs';

interface DailyCostCardsProps {
  calculation: DailyCostsCalculation;
}

function getItemIcon(key: string) {
  switch (key) {
    case 'hoa_administration':
      return Building2;
    case 'internet_cable':
      return Wifi;
    case 'insurance_annual':
      return ShieldCheck;
    case 'electricity':
      return Zap;
    case 'water':
      return Droplets;
    case 'gas':
      return Flame;
    default:
      return Sparkles;
  }
}

export function DailyCostCards({ calculation }: DailyCostCardsProps) {
  const [showDetails, setShowDetails] = useState(false);

  const {
    monthStr,
    daysInMonth,
    emptyDailyCost,
    emptyTotalMonthly,
    occupiedDailyCost,
    occupiedTotalMonthly,
    dailySavings,
    monthlySavings,
    items,
  } = calculation;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Costo Diario del Apartamento ({formatMonthYear(monthStr)})
          </h3>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {daysInMonth} días en el mes
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 w-fit transition-colors cursor-pointer"
        >
          <span>{showDetails ? 'Ocultar desglose' : 'Ver desglose de conceptos'}</span>
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Valor de Apto Vacío */}
        <div
          data-testid="empty-apt-card"
          className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/60 dark:from-slate-900 dark:to-slate-900/60 p-5 shadow-xs transition-all hover:shadow-md"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-sky-400" />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  Costo de Mantenimiento Mínimo
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Valor de Apto Vacío
                </h4>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Sin Huéspedes
            </span>
          </div>

          {/* Big Number */}
          <div className="my-3 p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Costo diario en vacío ({daysInMonth} días):
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">
                {formatCOP(emptyDailyCost)}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                COP / día
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 mt-2 border-t border-slate-100 dark:border-slate-700/60">
              <span>Total mensual base:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {formatCOP(emptyTotalMonthly)} COP
              </span>
            </div>
          </div>

          {/* Quick Concept List */}
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-1">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Conceptos incluidos en vacío:</span>
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pl-4">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Administración</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Internet / Wi-Fi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Seguro Anual (cuota)</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-indigo-700 dark:text-indigo-300">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Luz fija: $ 70.000 COP</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pl-4 pt-0.5">
              * Agua y gas en $0 COP (sin consumo de huéspedes).
            </p>
          </div>
        </div>

        {/* Card 2: Valor de Apto con Gente */}
        <div
          data-testid="occupied-apt-card"
          className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/60 dark:from-slate-900 dark:to-slate-900/60 p-5 shadow-xs transition-all hover:shadow-md"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/50">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                  Costo Operativo con Huéspedes
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Valor de Apto con Gente
                </h4>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              Con Ocupación
            </span>
          </div>

          {/* Big Number */}
          <div className="my-3 p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Costo diario con gente ({daysInMonth} días):
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
                {formatCOP(occupiedDailyCost)}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                COP / día
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 mt-2 border-t border-slate-100 dark:border-slate-700/60">
              <span>Total mensual base:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {formatCOP(occupiedTotalMonthly)} COP
              </span>
            </div>
          </div>

          {/* Quick Concept List */}
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-1">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Conceptos incluidos con gente:</span>
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pl-4">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Administración</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Internet / Wi-Fi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Energía / Luz (EPM)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Agua / Acueducto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Gas Natural</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Seguro Anual (cuota)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Callout / Savings Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-emerald-900 dark:text-emerald-200">
              Diferencia de costo: {formatCOP(dailySavings)} COP menos al día en vacío
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Ahorras {formatCOP(monthlySavings)} COP/mes por menor consumo eléctrico y cero gasto de acueducto y gas natural.
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown Accordion Table */}
      {showDetails && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 transition-all animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Comparativa Detallada de Costos Mensuales y Diarios
            </h4>
            <span className="text-[11px] text-slate-400">
              Valores calculados para {formatMonthYear(monthStr)} ({daysInMonth} días)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Concepto / Servicio</th>
                  <th className="py-2.5 px-3 text-right">Valor Apto Vacío (Mes)</th>
                  <th className="py-2.5 px-3 text-right">Valor Apto Vacío (Día)</th>
                  <th className="py-2.5 px-3 text-right">Valor Con Gente (Mes)</th>
                  <th className="py-2.5 px-3 text-right">Valor Con Gente (Día)</th>
                  <th className="py-2.5 px-3 text-center">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {items.map((item: CostItemBreakdown) => {
                  const Icon = getItemIcon(item.key);
                  const emptyDaily = Math.round(item.emptyAmount / daysInMonth);
                  const occupiedDaily = Math.round(item.occupiedAmount / daysInMonth);

                  return (
                    <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="font-semibold">{item.label}</p>
                            {item.note && (
                              <p className="text-[10px] text-slate-400">{item.note}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatCOP(item.emptyAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400 font-semibold">
                        {formatCOP(emptyDaily)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatCOP(item.occupiedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold">
                        {formatCOP(occupiedDaily)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.isRegistered ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-full">
                            Registrado
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-full">
                            Estimado base
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 font-bold">
                <tr>
                  <td className="py-2.5 px-3 text-slate-900 dark:text-white">
                    Total Mensual y Diario
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                    {formatCOP(emptyTotalMonthly)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400 text-sm">
                    {formatCOP(emptyDailyCost)} / día
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                    {formatCOP(occupiedTotalMonthly)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 text-sm">
                    {formatCOP(occupiedDailyCost)} / día
                  </td>
                  <td className="py-2.5 px-3 text-center text-[10px] text-slate-400">
                    ÷ {daysInMonth} días
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
