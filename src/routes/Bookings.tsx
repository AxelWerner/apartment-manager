import { useState, useEffect } from 'react';
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
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calculator,
  Eye,
} from 'lucide-react';
import { useBookings, useDeleteBooking, useClearBookings } from '@/hooks/use-bookings';
import { BookingModal } from '@/components/bookings/BookingModal';
import { CsvImportModal } from '@/components/bookings/CsvImportModal';
import {
  formatCOP,
  formatDate,
  BOOKING_STATUS_CONFIG,
  resolveBookingStatus,
  getBookingSourceInfo,
} from '@/lib/formatters';
import type { Booking, BookingStatus } from '@/types/database';
import { toast } from 'sonner';

export default function Bookings() {
  const { data: bookings = [], isLoading } = useBookings();
  const deleteBookingMutation = useDeleteBooking();
  const clearBookingsMutation = useClearBookings();

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

  // Filtered list with dynamically resolved status
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
    return matchesSearch && matchesStatus && matchesChannel;
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

  // KPI aggregates
  const totalManagementFee = bookings.reduce((sum, b) => sum + getManagementFee(b), 0);
  const totalOwnerPayout = bookings.reduce((sum, b) => sum + getOwnerNet(b), 0);
  const totalNights = bookings.reduce((sum, b) => sum + (Number(b.number_of_nights) || 0), 0);

  const managementFeeAirbnb = bookings
    .filter((b) => !b.source || b.source === 'airbnb')
    .reduce((sum, b) => sum + getManagementFee(b), 0);
  const managementFeeDirect10 = bookings
    .filter((b) => b.source === 'direct' || b.source === 'direct_10')
    .reduce((sum, b) => sum + getManagementFee(b), 0);
  const managementFeeDirect25 = bookings
    .filter((b) => b.source === 'direct_25')
    .reduce((sum, b) => sum + getManagementFee(b), 0);

  const ownerPayoutAirbnb = bookings
    .filter((b) => !b.source || b.source === 'airbnb')
    .reduce((sum, b) => sum + getOwnerNet(b), 0);
  const ownerPayoutDirect10 = bookings
    .filter((b) => b.source === 'direct' || b.source === 'direct_10')
    .reduce((sum, b) => sum + getOwnerNet(b), 0);
  const ownerPayoutDirect25 = bookings
    .filter((b) => b.source === 'direct_25')
    .reduce((sum, b) => sum + getOwnerNet(b), 0);

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

  const handleClearAll = async () => {
    if (confirm('¿Deseas vaciar todas las reservas registradas para probar la importación desde cero?')) {
      try {
        await clearBookingsMutation.mutateAsync();
        toast.success('Lista de reservas vaciada');
      } catch {
        toast.error('No se pudo vaciar la lista');
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
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reservas e Ingresos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Control de estadías de Airbnb, reservas directas y carga de archivos CSV
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bookings.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              title="Vaciar reservas para probar importación"
              className="p-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
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
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Reservas</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-slate-400">
              <p>Historial y reservas activas</p>
            </div>
          </div>
          <div className="pt-2.5 mt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{bookings.length}</p>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {bookings.length === 1 ? 'Reserva registrada' : 'Reservas registradas'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Noches Totales</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                <Moon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-slate-400">
              <p>Total estadías acumuladas</p>
            </div>
          </div>
          <div className="pt-2.5 mt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{totalNights} noches</p>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Noches vendidas
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Gasto de Administración</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Airbnb (20%):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCOP(managementFeeAirbnb)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Directas (10%):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCOP(managementFeeDirect10)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Directas (25%):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCOP(managementFeeDirect25)}</span>
              </div>
            </div>
          </div>
          <div className="pt-2.5 mt-3 border-t border-amber-100 dark:border-amber-900/40">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              -{formatCOP(totalManagementFee)}
            </p>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Comisión acumulada
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Ingresos de Alojamiento</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Airbnb:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCOP(ownerPayoutAirbnb)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Directas (10%):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCOP(ownerPayoutDirect10)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Directas (25%):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCOP(ownerPayoutDirect25)}</span>
              </div>
            </div>
          </div>
          <div className="pt-2.5 mt-3 border-t border-emerald-100 dark:border-emerald-900/40">
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCOP(totalOwnerPayout)}
            </p>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Neto acumulado
            </span>
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
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
                {sortedBookings.map((b) => {
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
                          </div>
                        ) : (
                          <div className="flex flex-col items-end group/cell">
                            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold transition-transform group-hover/cell:scale-105">
                              {formatCOP(ownerNet)}
                            </span>
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
                })}
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

