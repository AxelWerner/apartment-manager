import { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Percent,
  Building2,
  ShieldAlert,
  CalendarDays,
  Clock,
  Sparkles,
  Moon,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Line,
  ComposedChart,
} from 'recharts';
import { useBookings } from '@/hooks/use-bookings';
import { useExpenses } from '@/hooks/use-expenses';
import { useDamages } from '@/hooks/use-damages';
import { useProperty } from '@/hooks/use-property';
import {
  formatCOP,
  formatMonthYear,
  formatDate,
  CATEGORY_LABELS,
  resolveBookingStatus,
  getColombiaDateTime,
  getBookingSourceInfo,
  isBookingReal,
  isBookingFuture,
  isExpenseReal,
  isExpenseFuture,
  isSameStay,
  calculateUniqueBookedNights,
  calculateUniqueStays,
} from '@/lib/formatters';
import type { Booking } from '@/types/database';
import { RevenueGoalCard } from '@/components/dashboard/RevenueGoalCard';
import { MiniPieCardChart } from '@/components/charts/MiniPieCardChart';

type TimeRange = 'this_month' | 'next_month' | 'last_month' | 'ytd' | 'all_time';
type FinancialHorizon = 'all' | 'real' | 'future';

export default function Dashboard() {
  const { data: bookings = [] } = useBookings();
  const { data: expenses = [] } = useExpenses();
  const { data: damages = [] } = useDamages();
  const { data: property } = useProperty();

  const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
  const [financialHorizon, setFinancialHorizon] = useState<FinancialHorizon>('all');

  // Compute date filter boundary using Colombia timezone
  const { dateStr: colDateStr } = getColombiaDateTime();
  const [colYearStr, colMonthStr] = colDateStr.split('-');
  const currentYear = parseInt(colYearStr, 10);
  const currentMonth = parseInt(colMonthStr, 10) - 1; // 0-indexed

  const currentMonthStr = `${currentYear}-${colMonthStr}`;
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Filter items according to selected time range
  const { filteredBookings, filteredExpenses } = useMemo(() => {
    let bList: typeof bookings;
    let eList: typeof expenses;

    if (timeRange === 'this_month') {
      bList = bookings.filter(
        (b) => b.check_in.startsWith(currentMonthStr) && resolveBookingStatus(b) !== 'cancelled'
      );
      eList = expenses.filter((e) =>
        e.billing_month ? e.billing_month === currentMonthStr : e.date.startsWith(currentMonthStr)
      );
    } else if (timeRange === 'next_month') {
      bList = bookings.filter(
        (b) => b.check_in.startsWith(nextMonthStr) && resolveBookingStatus(b) !== 'cancelled'
      );
      eList = expenses.filter((e) =>
        e.billing_month ? e.billing_month === nextMonthStr : e.date.startsWith(nextMonthStr)
      );
    } else if (timeRange === 'last_month') {
      bList = bookings.filter(
        (b) => b.check_in.startsWith(lastMonthStr) && resolveBookingStatus(b) !== 'cancelled'
      );
      eList = expenses.filter((e) =>
        e.billing_month ? e.billing_month === lastMonthStr : e.date.startsWith(lastMonthStr)
      );
    } else if (timeRange === 'ytd') {
      const yearPrefix = `${currentYear}-`;
      bList = bookings.filter(
        (b) =>
          b.check_in.startsWith(yearPrefix) &&
          b.check_in <= colDateStr &&
          resolveBookingStatus(b) !== 'cancelled'
      );
      eList = expenses.filter((e) => {
        const d = e.date || (e.billing_month ? `${e.billing_month}-01` : '');
        return d.startsWith(yearPrefix) && d <= colDateStr;
      });
    } else {
      // all_time
      bList = bookings.filter((b) => resolveBookingStatus(b) !== 'cancelled');
      eList = expenses;
    }

    const calculatedTotal = eList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { filteredBookings: bList, filteredExpenses: eList, totalExpenses: calculatedTotal };
  }, [bookings, expenses, timeRange, currentMonthStr, nextMonthStr, lastMonthStr, currentYear, colDateStr]);

  // Aggregate helpers
  const getBookingMgmtFee = (b: Booking) => {
    if (b.management_fee !== undefined && b.management_fee !== null) return Number(b.management_fee);
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    const rate = getBookingSourceInfo(b.source).commissionRate;
    return Math.round(accommodation * rate);
  };

  const getBookingOwnerPayout = (b: Booking) => {
    if (b.owner_payout !== undefined && b.owner_payout !== null) return Number(b.owner_payout);
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    const rate = getBookingSourceInfo(b.source).ownerRate;
    return Math.round(accommodation * rate);
  };

  // Real vs Future breakdown for the period
  const realBookings = useMemo(
    () => filteredBookings.filter((b) => isBookingReal(b, colDateStr)),
    [filteredBookings, colDateStr]
  );
  const futureBookings = useMemo(
    () => filteredBookings.filter((b) => isBookingFuture(b, colDateStr)),
    [filteredBookings, colDateStr]
  );
  const realExpensesList = useMemo(
    () => filteredExpenses.filter((e) => isExpenseReal(e)),
    [filteredExpenses]
  );
  const futureExpensesList = useMemo(
    () => filteredExpenses.filter((e) => isExpenseFuture(e)),
    [filteredExpenses]
  );

  // Financial aggregates: Real (Cobrado / Pagado)
  const realOwnerPayout = realBookings.reduce((sum, b) => sum + getBookingOwnerPayout(b), 0);
  const realManagementFee = realBookings.reduce((sum, b) => sum + getBookingMgmtFee(b), 0);
  const realGrossAccommodation = realOwnerPayout + realManagementFee;
  const realCleaningFee = realBookings.reduce((sum, b) => sum + (Number(b.cleaning_fee_collected) || 0), 0);
  const realExpensesTotal = realExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const realNetProfit = realOwnerPayout - realExpensesTotal;
  const realBookedNights = calculateUniqueBookedNights(realBookings);

  // Financial aggregates: Futuro (Por cobrar / Pendiente)
  const futureOwnerPayout = futureBookings.reduce((sum, b) => sum + getBookingOwnerPayout(b), 0);
  const futureManagementFee = futureBookings.reduce((sum, b) => sum + getBookingMgmtFee(b), 0);
  const futureGrossAccommodation = futureOwnerPayout + futureManagementFee;
  const futureCleaningFee = futureBookings.reduce((sum, b) => sum + (Number(b.cleaning_fee_collected) || 0), 0);
  const futureExpensesTotal = futureExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const futureNetProfit = futureOwnerPayout - futureExpensesTotal;
  const futureBookedNights = calculateUniqueBookedNights(
    futureBookings.filter((fb) => !realBookings.some((rb) => isSameStay(rb, fb)))
  );

  // Financial aggregates: Total (Consolidado Proyectado)
  const totalOwnerPayout = realOwnerPayout + futureOwnerPayout;
  const totalManagementFee = realManagementFee + futureManagementFee;
  const totalGrossAccommodation = realGrossAccommodation + futureGrossAccommodation;
  const totalGuestCleaningFee = realCleaningFee + futureCleaningFee;
  const totalExpenses = realExpensesTotal + futureExpensesTotal;
  const netProfit = totalOwnerPayout - totalExpenses;
  const bookedNights = realBookedNights + futureBookedNights;

  // Active dataset for cards and mini pie charts according to financialHorizon
  const activeBookingsList =
    financialHorizon === 'real'
      ? realBookings
      : financialHorizon === 'future'
      ? futureBookings
      : filteredBookings;

  const activeExpensesList =
    financialHorizon === 'real'
      ? realExpensesList
      : financialHorizon === 'future'
      ? futureExpensesList
      : filteredExpenses;

  const displayedNetProfit =
    financialHorizon === 'real'
      ? realNetProfit
      : financialHorizon === 'future'
      ? futureNetProfit
      : netProfit;

  const displayedOwnerPayout =
    financialHorizon === 'real'
      ? realOwnerPayout
      : financialHorizon === 'future'
      ? futureOwnerPayout
      : totalOwnerPayout;

  const displayedGrossAccommodation =
    financialHorizon === 'real'
      ? realGrossAccommodation
      : financialHorizon === 'future'
      ? futureGrossAccommodation
      : totalGrossAccommodation;

  const displayedManagementFee =
    financialHorizon === 'real'
      ? realManagementFee
      : financialHorizon === 'future'
      ? futureManagementFee
      : totalManagementFee;

  const displayedCleaningFee =
    financialHorizon === 'real'
      ? realCleaningFee
      : financialHorizon === 'future'
      ? futureCleaningFee
      : totalGuestCleaningFee;

  const realCleaningStays = calculateUniqueStays(realBookings);
  const futureCleaningStays = calculateUniqueStays(futureBookings);
  const totalCleaningStays = calculateUniqueStays(filteredBookings);

  const displayedCleaningStays =
    financialHorizon === 'real'
      ? realCleaningStays
      : financialHorizon === 'future'
      ? futureCleaningStays
      : totalCleaningStays;

  const displayedExpenses =
    financialHorizon === 'real'
      ? realExpensesTotal
      : financialHorizon === 'future'
      ? futureExpensesTotal
      : totalExpenses;

  // Pie chart datasets for cards
  const ownerPayoutAirbnb = activeBookingsList
    .filter((b) => !b.source || b.source === 'airbnb')
    .reduce((sum, b) => sum + getBookingOwnerPayout(b), 0);

  const ownerPayoutDirect10 = activeBookingsList
    .filter((b) => b.source === 'direct' || b.source === 'direct_10')
    .reduce((sum, b) => sum + getBookingOwnerPayout(b), 0);

  const ownerPayoutDirect25 = activeBookingsList
    .filter((b) => b.source === 'direct_25')
    .reduce((sum, b) => sum + getBookingOwnerPayout(b), 0);

  const managementFeeAirbnb = activeBookingsList
    .filter((b) => !b.source || b.source === 'airbnb')
    .reduce((sum, b) => sum + getBookingMgmtFee(b), 0);

  const managementFeeDirect10 = activeBookingsList
    .filter((b) => b.source === 'direct' || b.source === 'direct_10')
    .reduce((sum, b) => sum + getBookingMgmtFee(b), 0);

  const managementFeeDirect25 = activeBookingsList
    .filter((b) => b.source === 'direct_25')
    .reduce((sum, b) => sum + getBookingMgmtFee(b), 0);

  const cleaningFeeAirbnb = activeBookingsList
    .filter((b) => !b.source || b.source === 'airbnb')
    .reduce((sum, b) => sum + (Number(b.cleaning_fee_collected) || 0), 0);

  const cleaningFeeDirect10 = activeBookingsList
    .filter((b) => b.source === 'direct' || b.source === 'direct_10')
    .reduce((sum, b) => sum + (Number(b.cleaning_fee_collected) || 0), 0);

  const cleaningFeeDirect25 = activeBookingsList
    .filter((b) => b.source === 'direct_25')
    .reduce((sum, b) => sum + (Number(b.cleaning_fee_collected) || 0), 0);

  const hoaExpenses = activeExpensesList
    .filter((e) => e.category === 'hoa_administration')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const utilitiesExpenses = activeExpensesList
    .filter((e) => ['electricity', 'water', 'gas'].includes(e.category))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const otherExpenses = activeExpensesList
    .filter((e) => !['hoa_administration', 'electricity', 'water', 'gas'].includes(e.category))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const accommodationRevenuePieData = useMemo(() => [
    { name: 'Airbnb', value: ownerPayoutAirbnb, color: '#f43f5e' },
    { name: 'Directas (10%)', value: ownerPayoutDirect10, color: '#10b981' },
    { name: 'Directas (25%)', value: ownerPayoutDirect25, color: '#8b5cf6' },
  ], [ownerPayoutAirbnb, ownerPayoutDirect10, ownerPayoutDirect25]);

  const managementFeePieData = useMemo(() => [
    { name: 'Airbnb (20%)', value: managementFeeAirbnb, color: '#f43f5e' },
    { name: 'Directas (10%)', value: managementFeeDirect10, color: '#10b981' },
    { name: 'Directas (25%)', value: managementFeeDirect25, color: '#8b5cf6' },
  ], [managementFeeAirbnb, managementFeeDirect10, managementFeeDirect25]);

  const cleaningFeePieData = useMemo(() => [
    { name: 'Airbnb', value: cleaningFeeAirbnb, color: '#f43f5e' },
    { name: 'Directas (10%)', value: cleaningFeeDirect10, color: '#10b981' },
    { name: 'Directas (25%)', value: cleaningFeeDirect25, color: '#8b5cf6' },
  ], [cleaningFeeAirbnb, cleaningFeeDirect10, cleaningFeeDirect25]);

  const monthlyExpensesPieData = useMemo(() => [
    { name: 'Adm Edificio', value: hoaExpenses, color: '#f59e0b' },
    { name: 'Servicios Públicos', value: utilitiesExpenses, color: '#06b6d4' },
    { name: 'Internet y Otros', value: otherExpenses, color: '#8b5cf6' },
  ], [hoaExpenses, utilitiesExpenses, otherExpenses]);

  // Hospitality KPIs with exact calendar days per period
  const calendarDays = useMemo(() => {
    if (timeRange === 'this_month') {
      return new Date(currentYear, currentMonth + 1, 0).getDate();
    }
    if (timeRange === 'next_month') {
      return new Date(currentYear, currentMonth + 2, 0).getDate();
    }
    if (timeRange === 'last_month') {
      return new Date(currentYear, currentMonth, 0).getDate();
    }
    if (timeRange === 'ytd') {
      const colDay = parseInt(colDateStr.split('-')[2], 10) || 1;
      const now = new Date(currentYear, currentMonth, colDay);
      const startOfYear = new Date(currentYear, 0, 1);
      const diffTime = Math.abs(now.getTime() - startOfYear.getTime());
      return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }
    if (bookings.length > 0) {
      const sortedCheckIns = bookings
        .filter((b) => resolveBookingStatus(b) !== 'cancelled')
        .map((b) => b.check_in)
        .sort();
      if (sortedCheckIns.length > 0) {
        const firstCheckIn = new Date(sortedCheckIns[0] + 'T00:00:00');
        const today = new Date(colDateStr + 'T00:00:00');
        const diffDays = Math.ceil(Math.abs(today.getTime() - firstCheckIn.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return Math.max(1, diffDays);
      }
    }
    return 365;
  }, [timeRange, currentYear, currentMonth, colDateStr, bookings]);

  const occupancyRate = Math.min(100, Math.round((bookedNights / calendarDays) * 100));

  // Active guest in house (prioritizes incoming check-in today or longer stay if turnover day)
  const checkedInBookings = bookings.filter((b) => resolveBookingStatus(b) === 'checked_in');
  const activeGuest =
    checkedInBookings.find((b) => b.check_in === colDateStr) ||
    checkedInBookings.find((b) => b.check_out > colDateStr) ||
    checkedInBookings[0];

  // Night progress tracker for the period
  const periodNightsProgress = useMemo(() => {
    if (filteredBookings.length > 0 && bookedNights > 0) {
      return {
        display: `${bookedNights}/${calendarDays}`,
        subtitle: `${bookedNights} de ${calendarDays} noches reservadas`,
        breakdownText: `${realBookedNights} reales · ${futureBookedNights} futuras`,
      };
    }

    return {
      display: '-',
      subtitle: 'Sin reservas en el período',
      breakdownText: '',
    };
  }, [filteredBookings.length, bookedNights, calendarDays, realBookedNights, futureBookedNights]);

  // Monthly Cash Flow Chart Data (last 6 months)
  const cashFlowData = useMemo(() => {
    const monthsMap: Record<
      string,
      {
        month: string;
        monthLabel: string;
        income: number;
        realIncome: number;
        futureIncome: number;
        expenses: number;
        realExpenses: number;
        futureExpenses: number;
        profit: number;
      }
    > = {};

    // Generate last 6 months keys
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap[key] = {
        month: key,
        monthLabel: formatMonthYear(key).split(' ')[0],
        income: 0,
        realIncome: 0,
        futureIncome: 0,
        expenses: 0,
        realExpenses: 0,
        futureExpenses: 0,
        profit: 0,
      };
    }

    bookings.forEach((b) => {
      if (resolveBookingStatus(b) === 'cancelled') return;
      const m = b.check_in.substring(0, 7);
      if (monthsMap[m]) {
        const ownerAmount =
          b.owner_payout !== undefined && b.owner_payout !== null
            ? Number(b.owner_payout)
            : Math.round(
                Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) *
                  getBookingSourceInfo(b.source).ownerRate
              );
        monthsMap[m].income += ownerAmount;
        if (isBookingReal(b, colDateStr)) {
          monthsMap[m].realIncome += ownerAmount;
        } else {
          monthsMap[m].futureIncome += ownerAmount;
        }
      }
    });

    expenses.forEach((e) => {
      const m = e.billing_month || e.date.substring(0, 7);
      if (monthsMap[m]) {
        const amt = Number(e.amount) || 0;
        monthsMap[m].expenses += amt;
        if (isExpenseReal(e)) {
          monthsMap[m].realExpenses += amt;
        } else {
          monthsMap[m].futureExpenses += amt;
        }
      }
    });

    return Object.values(monthsMap).map((item) => ({
      ...item,
      profit: item.income - item.expenses,
    }));
  }, [bookings, expenses, currentYear, currentMonth, colDateStr]);

  // Expense Category Distribution Data
  const expenseCategoryData = useMemo(() => {
    const catMap: Record<string, number> = {};

    activeExpensesList.forEach((e) => {
      const cat = e.category;
      catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0);
    });

    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b'];

    return Object.entries(catMap)
      .map(([catKey, amount], idx) => ({
        name: CATEGORY_LABELS[catKey as keyof typeof CATEGORY_LABELS]?.label || catKey,
        amount,
        color: colors[idx % colors.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [activeExpensesList]);

  // Pending Actions / Operational Alerts
  const openDamages = damages.filter((d) => d.claim_status !== 'reimbursed' && d.claim_status !== 'written_off');
  const upcomingBookings = useMemo(() => {
    const confirmed = bookings
      .filter((b) => resolveBookingStatus(b) === 'confirmed')
      .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());

    const unique: Booking[] = [];
    for (const b of confirmed) {
      if (!unique.some((existing) => isSameStay(existing, b))) {
        unique.push(b);
      }
    }
    return unique.slice(0, 3);
  }, [bookings]);

  const pendingBills = expenses.filter(
    (e) =>
      e.payment_status === 'pending' &&
      (e.billing_month ? e.billing_month === currentMonthStr : e.date.startsWith(currentMonthStr))
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Dashboard de Rentabilidad
            </h1>
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              {property?.name || 'Apto 502'}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Monitoreo en tiempo real de ingresos, gastos y rentabilidad en Pesos Colombianos (COP)
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl w-fit max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setTimeRange('next_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${timeRange === 'next_month'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
          >
            Próximo Mes
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('this_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${timeRange === 'this_month'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
          >
            Este Mes
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('last_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${timeRange === 'last_month'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
          >
            Mes Pasado
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('ytd')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${timeRange === 'ytd'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
          >
            Todo {currentYear} hasta HOY
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all_time')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${timeRange === 'all_time'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
          >
            Histórico
          </button>
        </div>
      </div>

      {/* Ocupación y Noches en el Período */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left side: Occupancy Rate */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Percent className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tasa de Ocupación</span>
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">{occupancyRate}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
          </div>

          {/* Divider on sm screens */}
          <div className="hidden sm:block w-px h-10 bg-slate-200 dark:bg-slate-800" />

          {/* Right side: Nights Tracker */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:min-w-[260px]">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-left sm:text-right">
                Noches en el Período
              </p>
              <p className="text-[11px] text-slate-400 text-left sm:text-right">
                {periodNightsProgress.subtitle}
              </p>
              {periodNightsProgress.breakdownText && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium text-left sm:text-right">
                  {periodNightsProgress.breakdownText}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <Moon className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {periodNightsProgress.display}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Large Consolidated Financial Breakdown Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-500" />
                <span>Desglose Financiero y Gastos del Período</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingresos de alojamiento (bruto y neto), comisión de administración, aseo y gastos mensuales (servicios públicos/fijos)
              </p>
            </div>

            {/* Financial View Horizon Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2">
                Vista:
              </span>
              <button
                type="button"
                onClick={() => setFinancialHorizon('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  financialHorizon === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Todo (Proyectado)
              </button>
              <button
                type="button"
                onClick={() => setFinancialHorizon('real')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  financialHorizon === 'real'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
                title="Mostrar únicamente reservas cobradas/activas y gastos pagados"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Solo Real (En Caja)</span>
              </button>
              <button
                type="button"
                onClick={() => setFinancialHorizon('future')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  financialHorizon === 'future'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                }`}
                title="Mostrar reservas futuras por cobrar y facturas pendientes"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Solo Futuro (Por Cobrar)</span>
              </button>
            </div>
          </div>

          {/* Ganancia Neta & Real vs Future Box */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                displayedNetProfit >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
              }`}>
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                  Ganancia Neta
                </span>
                <p className={`text-xl sm:text-2xl font-black tracking-tight ${
                  displayedNetProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatCOP(displayedNetProfit)}
                </p>
              </div>
            </div>

            {/* Quick 2-result summary (Real vs Futuro) */}
            <div className="flex flex-col gap-1 sm:pl-3 sm:border-l border-slate-200 dark:border-slate-700 text-[11px]">
              <div
                className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40"
                title="Ganancia de reservas ya en el apartamento o completadas menos gastos pagados"
              >
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Real (en caja):</span>
                </span>
                <span>{formatCOP(realNetProfit)}</span>
              </div>
              <div
                className="flex items-center justify-between gap-3 text-blue-700 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/40"
                title="Ganancia proyectada de reservas futuras menos gastos pendientes"
              >
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Futuro (por cobrar):</span>
                </span>
                <span>{formatCOP(futureNetProfit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Columns in the Big Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {/* 1. Ingresos de Alojamiento (Neto y Bruto) */}
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Ingresos de Alojamiento</span>
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <MiniPieCardChart
                  data={accommodationRevenuePieData}
                  emptyText="Sin ingresos"
                />
              </div>
            </div>
            <div className="pt-2.5 mt-2 border-t border-blue-200/60 dark:border-blue-800/40">
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCOP(displayedOwnerPayout)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <span>Neto dueños</span>
                <span className="text-[10px] text-slate-400" title={`Bruto: ${formatCOP(displayedGrossAccommodation)}`}>
                  Bruto: {formatCOP(displayedGrossAccommodation)}
                </span>
              </div>
              {/* Real vs Future Sub-pills */}
              <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/30 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold" title="Dinero ya cobrado de reservas en curso o completadas">
                  ✓ Real: {formatCOP(realOwnerPayout)}
                </span>
                <span className="text-blue-700 dark:text-blue-400 font-semibold" title="Dinero proyectado de reservas futuras que aún no han hecho check-in">
                  ⏳ Futuro: {formatCOP(futureOwnerPayout)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Gasto de Administración */}
          <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Gasto de Administración</span>
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <MiniPieCardChart
                  data={managementFeePieData}
                  emptyText="Sin comisiones"
                />
              </div>
            </div>
            <div className="pt-2.5 mt-2 border-t border-amber-200/60 dark:border-amber-800/40">
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                -{formatCOP(displayedManagementFee)}
              </p>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Comisión total de gestión
              </span>
              {/* Real vs Future Sub-pills */}
              <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-800/30 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  ✓ Real: -{formatCOP(realManagementFee)}
                </span>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  ⏳ Futuro: -{formatCOP(futureManagementFee)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Gasto de Aseo */}
          <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">Gasto de Aseo</span>
                <div className="p-1.5 rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <MiniPieCardChart
                  data={cleaningFeePieData}
                  emptyText="Sin aseo recaudado"
                />
              </div>
            </div>
            <div className="pt-2.5 mt-2 border-t border-teal-200/60 dark:border-teal-800/40">
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCOP(displayedCleaningFee)}
              </p>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Recaudado ({displayedCleaningStays} {displayedCleaningStays === 1 ? 'estadía' : 'estadías'})
              </span>
              {/* Real vs Future Sub-pills */}
              <div className="mt-2 pt-2 border-t border-teal-200/50 dark:border-teal-800/30 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  ✓ Real: {formatCOP(realCleaningFee)}
                </span>
                <span className="text-teal-700 dark:text-teal-400 font-semibold">
                  ⏳ Futuro: {formatCOP(futureCleaningFee)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Gastos Mensuales (Agua, Luz, Gas, etc.) */}
          <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">Gastos Mensuales</span>
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <MiniPieCardChart
                  data={monthlyExpensesPieData}
                  emptyText="Sin gastos del período"
                />
              </div>
            </div>
            <div className="pt-2.5 mt-2 border-t border-rose-200/60 dark:border-rose-800/40">
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                -{formatCOP(displayedExpenses)}
              </p>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total gastos del período
              </span>
              {/* Real vs Future Sub-pills */}
              <div className="mt-2 pt-2 border-t border-rose-200/50 dark:border-rose-800/30 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold" title="Facturas ya pagadas">
                  ✓ Pagado: -{formatCOP(realExpensesTotal)}
                </span>
                <span className="text-rose-700 dark:text-rose-400 font-semibold" title="Facturas pendientes de pago">
                  ⏳ Por pagar: -{formatCOP(futureExpensesTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Revenue Target / Meta de Reservas */}
      <RevenueGoalCard
        bookings={bookings}
        property={property}
        currentMonthStr={currentMonthStr}
        currentYear={currentYear}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart (2 Columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Flujo de Caja Mensual (Ingresos vs. Gastos)
              </h2>
              <p className="text-xs text-slate-400">
                Comparativa histórica con segmentación de cobrado real vs futuro proyectado en COP
              </p>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [formatCOP(Number(value)) + ' COP', String(name)]}
                  labelFormatter={(label) => `Mes: ${label}`}
                  contentStyle={{
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="realIncome" stackId="income" name="Ingreso Real (Cobrado)" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="futureIncome" stackId="income" name="Ingreso Futuro (Por cobrar)" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="realExpenses" stackId="expenses" name="Gastos Pagados" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="futureExpenses" stackId="expenses" name="Gastos Pendientes" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Ganancia Neta Total"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Distribution Donut (1 Column) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Distribución de Gastos
            </h2>
            <p className="text-xs text-slate-400">Porcentaje por categoría de costo</p>
          </div>

          {expenseCategoryData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              Sin gastos en este período
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {expenseCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown) => [formatCOP(Number(val)), 'Gasto']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Legend Items */}
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {expenseCategoryData.slice(0, 4).map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 dark:text-slate-300 truncate">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCOP(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Widgets (Upcoming Stays, Pending Bills, Open Damages) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upcoming Check-ins & Active Guest */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-rose-500" />
              <span>Estadías y Huéspedes</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">Airbnb</span>
          </div>

          {activeGuest && (
            <div className="p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">En el Apto Ahora</span>
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{activeGuest.guest_name}</p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Salida: {formatDate(activeGuest.check_out)} ({activeGuest.number_of_nights} noches)
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {formatCOP(getBookingOwnerPayout(activeGuest))}
              </span>
            </div>
          )}

          {upcomingBookings.length === 0 && !activeGuest ? (
            <p className="text-xs text-slate-400 py-3">No hay reservas próximas registradas.</p>
          ) : (
            <div className="space-y-2">
              {upcomingBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{b.guest_name}</p>
                    <p className="text-[10px] text-slate-500">
                      Entrada: {formatDate(b.check_in)} ({b.number_of_nights} noches)
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCOP(getBookingOwnerPayout(b))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Bills Warning */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Facturas Pendientes</span>
            </h3>
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
              {pendingBills.length} por pagar
            </span>
          </div>

          {pendingBills.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">¡Al día! No tienes facturas pendientes este mes.</p>
          ) : (
            <div className="space-y-2">
              {pendingBills.slice(0, 3).map((bill) => (
                <div
                  key={bill.id}
                  className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {bill.description}
                    </p>
                    {bill.due_date && (
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">
                        Vence: {formatDate(bill.due_date)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white shrink-0">
                    {formatCOP(bill.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Damage / AirCover Status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-500" />
              <span>Incidentes / AirCover</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              {openDamages.length} abiertos
            </span>
          </div>

          {openDamages.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">Sin incidentes abiertos pendientes de cobro.</p>
          ) : (
            <div className="space-y-2">
              {openDamages.slice(0, 3).map((d) => (
                <div
                  key={d.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {d.title}
                    </p>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400">
                      {d.claim_status === 'aircover_claim_submitted'
                        ? 'Reclamo AirCover en curso'
                        : 'Contactando huésped'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-rose-600 shrink-0">
                    {formatCOP(d.actual_repair_cost || d.estimated_repair_cost)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
