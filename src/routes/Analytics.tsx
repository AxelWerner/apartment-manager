import { useState, useMemo } from 'react';
import { useBookings } from '@/hooks/use-bookings';
import { useProperty } from '@/hooks/use-property';
import { getColombiaDateTime } from '@/lib/formatters';
import {
  calculateMonthAnalytics,
  calculateMoMComparison,
  calculateMultiMonthTrends,
  getAvailableMonths,
} from '@/lib/analytics-utils';
import { AnalyticsKpiCards } from '@/components/analytics/AnalyticsKpiCards';
import { MonthNavigator } from '@/components/analytics/MonthNavigator';
import { MultiMonthChart } from '@/components/analytics/MultiMonthChart';
import { OccupancyDayMatrix } from '@/components/analytics/OccupancyDayMatrix';
import { StayDistributionCards } from '@/components/analytics/StayDistributionCards';
import { MonthlyComparisonTable } from '@/components/analytics/MonthlyComparisonTable';
import { MonthBookingsList } from '@/components/analytics/MonthBookingsList';
import { BarChart3, Sparkles } from 'lucide-react';

export default function Analytics() {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: property } = useProperty();

  // Current date reference in Colombia
  const { dateStr } = getColombiaDateTime();
  const defaultMonthKey = dateStr.substring(0, 7);

  // Filter and month states
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthKey);
  const [channelFilter, setChannelFilter] = useState<'all' | 'airbnb' | 'direct'>('all');
  const [horizonFilter, setHorizonFilter] = useState<'all' | 'real' | 'future'>('all');

  // Available months discovered from bookings + current month
  const availableMonths = useMemo(() => {
    return getAvailableMonths(bookings, dateStr);
  }, [bookings, dateStr]);

  // Ensure selectedMonth is in availableMonths or fallback
  const effectiveMonth = useMemo(() => {
    if (availableMonths.includes(selectedMonth)) return selectedMonth;
    return availableMonths[0] || defaultMonthKey;
  }, [availableMonths, selectedMonth, defaultMonthKey]);

  // Previous month key for MoM comparison
  const previousMonthKey = useMemo(() => {
    const [yStr, mStr] = effectiveMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const prevDate = new Date(y, m - 2, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }, [effectiveMonth]);

  // Analytics for selected month
  const currentMonthStats = useMemo(() => {
    return calculateMonthAnalytics(bookings, effectiveMonth, {
      channelFilter,
      horizonFilter,
      referenceDateStr: dateStr,
    });
  }, [bookings, effectiveMonth, channelFilter, horizonFilter, dateStr]);

  // Analytics for previous month
  const previousMonthStats = useMemo(() => {
    return calculateMonthAnalytics(bookings, previousMonthKey, {
      channelFilter,
      horizonFilter,
      referenceDateStr: dateStr,
    });
  }, [bookings, previousMonthKey, channelFilter, horizonFilter, dateStr]);

  // MoM comparison
  const momComparison = useMemo(() => {
    return calculateMoMComparison(currentMonthStats, previousMonthStats);
  }, [currentMonthStats, previousMonthStats]);

  // Trend dataset across all available months
  const multiMonthTrendData = useMemo(() => {
    return calculateMultiMonthTrends(bookings, availableMonths, {
      channelFilter,
      horizonFilter,
      referenceDateStr: dateStr,
    });
  }, [bookings, availableMonths, channelFilter, horizonFilter, dateStr]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Calculando analíticas del apartamento...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Analíticas del Apto
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {property?.name || 'Apto 502'} • Indicadores de desempeño hotelero y rentabilidad
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Tarifa Base: <strong>${((property?.default_nightly_rate || 280000) / 1000).toFixed(0)}k COP</strong>
          </span>
        </div>
      </div>

      {/* Month & Filter Navigation */}
      <MonthNavigator
        selectedMonth={effectiveMonth}
        onSelectMonth={setSelectedMonth}
        availableMonths={availableMonths}
        channelFilter={channelFilter}
        onChannelFilterChange={setChannelFilter}
        horizonFilter={horizonFilter}
        onHorizonFilterChange={setHorizonFilter}
      />

      {/* Top 5 KPI Cards: ADR, Ocupación, RevPAR, LOS, Lead Time */}
      <AnalyticsKpiCards stats={currentMonthStats} mom={momComparison} />

      {/* Multi-month Chart */}
      <MultiMonthChart
        data={multiMonthTrendData}
        selectedMonth={effectiveMonth}
        onSelectMonth={setSelectedMonth}
      />

      {/* Stay (LOS) & Lead Time Distribution */}
      <StayDistributionCards stats={currentMonthStats} />

      {/* Daily Occupancy & Nightly Rate Matrix */}
      <OccupancyDayMatrix
        days={currentMonthStats.dailyStatus}
        monthLabel={currentMonthStats.monthLabel}
      />

      {/* Multi-month Summary Table */}
      <MonthlyComparisonTable
        data={multiMonthTrendData}
        selectedMonth={effectiveMonth}
        onSelectMonth={setSelectedMonth}
      />

      {/* Contributing Bookings in Selected Month */}
      <MonthBookingsList
        bookings={currentMonthStats.monthBookings}
        monthLabel={currentMonthStats.monthLabel}
      />
    </div>
  );
}
