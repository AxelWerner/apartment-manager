import { formatCOP } from '@/lib/formatters';
import type { MonthAnalytics } from '@/lib/analytics-utils';
import { ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

interface MonthlyComparisonTableProps {
  data: MonthAnalytics[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

type SortColumn = 'month' | 'bookings' | 'occupancy' | 'adr' | 'revPar' | 'revenue' | 'los' | 'leadTime';

export function MonthlyComparisonTable({
  data,
  selectedMonth,
  onSelectMonth,
}: MonthlyComparisonTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn>('month');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(col === 'month' ? false : false);
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let diff = 0;
    if (sortCol === 'month') diff = a.monthKey.localeCompare(b.monthKey);
    else if (sortCol === 'bookings') diff = a.totalBookings - b.totalBookings;
    else if (sortCol === 'occupancy') diff = a.occupancyRate - b.occupancyRate;
    else if (sortCol === 'adr') diff = a.adr - b.adr;
    else if (sortCol === 'revPar') diff = a.revPar - b.revPar;
    else if (sortCol === 'revenue') diff = a.totalAccommodationRevenue - b.totalAccommodationRevenue;
    else if (sortCol === 'los') diff = a.averageLos - b.averageLos;
    else if (sortCol === 'leadTime') diff = (a.averageLeadTime || 0) - (b.averageLeadTime || 0);

    return sortAsc ? diff : -diff;
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
            Tabla Comparativa Mes a Mes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resumen histórico y proyectado de todos los indicadores clave. Haz clic en un mes para seleccionarlo.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200/70 dark:border-slate-800">
              <th className="py-3 px-4 cursor-pointer hover:text-slate-900" onClick={() => handleSort('month')}>
                <div className="flex items-center gap-1">
                  <span>Mes</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('bookings')}>
                <div className="flex items-center gap-1">
                  <span>Reservas</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('occupancy')}>
                <div className="flex items-center gap-1">
                  <span>Ocupación (%)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('adr')}>
                <div className="flex items-center gap-1">
                  <span>ADR (Precio Prom.)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('revPar')}>
                <div className="flex items-center gap-1">
                  <span>RevPAR (Rentabilidad)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('revenue')}>
                <div className="flex items-center gap-1">
                  <span>Ingreso Alojamiento</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('los')}>
                <div className="flex items-center gap-1">
                  <span>LOS Prom.</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-slate-900" onClick={() => handleSort('leadTime')}>
                <div className="flex items-center gap-1">
                  <span>Lead Time</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {sortedData.map((row) => {
              const isSelected = row.monthKey === selectedMonth;
              return (
                <tr
                  key={row.monthKey}
                  onClick={() => onSelectMonth(row.monthKey)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 text-slate-900 dark:text-slate-100 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                      <span>{row.monthLabel}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">{row.totalBookings}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span>{row.occupancyRate.toFixed(1)}%</span>
                      <span className="text-[10px] text-slate-400">
                        ({row.occupiedNights}/{row.daysInMonth}n)
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                    {row.adr > 0 ? formatCOP(row.adr) : '—'}
                  </td>
                  <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                    {row.revPar > 0 ? formatCOP(row.revPar) : '—'}
                  </td>
                  <td className="py-3 px-3">
                    {row.totalAccommodationRevenue > 0 ? formatCOP(row.totalAccommodationRevenue) : '—'}
                  </td>
                  <td className="py-3 px-3">
                    {row.averageLos > 0 ? `${row.averageLos} noches` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {row.averageLeadTime !== null ? `${row.averageLeadTime} días` : '—'}
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
