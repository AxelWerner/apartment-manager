import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { formatCOP } from '@/lib/formatters';
import type { MonthAnalytics } from '@/lib/analytics-utils';

interface MultiMonthChartProps {
  data: MonthAnalytics[];
  selectedMonth: string;
  onSelectMonth?: (month: string) => void;
}

export function MultiMonthChart({ data, selectedMonth, onSelectMonth }: MultiMonthChartProps) {
  // Format chart data
  const chartData = data.map((item) => {
    return {
      monthKey: item.monthKey,
      label: item.monthLabel.split(' ')[0], // e.g. "Septiembre"
      fullLabel: item.monthLabel,
      adr: item.adr,
      revPar: item.revPar,
      occupancy: parseFloat(item.occupancyRate.toFixed(1)),
      occupiedNights: item.occupiedNights,
      totalNights: item.daysInMonth,
      isSelected: item.monthKey === selectedMonth,
    };
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
            Evolución Multimes: ADR, RevPAR y Ocupación
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comparativa de rentabilidad diaria y porcentaje de noches vendidas a lo largo del tiempo
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-500" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">ADR (Precio Promedio)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">RevPAR (Rentabilidad)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-blue-500 rounded-full" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Ocupación (%)</span>
          </div>
        </div>
      </div>

      <div className="h-72 mt-5">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            onClick={(e) => {
              const chartEvent = e as unknown as { activePayload?: Array<{ payload: { monthKey?: string } }> };
              if (chartEvent?.activePayload && chartEvent.activePayload.length > 0 && onSelectMonth) {
                const clickedMonth = chartEvent.activePayload[0].payload.monthKey;
                if (clickedMonth) onSelectMonth(clickedMonth);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              className="text-slate-500 dark:text-slate-400"
            />
            {/* Left YAxis: Currency in COP */}
            <YAxis
              yAxisId="left"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-slate-400"
              tickFormatter={(val) => `$ ${(val / 1000).toFixed(0)}k`}
            />
            {/* Right YAxis: Percentage */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-slate-400"
              tickFormatter={(val) => `${val}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-lg text-xs space-y-2 z-50">
                      <p className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1">
                        {p.fullLabel}
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-rose-600 dark:text-rose-400 font-medium">ADR (Precio Promedio):</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{formatCOP(p.adr)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">RevPAR (Rentabilidad):</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{formatCOP(p.revPar)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">Ocupación:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {p.occupancy}% ({p.occupiedNights}/{p.totalNights} noches)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend display="none" />
            <Bar
              yAxisId="left"
              dataKey="adr"
              name="ADR"
              fill="#f43f5e"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              yAxisId="left"
              dataKey="revPar"
              name="RevPAR"
              fill="#10b981"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="occupancy"
              name="Ocupación"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
