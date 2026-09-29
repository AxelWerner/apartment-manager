import { ChevronLeft, ChevronRight, Calendar, Filter, Sparkles } from 'lucide-react';
import { formatMonthYear, getColombiaDateTime } from '@/lib/formatters';

interface MonthNavigatorProps {
  selectedMonth: string; // 'YYYY-MM'
  onSelectMonth: (month: string) => void;
  availableMonths: string[];
  channelFilter: 'all' | 'airbnb' | 'direct';
  onChannelFilterChange: (channel: 'all' | 'airbnb' | 'direct') => void;
  horizonFilter: 'all' | 'real' | 'future';
  onHorizonFilterChange: (horizon: 'all' | 'real' | 'future') => void;
}

export function MonthNavigator({
  selectedMonth,
  onSelectMonth,
  availableMonths,
  channelFilter,
  onChannelFilterChange,
  horizonFilter,
  onHorizonFilterChange,
}: MonthNavigatorProps) {
  const { dateStr } = getColombiaDateTime();
  const currentMonthKey = dateStr.substring(0, 7);

  // Month navigation helpers
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const prevMonthDate = new Date(year, month - 2, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const nextMonthDate = new Date(year, month, 1);
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Temporal status of the selected month
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const isFutureMonth = selectedMonth > currentMonthKey;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Month Selector & Arrows */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onSelectMonth(prevMonthKey)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-xs hover:shadow"
              title="Mes anterior"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-500" />
              <select
                aria-label="Seleccionar mes de análisis"
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="bg-transparent font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {formatMonthYear(m)} {m === currentMonthKey ? '· (Actual)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => onSelectMonth(nextMonthKey)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-xs hover:shadow"
              title="Mes siguiente"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Temporal Status Badge */}
          {isCurrentMonth ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Mes en Curso
            </span>
          ) : isFutureMonth ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40">
              <Sparkles className="w-3.5 h-3.5" />
              Proyectado
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Histórico
            </span>
          )}

          {/* Quick jump to current month */}
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => onSelectMonth(currentMonthKey)}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Ir a Mes Actual
            </button>
          )}
        </div>

        {/* Right: Filters (Channel and Horizon) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Horizon Filter (Real vs Futuro) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => onHorizonFilterChange('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                horizonFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => onHorizonFilterChange('real')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                horizonFilter === 'real'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Reales
            </button>
            <button
              type="button"
              onClick={() => onHorizonFilterChange('future')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                horizonFilter === 'future'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Futuras
            </button>
          </div>

          {/* Channel Filter (Airbnb vs Directas) */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Filtrar por canal de reserva"
              value={channelFilter}
              onChange={(e) => onChannelFilterChange(e.target.value as 'all' | 'airbnb' | 'direct')}
              className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium px-2.5 py-1 rounded-xl border-none focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todos los Canales</option>
              <option value="airbnb">Solo Airbnb</option>
              <option value="direct">Solo Directas</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
