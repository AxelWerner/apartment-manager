import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  CalendarDays,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  Edit2,
  Trash2,
  Moon,
  DollarSign,
  Percent,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calculator,
  Eye,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useBookings, useDeleteBooking } from '@/hooks/use-bookings';
import { BookingModal } from '@/components/bookings/BookingModal';
import { CsvImportModal } from '@/components/bookings/CsvImportModal';
import {
  formatCOP,
  formatDate,
  formatMonthYear,
  BOOKING_STATUS_CONFIG,
  resolveBookingStatus,
  getBookingSourceInfo,
  getColombiaDateTime,
  isBookingReal,
  isBookingFuture,
  isSameStay,
  calculateUniqueBookedNights,
  calculateUniqueStays,
} from '@/lib/formatters';
import type { Booking, BookingStatus } from '@/types/database';
import { MiniPieCardChart } from '@/components/charts/MiniPieCardChart';
import { toast } from 'sonner';

export default function Bookings() {
  const { data: bookings = [], isLoading } = useBookings();
  const deleteBookingMutation = useDeleteBooking();

  const { dateStr: colDateStr } = getColombiaDateTime();
  const [financialHorizon, setFinancialHorizon] = useState<'all' | 'real' | 'future'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);

  // Revenue calculation display mode: compact ('solo neto') vs breakdown ('desglose')
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [rowBreakdownOverrides, setRowBreakdownOverrides] = useState<Record<string, boolean>>({});

  // Context menu state for right-click interaction
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    booking: Booking;
  } | null>(null);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleRowBreakdown = (bookingId: string) => {
    setRowBreakdownOverrides((prev) => {
      const current = prev[bookingId] !== undefined ? prev[bookingId] : showBreakdown;
      return {
        ...prev,
        [bookingId]: !current,
      };
    });
  };

  const isRowInBreakdownMode = (bookingId: string) => {
    if (rowBreakdownOverrides[bookingId] !== undefined) {
      return rowBreakdownOverrides[bookingId];
    }
    return showBreakdown;
  };

  // Sorting state
  type SortField = 'guest_name' | 'check_in' | 'number_of_nights' | 'nightly_rate' | 'net_payout';
  type SortDirection = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField>('check_in');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'guest_name' ? 'asc' : 'desc');
    }
  };

  const getOwnerNet = (b: Booking) => {
    if (b.owner_payout !== undefined && b.owner_payout !== null) return Number(b.owner_payout);
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    const rate = getBookingSourceInfo(b.source).ownerRate;
    return Math.round(accommodation * rate);
  };

  const getManagementFee = (b: Booking) => {
    if (b.management_fee !== undefined && b.management_fee !== null) return Number(b.management_fee);
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    const rate = getBookingSourceInfo(b.source).commissionRate;
    return Math.round(accommodation * rate);
  };

  // Filtered list with dynamically resolved status and financial horizon
  const filteredBookings = bookings.map((b) => ({
    ...b,
    status: resolveBookingStatus(b),
  })).filter((b) => {
    const matchesSearch =
      b.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.airbnb_confirmation_code &&
        b.airbnb_confirmation_code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedStatus === 'all' || b.status === selectedStatus;
    const matchesChannel =
      selectedChannel === 'all' ||
      (selectedChannel === 'airbnb' && (b.source === 'airbnb' || !b.source)) ||
      (selectedChannel === 'direct_all' && b.source?.startsWith('direct')) ||
      (selectedChannel === 'direct_10' && (b.source === 'direct' || b.source === 'direct_10')) ||
      (selectedChannel === 'direct_25' && b.source === 'direct_25');
    const matchesHorizon =
      financialHorizon === 'all' ||
      (financialHorizon === 'real' && isBookingReal(b, colDateStr)) ||
      (financialHorizon === 'future' && isBookingFuture(b, colDateStr));
    return matchesSearch && matchesStatus && matchesChannel && matchesHorizon;
  });

  // Sorted list derived from filtered bookings
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'guest_name') {
      cmp = a.guest_name.localeCompare(b.guest_name, 'es', { sensitivity: 'base' });
    } else if (sortField === 'check_in') {
      cmp = new Date(a.check_in).getTime() - new Date(b.check_in).getTime();
    } else if (sortField === 'number_of_nights') {
      cmp = (Number(a.number_of_nights) || 0) - (Number(b.number_of_nights) || 0);
    } else if (sortField === 'nightly_rate') {
      const getRate = (item: Booking) => {
        if (Number(item.number_of_nights) <= 0) return Number(item.nightly_rate) || 0;
        const ownerNet = getOwnerNet(item);
        return Math.round(ownerNet / Number(item.number_of_nights));
      };
      cmp = getRate(a) - getRate(b);
    } else if (sortField === 'net_payout') {
      cmp = getOwnerNet(a) - getOwnerNet(b);
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  // Group by month state
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  const toggleMonthCollapse = (monthKey: string) => {
    setCollapsedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const collapseAllMonths = () => {
    const allCollapsed: Record<string, boolean> = {};
    groupedBookings.forEach((g) => {
      allCollapsed[g.monthKey] = true;
    });
    setCollapsedMonths(allCollapsed);
  };

  const expandAllMonths = () => {
    setCollapsedMonths({});
  };

  const groupedBookings = useMemo(() => {
    const groups: {
      monthKey: string;
      monthLabel: string;
      bookings: typeof sortedBookings;
      totalNights: number;
      totalStays: number;
      totalOwnerNet: number;
      realOwnerNet: number;
      futureOwnerNet: number;
      realCount: number;
      futureCount: number;
      confirmedCount: number;
    }[] = [];

    const map = new Map<string, (typeof groups)[0]>();

    sortedBookings.forEach((b) => {
      const monthKey = b.check_in.substring(0, 7);
      let group = map.get(monthKey);
      if (!group) {
        group = {
          monthKey,
          monthLabel: formatMonthYear(monthKey),
          bookings: [],
          totalNights: 0,
          totalStays: 0,
          totalOwnerNet: 0,
          realOwnerNet: 0,
          futureOwnerNet: 0,
          realCount: 0,
          futureCount: 0,
          confirmedCount: 0,
        };
        map.set(monthKey, group);
        groups.push(group);
      }
      group.bookings.push(b);
      const ownerNet = getOwnerNet(b);
      group.totalOwnerNet += ownerNet;
      if (b.status !== 'cancelled') {
        if (isBookingReal(b, colDateStr)) {
          group.realOwnerNet += ownerNet;
        } else if (isBookingFuture(b, colDateStr)) {
          group.futureOwnerNet += ownerNet;
        }
      }
    });

    // Calculate unique booked nights and unique stays per month group (deduplicating duplicate rows for same stay)
    groups.forEach((group) => {
      group.totalNights = calculateUniqueBookedNights(group.bookings);
      group.totalStays = calculateUniqueStays(group.bookings);
      group.realCount = calculateUniqueStays(group.bookings.filter((b) => isBookingReal(b, colDateStr)));
      group.futureCount = calculateUniqueStays(group.bookings.filter((b) => isBookingFuture(b, colDateStr)));
      group.confirmedCount = calculateUniqueStays(
        group.bookings.filter((b) => b.status === 'confirmed' || b.status === 'checked_in')
      );
    });

    // Sort month groups:
    // If user is sorting by check_in, respect sortDirection
    // Otherwise default to newest month first (desc)
    groups.sort((a, b) => {
      if (sortField === 'check_in') {
        return sortDirection === 'asc'
          ? a.monthKey.localeCompare(b.monthKey)
          : b.monthKey.localeCompare(a.monthKey);
      }
      return b.monthKey.localeCompare(a.monthKey);
    });

    return groups;
  }, [sortedBookings, sortField, sortDirection, colDateStr]);

  // Real vs Future aggregates (excluding cancelled bookings)
  const activeBookings = useMemo(
    () => bookings.filter((b) => resolveBookingStatus(b) !== 'cancelled'),
    [bookings]
  );
  const realBookingsList = useMemo(
    () => activeBookings.filter((b) => isBookingReal(b, colDateStr)),
    [activeBookings, colDateStr]
  );
  const futureBookingsList = useMemo(
    () => activeBookings.filter((b) => isBookingFuture(b, colDateStr)),
    [activeBookings, colDateStr]
  );

  const realOwnerPayout = useMemo(
    () => realBookingsList.reduce((sum, b) => sum + getOwnerNet(b), 0),
    [realBookingsList]
  );
  const futureOwnerPayout = useMemo(
    () => futureBookingsList.reduce((sum, b) => sum + getOwnerNet(b), 0),
    [futureBookingsList]
  );
  const totalOwnerPayout = realOwnerPayout + futureOwnerPayout;

  const realManagementFee = useMemo(
    () => realBookingsList.reduce((sum, b) => sum + getManagementFee(b), 0),
    [realBookingsList]
  );
  const futureManagementFee = useMemo(
    () => futureBookingsList.reduce((sum, b) => sum + getManagementFee(b), 0),
    [futureBookingsList]
  );
  const totalManagementFee = realManagementFee + futureManagementFee;

  const realNights = useMemo(
    () => calculateUniqueBookedNights(realBookingsList),
    [realBookingsList]
  );
  const futureNights = useMemo(
    () => {
      const uniqueFuture = futureBookingsList.filter(
        (fb) => !realBookingsList.some((rb) => isSameStay(rb, fb))
      );
      return calculateUniqueBookedNights(uniqueFuture);
    },
    [futureBookingsList, realBookingsList]
  );
  const totalNights = realNights + futureNights;

  const realStaysCount = useMemo(() => calculateUniqueStays(realBookingsList), [realBookingsList]);
  const futureStaysCount = useMemo(() => calculateUniqueStays(futureBookingsList), [futureBookingsList]);
  const totalStaysCount = useMemo(() => calculateUniqueStays(bookings), [bookings]);

  // Active displayed values according to financialHorizon
  const displayedCount =
    financialHorizon === 'real'
      ? realStaysCount
      : financialHorizon === 'future'
      ? futureStaysCount
      : totalStaysCount;

  const displayedNights =
    financialHorizon === 'real'
      ? realNights
      : financialHorizon === 'future'
      ? futureNights
      : totalNights;

  const displayedManagementFee =
    financialHorizon === 'real'
      ? realManagementFee
      : financialHorizon === 'future'
      ? futureManagementFee
      : totalManagementFee;

  const displayedOwnerPayout =
    financialHorizon === 'real'
      ? realOwnerPayout
      : financialHorizon === 'future'
      ? futureOwnerPayout
      : totalOwnerPayout;

  const activeHorizonBookings =
    financialHorizon === 'real'
      ? realBookingsList
      : financialHorizon === 'future'
      ? futureBookingsList
      : activeBookings;

  const managementFeeAirbnb = activeHorizonBookings
    .filter((b) => !b.source || b.source === 'airbnb')
    .reduce((sum, b) => sum + getManagementFee(b), 0);
  const managementFeeDirect10 = activeHorizonBookings
    .filter((b) => b.source === 'direct' || b.source === 'direct_10')
    .reduce((sum, b) => sum + getManagementFee(b), 0);
  const managementFeeDirect25 = activeHorizonBookings
    .filter((b) => b.source === 'direct_25')
    .reduce((sum, b) => sum + getManagementFee(b), 0);

  const ownerPayoutAirbnb = activeHorizonBookings
    .filter((b) => !b.source || b.source === 'airbnb')
    .reduce((sum, b) => sum + getOwnerNet(b), 0);
  const ownerPayoutDirect10 = activeHorizonBookings
    .filter((b) => b.source === 'direct' || b.source === 'direct_10')
    .reduce((sum, b) => sum + getOwnerNet(b), 0);
  const ownerPayoutDirect25 = activeHorizonBookings
    .filter((b) => b.source === 'direct_25')
    .reduce((sum, b) => sum + getOwnerNet(b), 0);

  // Pie chart datasets for Bookings KPI cards
  const bookingsCountAirbnb = calculateUniqueStays(activeHorizonBookings.filter((b) => !b.source || b.source === 'airbnb'));
  const bookingsCountDirect10 = calculateUniqueStays(activeHorizonBookings.filter((b) => b.source === 'direct' || b.source === 'direct_10'));
  const bookingsCountDirect25 = calculateUniqueStays(activeHorizonBookings.filter((b) => b.source === 'direct_25'));
  const bookingsCountPieData = [
    { name: 'Airbnb', value: bookingsCountAirbnb, color: '#f43f5e' },
    { name: 'Directas (10%)', value: bookingsCountDirect10, color: '#10b981' },
    { name: 'Directas (25%)', value: bookingsCountDirect25, color: '#8b5cf6' },
  ];

  const nightsAirbnb = calculateUniqueBookedNights(activeHorizonBookings.filter((b) => !b.source || b.source === 'airbnb'));
  const nightsDirect10 = calculateUniqueBookedNights(activeHorizonBookings.filter((b) => b.source === 'direct' || b.source === 'direct_10'));
  const nightsDirect25 = calculateUniqueBookedNights(activeHorizonBookings.filter((b) => b.source === 'direct_25'));
  const nightsPieData = [
    { name: 'Airbnb', value: nightsAirbnb, color: '#f43f5e' },
    { name: 'Directas (10%)', value: nightsDirect10, color: '#10b981' },
    { name: 'Directas (25%)', value: nightsDirect25, color: '#8b5cf6' },
  ];

  const bookingsMgmtPieData = [
    { name: 'Airbnb (20%)', value: managementFeeAirbnb, color: '#f43f5e' },
    { name: 'Directas (10%)', value: managementFeeDirect10, color: '#10b981' },
    { name: 'Directas (25%)', value: managementFeeDirect25, color: '#8b5cf6' },
  ];

  const bookingsRevenuePieData = [
    { name: 'Airbnb', value: ownerPayoutAirbnb, color: '#f43f5e' },
    { name: 'Directas (10%)', value: ownerPayoutDirect10, color: '#10b981' },
    { name: 'Directas (25%)', value: ownerPayoutDirect25, color: '#8b5cf6' },
  ];

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar la reserva de ${name}?`)) {
      try {
        await deleteBookingMutation.mutateAsync(id);
        toast.success('Reserva eliminada');
      } catch {
        toast.error('No se pudo eliminar la reserva');
      }
    }
  };

  const renderSortHeader = (
    field: SortField,
    label: string,
    align: 'left' | 'center' | 'right' = 'left',
    extraAction?: React.ReactNode
  ) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-4 py-3.5 cursor-pointer select-none transition-colors hover:text-slate-900 dark:hover:text-white ${
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
        }`}
      >
        <div
          className={`inline-flex items-center gap-1.5 group ${
            align === 'center'
              ? 'justify-center'
              : align === 'right'
              ? 'justify-end'
              : 'justify-start'
          }`}
        >
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
          {extraAction}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Importar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setBookingToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Reserva</span>
          </button>
        </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {/* 1. Total Reservas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Reservas</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <MiniPieCardChart
                data={bookingsCountPieData}
                isCurrency={false}
                unitLabel="reservas"
                emptyText="Sin reservas"
              />
            </div>
          </div>
          <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{displayedCount}</p>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {financialHorizon === 'real'
                ? 'Reservas cobradas / activas'
                : financialHorizon === 'future'
                ? 'Reservas futuras por cobrar'
                : totalStaysCount === 1
                ? 'Reserva registrada'
                : 'Reservas registradas'}
            </span>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold" title="Reservas con dinero cobrado o huésped en apto">
                ✓ {realStaysCount} reales
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold" title="Reservas con fecha de check-in en el futuro">
                ⏳ {futureStaysCount} futuras
              </span>
            </div>
          </div>
        </div>

        {/* 2. Noches Totales */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Noches Totales</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                <Moon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <MiniPieCardChart
                data={nightsPieData}
                isCurrency={false}
                unitLabel="noches"
                emptyText="Sin noches"
              />
            </div>
          </div>
          <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{displayedNights} noches</p>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Noches vendidas
            </span>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ {realNights} noches reales
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                ⏳ {futureNights} noches futuras
              </span>
            </div>
          </div>
        </div>

        {/* 3. Gasto de Administración */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Gasto de Administración</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <MiniPieCardChart
                data={bookingsMgmtPieData}
                emptyText="Sin comisiones"
              />
            </div>
          </div>
          <div className="pt-2.5 mt-2 border-t border-amber-100 dark:border-amber-900/40">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              -{formatCOP(displayedManagementFee)}
            </p>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Comisión acumulada
            </span>
            <div className="mt-2 pt-2 border-t border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Real: -{formatCOP(realManagementFee)}
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                ⏳ Futuro: -{formatCOP(futureManagementFee)}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Ingresos de Alojamiento */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Ingresos de Alojamiento</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <MiniPieCardChart
                data={bookingsRevenuePieData}
                emptyText="Sin ingresos"
              />
            </div>
          </div>
          <div className="pt-2.5 mt-2 border-t border-emerald-100 dark:border-emerald-900/40">
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCOP(displayedOwnerPayout)}
            </p>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Neto acumulado
            </span>
            <div className="mt-2 pt-2 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold" title="Dinero ya recibido en cuenta de reservas en curso o completadas">
                ✓ Real en caja: {formatCOP(realOwnerPayout)}
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold" title="Dinero proyectado de reservas futuras sujetas a posible cancelación">
                ⏳ Futuro: {formatCOP(futureOwnerPayout)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por huésped o código..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {/* Financial Horizon Toggle: Todas / Solo Real / Solo Futuro */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => setFinancialHorizon('all')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                financialHorizon === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFinancialHorizon('real')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                financialHorizon === 'real'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
              title="Ver solo reservas con dinero ya cobrado (en curso o completadas)"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Solo Real</span>
            </button>
            <button
              type="button"
              onClick={() => setFinancialHorizon('future')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                financialHorizon === 'future'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
              }`}
              title="Ver solo reservas futuras por cobrar (sujetas a posible cancelación)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Solo Futuro</span>
            </button>
          </div>

          {/* Toggle Vista Neto / Desglose */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => {
                setShowBreakdown(false);
                setRowBreakdownOverrides({});
              }}
              title="Mostrar únicamente el valor neto de alojamiento"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                !showBreakdown
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>Solo Neto</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBreakdown(true);
                setRowBreakdownOverrides({});
              }}
              title="Mostrar desglose de Bruto, Aseo, Adm y Neto"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                showBreakdown
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Ver Desglose</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAllMonths}
                className="px-2.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Expandir todos los meses"
              >
                Expandir
              </button>
              <button
                type="button"
                onClick={collapseAllMonths}
                className="px-2.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Colapsar todos los meses"
              >
                Colapsar
              </button>
            </div>

            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">Todos los orígenes</option>
              <option value="airbnb">Airbnb (20%)</option>
              <option value="direct_all">Todas las Directas</option>
              <option value="direct_10">Directas (10%)</option>
              <option value="direct_25">Directas (25%)</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              <option value="all">Todos los estados</option>
              <option value="confirmed">Confirmadas</option>
              <option value="checked_in">En el Apartamento</option>
              <option value="completed">Completadas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Cargando reservas...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CalendarDays className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No se encontraron reservas con los filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <tr>
                  {renderSortHeader('guest_name', 'Huésped y Origen', 'left')}
                  {renderSortHeader('check_in', 'Check-in / Check-out', 'left')}
                  {renderSortHeader('number_of_nights', 'Noches', 'center')}
                  {renderSortHeader('nightly_rate', 'Tarifa Noche', 'right')}
                  {renderSortHeader(
                    'net_payout',
                    'Ingresos de Alojamiento',
                    'right',
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBreakdown((prev) => !prev);
                        setRowBreakdownOverrides({});
                      }}
                      title={showBreakdown ? 'Cambiar a vista Solo Neto' : 'Ver desglose de cálculo'}
                      className={`p-1 rounded-md transition-colors ml-0.5 ${
                        showBreakdown
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Calculator className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <th className="px-4 py-3.5 text-center">Estado</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {(() => {
                  const renderBookingRow = (b: typeof sortedBookings[0]) => {
                    const statusInfo = BOOKING_STATUS_CONFIG[b.status as BookingStatus] || {
                      label: b.status,
                      badgeClass: 'bg-slate-100 text-slate-800',
                    };

                    const sourceInfo = getBookingSourceInfo(b.source);
                    const ownerNet = getOwnerNet(b);
                    const realNightlyRate =
                      b.number_of_nights > 0 ? Math.round(ownerNet / Number(b.number_of_nights)) : b.nightly_rate;
                    const isBreakdown = isRowInBreakdownMode(b.id);
                    const bruto = Number(b.net_payout) || 0;
                    const aseo = Number(b.cleaning_fee_collected) || 0;
                    const admFee = getManagementFee(b);
                    const commissionPercent = Math.round(sourceInfo.commissionRate * 100);

                    return (
                      <tr
                        key={b.id}
                        data-testid="booking-row"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            booking: b,
                          });
                        }}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Guest & Channel / Code */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 ${
                                b.source === 'direct_25'
                                  ? 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300'
                                  : b.source === 'direct' || b.source === 'direct_10'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {b.guest_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                                {b.guest_name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold ${sourceInfo.badgeClass}`}>
                                  {sourceInfo.label}
                                </span>
                                {b.airbnb_confirmation_code && (
                                  <span className="text-[11px] font-mono text-slate-400">
                                    {b.airbnb_confirmation_code}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Dates */}
                        <td className="px-4 py-3.5 text-xs">
                          <div className="flex flex-col space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                              <span className="text-[10px] font-semibold text-slate-400">Entrada:</span>
                              <span className="font-medium">{formatDate(b.check_in)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                              <span className="text-[10px] font-semibold text-slate-400">Salida:</span>
                              <span className="font-medium">{formatDate(b.check_out)}</span>
                            </div>
                          </div>
                        </td>

                        {/* Nights */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            <span>{b.number_of_nights}</span>
                            <Moon className="w-3.5 h-3.5 text-amber-500 fill-amber-500/30" />
                          </span>
                        </td>

                        {/* Nightly Rate (Neto Dueño / Noches) */}
                        <td className="px-4 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300 text-xs">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatCOP(realNightlyRate)}
                            </span>
                            <span className="text-[10px] text-slate-400">neta/noche</span>
                          </div>
                        </td>

                        {/* Net Payout (Neto de Alojamiento / Desglose de Cálculo) */}
                        <td
                          className="px-4 py-3.5 text-right font-bold text-xs cursor-pointer select-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowBreakdown(b.id);
                          }}
                          title={
                            isBreakdown
                              ? 'Clic para ver solo neto'
                              : 'Clic para ver desglose de cálculo'
                          }
                        >
                          {isBreakdown ? (
                            <div className="flex flex-col items-end space-y-1 font-mono text-xs select-text">
                              <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300 w-full min-w-[150px]">
                                <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 font-normal">
                                  Bruto:
                                </span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {formatCOP(bruto)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400 w-full min-w-[150px]">
                                <span className="text-[11px] font-sans text-rose-500 dark:text-rose-400 font-normal">
                                  Aseo:
                                </span>
                                <span className="font-medium">
                                  -{formatCOP(aseo)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400 w-full min-w-[150px]">
                                <span className="text-[11px] font-sans text-amber-600 dark:text-amber-400 font-normal">
                                  Adm ({commissionPercent}%):
                                </span>
                                <span className="font-medium">
                                  -{formatCOP(admFee)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-slate-700/80 text-emerald-600 dark:text-emerald-400 w-full min-w-[150px]">
                                <span className="text-xs font-sans font-bold">Neto:</span>
                                <span className="text-sm font-bold font-sans">
                                  {formatCOP(ownerNet)}
                                </span>
                              </div>
                              <div className="pt-0.5">
                                {b.status === 'cancelled' ? (
                                  <span className="text-[10px] text-rose-500 font-medium">Cancelada</span>
                                ) : isBookingReal(b, colDateStr) ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Cobrado (Real)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400" title="Reserva futura. Aún no cobrada porque puede cancelarse">
                                    <Clock className="w-3 h-3" />
                                    <span>Por cobrar (Futuro)</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end group/cell">
                              <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold transition-transform group-hover/cell:scale-105">
                                {formatCOP(ownerNet)}
                              </span>
                              {b.status === 'cancelled' ? (
                                <span className="text-[10px] text-rose-500 font-medium">Cancelada</span>
                              ) : isBookingReal(b, colDateStr) ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Cobrado (Real)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400" title="Reserva futura. Aún no cobrada porque puede cancelarse">
                                  <Clock className="w-3 h-3" />
                                  <span>Por cobrar (Futuro)</span>
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setBookingToEdit(b);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(b.id, b.guest_name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  };

                  return groupedBookings.map((group) => {
                    const isCollapsed = !!collapsedMonths[group.monthKey];
                    return (
                      <Fragment key={group.monthKey}>
                        <tr
                          onClick={() => toggleMonthCollapse(group.monthKey)}
                          data-testid="month-group-row"
                          data-month-key={group.monthKey}
                          aria-expanded={!isCollapsed}
                          className="bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer select-none transition-colors border-y border-slate-200 dark:border-slate-700/80 font-medium"
                        >
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-transform">
                                  {isCollapsed ? (
                                    <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                                  )}
                                </div>
                                <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                                  {group.monthLabel}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                  {group.totalStays} {group.totalStays === 1 ? 'reserva' : 'reservas'}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  <Moon className="w-3 h-3 text-amber-500 fill-amber-500/30" />
                                  {group.totalNights} {group.totalNights === 1 ? 'noche' : 'noches'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                {group.realOwnerNet > 0 && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40"
                                    title="Ingresos cobrados de reservas pasadas o en curso"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Real: {formatCOP(group.realOwnerNet)}</span>
                                  </span>
                                )}
                                {group.futureOwnerNet > 0 && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/40"
                                    title="Ingresos proyectados de reservas futuras que aún no han hecho check-in"
                                  >
                                    <Clock className="w-3 h-3 text-blue-600" />
                                    <span>Futuro: {formatCOP(group.futureOwnerNet)}</span>
                                  </span>
                                )}
                                <div className="flex items-center gap-1 pl-1">
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Subtotal neto:
                                  </span>
                                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                    {formatCOP(group.totalOwnerNet)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && group.bookings.map((b) => renderBookingRow(b))}
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Context Menu (Click Derecho) */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl py-1.5 min-w-[220px] text-xs animate-in fade-in zoom-in-95 duration-100 select-none"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 200),
            left: Math.min(contextMenu.x, window.innerWidth - 230),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
            {contextMenu.booking.guest_name}
          </div>
          <button
            type="button"
            onClick={() => {
              toggleRowBreakdown(contextMenu.booking.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {isRowInBreakdownMode(contextMenu.booking.id)
                ? 'Ocultar desglose de cálculo'
                : 'Ver desglose de cálculo'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowBreakdown((prev) => !prev);
              setRowBreakdownOverrides({});
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              {showBreakdown ? 'Cambiar todas a Solo Neto' : 'Cambiar todas a Desglose'}
            </span>
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            type="button"
            onClick={() => {
              setBookingToEdit(contextMenu.booking);
              setIsModalOpen(true);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Editar reserva</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleDelete(contextMenu.booking.id, contextMenu.booking.guest_name);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar reserva</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <BookingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setBookingToEdit(null);
        }}
        bookingToEdit={bookingToEdit}
      />

      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
      />
    </div>
  );
}

