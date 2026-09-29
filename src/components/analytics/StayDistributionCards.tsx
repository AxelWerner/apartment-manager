import { Moon, Clock } from 'lucide-react';
import type { MonthAnalytics } from '@/lib/analytics-utils';

interface StayDistributionCardsProps {
  stats: MonthAnalytics;
}

export function StayDistributionCards({ stats }: StayDistributionCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Length of Stay Distribution */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Distribución de Duración (LOS)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Promedio: {stats.averageLos} noches por huésped
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            {stats.totalBookings} reservas
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {stats.losBuckets.map((bucket) => {
            return (
              <div key={bucket.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {bucket.label}
                    </span>
                    <span className="text-[11px] text-slate-400">({bucket.description})</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {bucket.count} ({bucket.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-violet-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${bucket.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Lead Time Distribution */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Ventana de Reserva (Lead Time)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.averageLeadTime !== null
                  ? `Promedio: ${stats.averageLeadTime} días de anticipación`
                  : 'Sin datos de fecha de reserva'}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            {stats.bookingsWithLeadTimeCount} analizadas
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {stats.leadTimeBuckets.map((bucket) => {
            return (
              <div key={bucket.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {bucket.label}
                    </span>
                    <span className="text-[11px] text-slate-400">({bucket.description})</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {bucket.count} ({bucket.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${bucket.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
