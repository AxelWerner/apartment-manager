import { formatDate, formatCOP, getBookingSourceInfo, isBookingReal } from '@/lib/formatters';
import type { MonthBookingDetail } from '@/lib/analytics-utils';
import { Clock, User } from 'lucide-react';

interface MonthBookingsListProps {
  bookings: MonthBookingDetail[];
  monthLabel: string;
}

export function MonthBookingsList({ bookings, monthLabel }: MonthBookingsListProps) {
  if (bookings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No hay reservas para {monthLabel}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Las métricas se calculan automáticamente cuando se registran o importan reservas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
            Detalle de Reservas del Mes ({monthLabel})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {bookings.length} {bookings.length === 1 ? 'reserva activa' : 'reservas activas'} que aportan noches e ingresos a este período
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3.5 text-left">Huésped</th>
              <th className="px-3 py-3.5 text-left">Estadía</th>
              <th className="px-3 py-3.5 text-left">Noches en el Mes</th>
              <th className="px-3 py-3.5 text-left">Tarifa / Noche</th>
              <th className="px-3 py-3.5 text-left">Aporte Alojamiento</th>
              <th className="px-3 py-3.5 text-left">Fecha Reserva</th>
              <th className="px-3 py-3.5 text-left">Lead Time</th>
              <th className="px-4 py-3.5 text-left">Canal</th>
              <th className="px-4 py-3.5 text-left">Horizonte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {bookings.map((item) => {
              const b = item.booking;
              const sourceInfo = getBookingSourceInfo(b.source);
              const isReal = isBookingReal(b);

              return (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {b.guest_name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {b.airbnb_confirmation_code || 'Reserva Directa'}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(b.check_in)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        hasta {formatDate(b.check_out)}
                      </p>
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {item.nightsInMonth}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        de {item.totalReservationNights}n totales
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                    {formatCOP(item.effectiveNightlyRate)}
                  </td>

                  <td className="py-3.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCOP(item.accommodationRevenueInMonth)}
                  </td>

                  <td className="py-3.5 px-3 text-slate-500">
                    {b.booking_date ? formatDate(b.booking_date) : '—'}
                  </td>

                  <td className="py-3.5 px-3">
                    {item.leadTimeDays !== null ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.leadTimeDays <= 3
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            : item.leadTimeDays <= 14
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {item.leadTimeDays} {item.leadTimeDays === 1 ? 'día' : 'días'}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No disponible</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${sourceInfo.badgeClass}`}>
                      {sourceInfo.shortLabel}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        isReal
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40'
                          : 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/40'
                      }`}
                    >
                      {isReal ? 'Real' : 'Futura'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
