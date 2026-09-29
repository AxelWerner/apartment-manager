import { DollarSign, Percent, TrendingUp, Moon, Clock, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatCOP } from '@/lib/formatters';
import type { MonthAnalytics, MomComparison } from '@/lib/analytics-utils';

interface AnalyticsKpiCardsProps {
  stats: MonthAnalytics;
  mom: MomComparison | null;
}

export function AnalyticsKpiCards({ stats, mom }: AnalyticsKpiCardsProps) {
  // Delta badge helper
  const renderTrendBadge = (
    delta: number | null | undefined,
    deltaPercent: number | null | undefined,
    suffix = '%',
    invertGoodBad = false
  ) => {
    if (delta === null || delta === undefined || isNaN(delta) || !mom) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
          <Minus className="w-3 h-3" /> Sin datos previos
        </span>
      );
    }

    if (Math.abs(delta) < 0.01) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
          <Minus className="w-3 h-3" /> Sin variación
        </span>
      );
    }

    const isPositive = delta > 0;
    const isGood = invertGoodBad ? !isPositive : isPositive;

    const hasValidPercent = deltaPercent !== undefined && deltaPercent !== null && !isNaN(deltaPercent);
    const displayVal = hasValidPercent
      ? `${isPositive ? '+' : ''}${deltaPercent.toFixed(1)}${suffix}`
      : `${isPositive ? '+' : ''}${delta.toFixed(1)}${suffix}`;

    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${
          isGood
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
        }`}
      >
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {displayVal} vs mes anterior
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. ADR (Average Daily Rate) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ADR
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
            Precio Promedio / Noche
          </p>

          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {stats.adr > 0 ? formatCOP(stats.adr) : '$ 0'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Por noche ocupada
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          {renderTrendBadge(mom?.adrDelta, mom?.adrDeltaPercent, '%')}
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
            <span>Airbnb: <strong className="font-semibold text-slate-700 dark:text-slate-300">{stats.airbnbAdr > 0 ? formatCOP(stats.airbnbAdr) : '—'}</strong></span>
            {stats.directNights > 0 && (
              <span>Directa: <strong className="font-semibold text-slate-700 dark:text-slate-300">{formatCOP(stats.directAdr)}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Ocupación (%) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ocupación
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
            Porcentaje de Noches
          </p>

          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {stats.occupancyRate.toFixed(1)}%
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {stats.occupiedNights} de {stats.daysInMonth} noches ocupadas
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.occupancyRate >= 70
                  ? 'bg-emerald-500'
                  : stats.occupancyRate >= 45
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, stats.occupancyRate))}%` }}
            />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          {renderTrendBadge(mom?.occupancyDelta, undefined, ' pp')}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {stats.vacantNights} noches libres en el mes
          </p>
        </div>
      </div>

      {/* 3. RevPAR (Indicador de Rentabilidad) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              RevPAR
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
            Rentabilidad Noche Disp.
          </p>

          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.revPar > 0 ? formatCOP(stats.revPar) : '$ 0'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5" title="Ingreso total por noches dividido por los días del mes">
              Total noches / {stats.daysInMonth} días del mes
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          {renderTrendBadge(mom?.revParDelta, mom?.revParDeltaPercent, '%')}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Alojamiento: <strong className="font-semibold text-slate-700 dark:text-slate-300">{formatCOP(stats.totalAccommodationRevenue)}</strong>
          </p>
        </div>
      </div>

      {/* 4. LOS: Length of Stay */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              LOS
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
            Duración de Estadía
          </p>

          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {stats.averageLos > 0 ? `${stats.averageLos} noches` : '0'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Promedio por huésped
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          {renderTrendBadge(mom?.losDelta, undefined, ' noches')}
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{stats.totalBookings} {stats.totalBookings === 1 ? 'reserva' : 'reservas'}</span>
            {stats.totalBookings > 0 && (
              <span>{stats.minLos}n a {stats.maxLos}n</span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Lead Time (Ventana de Reserva) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Lead Time
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
            Ventana de Reserva
          </p>

          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {stats.averageLeadTime !== null ? `${stats.averageLeadTime} días` : '—'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Anticipación de compra
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          {renderTrendBadge(mom?.leadTimeDelta, undefined, ' días')}
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            {stats.bookingsWithLeadTimeCount > 0 ? (
              <>
                <span>{stats.bookingsWithLeadTimeCount} registradas</span>
                <span>{stats.minLeadTime}d a {stats.maxLeadTime}d</span>
              </>
            ) : (
              <span className="text-slate-400 italic">Sin fecha de reserva</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
