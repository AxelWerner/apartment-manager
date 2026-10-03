import { useState, useMemo } from 'react';
import { useBookings } from '@/hooks/use-bookings';
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

export default function Analytics() {
  const { data: bookings = [], isLoading } = useBookings();

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
