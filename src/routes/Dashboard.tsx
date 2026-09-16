import { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Percent,
  BedDouble,
  ShieldAlert,
  CalendarDays,
  Clock,
  Sparkles,
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
import { formatCOP, formatMonthYear, formatDate, CATEGORY_LABELS, resolveBookingStatus, getColombiaDateTime } from '@/lib/formatters';
import { RevenueGoalCard } from '@/components/dashboard/RevenueGoalCard';

type TimeRange = 'this_month' | 'last_month' | 'ytd' | 'all_time';

export default function Dashboard() {
  const { data: bookings = [] } = useBookings();
  const { data: expenses = [] } = useExpenses();
  const { data: damages = [] } = useDamages();
  const { data: property } = useProperty();

  const [timeRange, setTimeRange] = useState<TimeRange>('this_month');

  // Compute date filter boundary using Colombia timezone
  const { dateStr: colDateStr } = getColombiaDateTime();
  const [colYearStr, colMonthStr] = colDateStr.split('-');
  const currentYear = parseInt(colYearStr, 10);
  const currentMonth = parseInt(colMonthStr, 10) - 1; // 0-indexed

  const currentMonthStr = `${currentYear}-${colMonthStr}`;
  const lastMonthStr = currentMonth === 0
    ? `${currentYear - 1}-12`
    : `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // Filter items according to selected time range
  const { filteredBookings, filteredExpenses, totalExpenses } = useMemo(() => {
    let bList: typeof bookings;
    let eList: typeof expenses;

    if (timeRange === 'this_month') {
      bList = bookings.filter((b) => b.check_in.startsWith(currentMonthStr));
      eList = expenses.filter(
        (e) => (e.billing_month && e.billing_month === currentMonthStr) || e.date.startsWith(currentMonthStr)
      );
    } else if (timeRange === 'last_month') {
      bList = bookings.filter((b) => b.check_in.startsWith(lastMonthStr));
      eList = expenses.filter(
        (e) => (e.billing_month && e.billing_month === lastMonthStr) || e.date.startsWith(lastMonthStr)
      );
    } else if (timeRange === 'ytd') {
      const yearPrefix = `${currentYear}-`;
      bList = bookings.filter((b) => b.check_in.startsWith(yearPrefix));
      eList = expenses.filter((e) => e.date.startsWith(yearPrefix));
    } else {
      // all_time
      bList = bookings;
      eList = expenses;
    }

    const calculatedTotal = eList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { filteredBookings: bList, filteredExpenses: eList, totalExpenses: calculatedTotal };
  }, [bookings, expenses, timeRange, currentMonthStr, lastMonthStr, currentYear]);

  // Aggregate financials
  const totalAirbnbPayout = filteredBookings.reduce((sum, b) => sum + (Number(b.net_payout) || 0), 0);
  const totalManagementFee = filteredBookings.reduce((sum, b) => {
    if (b.management_fee !== undefined && b.management_fee !== null) return sum + Number(b.management_fee);
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    return sum + Math.round(accommodation * 0.20);
  }, 0);
  const totalOwnerPayout = filteredBookings.reduce((sum, b) => {
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    return sum + Math.round(accommodation * 0.80);
  }, 0);
  const totalOwnerAccommodation = totalOwnerPayout;
  const netProfit = totalOwnerPayout - totalExpenses;
  const profitMargin = totalOwnerPayout > 0 ? Math.round((netProfit / totalOwnerPayout) * 100) : 0;

  // Hospitality KPIs
  const bookedNights = filteredBookings.reduce((sum, b) => sum + (Number(b.number_of_nights) || 0), 0);
  const calendarDays = timeRange === 'this_month' || timeRange === 'last_month' ? 30 : 90;
  const occupancyRate = Math.min(100, Math.round((bookedNights / calendarDays) * 100));
  const adr = bookedNights > 0 ? Math.round(totalOwnerAccommodation / bookedNights) : 0;
  const revPar = Math.round(adr * (occupancyRate / 100));

  // Monthly Cash Flow Chart Data (last 6 months)
  const cashFlowData = useMemo(() => {
    const monthsMap: Record<string, { month: string; monthLabel: string; income: number; expenses: number; profit: number }> = {};

    // Generate last 6 months keys
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap[key] = {
        month: key,
        monthLabel: formatMonthYear(key).split(' ')[0],
        income: 0,
        expenses: 0,
        profit: 0,
      };
    }

    bookings.forEach((b) => {
      const m = b.check_in.substring(0, 7);
      if (monthsMap[m]) {
        const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
        const ownerAmount = Math.round(accommodation * 0.80);
        monthsMap[m].income += ownerAmount;
      }
    });

    expenses.forEach((e) => {
      const m = e.billing_month || e.date.substring(0, 7);
      if (monthsMap[m]) {
        monthsMap[m].expenses += Number(e.amount) || 0;
      }
    });

    return Object.values(monthsMap).map((item) => ({
      ...item,
      profit: item.income - item.expenses,
    }));
  }, [bookings, expenses, currentYear, currentMonth]);

  // Expense Category Distribution Data
  const expenseCategoryData = useMemo(() => {
    const catMap: Record<string, number> = {};

    filteredExpenses.forEach((e) => {
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
  }, [filteredExpenses]);

  // Pending Actions / Operational Alerts
  const openDamages = damages.filter((d) => d.claim_status !== 'reimbursed' && d.claim_status !== 'written_off');
  const activeGuest = bookings.find((b) => resolveBookingStatus(b) === 'checked_in');
  const upcomingBookings = bookings
    .filter((b) => resolveBookingStatus(b) === 'confirmed')
    .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime())
    .slice(0, 3);

  const pendingBills = expenses.filter(
    (e) => e.payment_status === 'pending' && (!e.billing_month || e.billing_month === currentMonthStr)
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
        <div className="flex items-center p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setTimeRange('this_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              timeRange === 'this_month'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Este Mes
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('last_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              timeRange === 'last_month'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Mes Pasado
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('ytd')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              timeRange === 'ytd'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Año Corrido (YTD)
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all_time')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              timeRange === 'all_time'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Histórico
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Net Profit Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ganancia Neta</span>
            <div className={`p-1.5 rounded-lg ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className={`text-xl font-extrabold ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCOP(netProfit)}
            </p>
            <span className="text-[11px] font-medium text-slate-400">
              Margen: <strong>{profitMargin}%</strong>
            </span>
          </div>
        </div>

        {/* Total Income Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Valor Neto Propietarios</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCOP(totalOwnerPayout)}
            </p>
            <span className="text-[11px] font-medium text-slate-400">
              Airbnb: {formatCOP(totalAirbnbPayout)} <span className="text-amber-500 font-semibold">(-{formatCOP(totalManagementFee)} adm)</span>
            </span>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Gastos</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {formatCOP(totalExpenses)}
            </p>
            <span className="text-[11px] font-medium text-slate-400">
              Fijos, EPM y consumos
            </span>
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ocupación</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{occupancyRate}%</p>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* ADR (Average Daily Rate) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tarifa Diaria (ADR)</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCOP(adr)}
            </p>
            <span className="text-[11px] font-medium text-slate-400">
              {bookedNights} noches (neta de adm.)
            </span>
          </div>
        </div>

        {/* RevPAR */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">RevPAR</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCOP(revPar)}
            </p>
            <span className="text-[11px] font-medium text-slate-400">
              Ingreso por noche disponible
            </span>
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
              <p className="text-xs text-slate-400">Comparativa histórica de los últimos 6 meses en COP</p>
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
                  formatter={(value: unknown) => [formatCOP(Number(value)) + ' COP', '']}
                  labelFormatter={(label) => `Mes: ${label}`}
                  contentStyle={{
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="income" name="Ingreso Neto" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Gastos Totales" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Ganancia Neta"
                  stroke="#3b82f6"
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
                {formatCOP(Math.round(Math.max(0, (Number(activeGuest.net_payout) || 0) - (Number(activeGuest.cleaning_fee_collected) || 0)) * 0.80))}
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
                    {formatCOP(Math.round(Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) * 0.80))}
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
