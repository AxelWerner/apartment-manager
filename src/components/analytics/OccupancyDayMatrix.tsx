import { formatCOP } from '@/lib/formatters';
import type { DailyOccupancyStatus } from '@/lib/analytics-utils';

interface OccupancyDayMatrixProps {
  days: DailyOccupancyStatus[];
  monthLabel: string;
}

export function OccupancyDayMatrix({ days, monthLabel }: OccupancyDayMatrixProps) {
  const occupiedCount = days.filter((d) => d.isOccupied).length;
  const vacantCount = days.length - occupiedCount;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
            Calendario Diario de Ocupación ({monthLabel})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Seguimiento noche a noche: identifica huecos disponibles y noches vendidas
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500 shadow-xs" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Ocupado ({occupiedCount}n)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Disponible ({vacantCount}n)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-500 dark:text-slate-400">Fin de Semana</span>
          </div>
        </div>
      </div>

      {/* Grid of days */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 mt-5">
        {days.map((day) => {
          return (
            <div
              key={day.dayNumber}
              className={`rounded-xl p-3 border transition-all flex flex-col justify-between min-h-[92px] ${
                day.isOccupied
                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 shadow-xs'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {day.dayNumber}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {day.dayOfWeek}
                  </span>
                </div>
                {day.isWeekend && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Fin de semana (Vie/Sáb)" />
                )}
              </div>

              {/* Status and Rate */}
              <div className="mt-2">
                {day.isOccupied ? (
                  <div>
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 truncate" title={day.guestName}>
                      {day.guestName || 'Huésped'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                      {day.nightlyRate ? formatCOP(day.nightlyRate) : 'Ocupada'}
                    </p>
                    {day.source && (
                      <span className="inline-block text-[9px] uppercase font-bold text-rose-500 tracking-wider mt-0.5">
                        {day.source === 'airbnb' ? 'Airbnb' : 'Directa'}
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="inline-block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Libre
                    </span>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                      Sin reserva
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
