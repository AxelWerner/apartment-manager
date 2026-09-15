import { useState } from 'react';
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
} from 'lucide-react';
import { useBookings, useDeleteBooking, useClearBookings } from '@/hooks/use-bookings';
import { BookingModal } from '@/components/bookings/BookingModal';
import { CsvImportModal } from '@/components/bookings/CsvImportModal';
import { formatCOP, formatDate, BOOKING_STATUS_CONFIG, resolveBookingStatus } from '@/lib/formatters';
import type { Booking, BookingStatus } from '@/types/database';
import { toast } from 'sonner';

export default function Bookings() {
  const { data: bookings = [], isLoading } = useBookings();
  const deleteBookingMutation = useDeleteBooking();
  const clearBookingsMutation = useClearBookings();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);

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
    return matchesSearch && matchesStatus;
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
        const accommodation = Math.max(0, (Number(item.net_payout) || 0) - (Number(item.cleaning_fee_collected) || 0));
        return Math.round((accommodation * 0.80) / Number(item.number_of_nights));
      };
      cmp = getRate(a) - getRate(b);
    } else if (sortField === 'net_payout') {
      const getOwner = (item: Booking) => {
        const accommodation = Math.max(0, (Number(item.net_payout) || 0) - (Number(item.cleaning_fee_collected) || 0));
        return Math.round(accommodation * 0.80);
      };
      cmp = getOwner(a) - getOwner(b);
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  // KPI aggregates
  const totalAirbnbPayout = bookings.reduce((sum, b) => sum + (Number(b.net_payout) || 0), 0);
  const totalManagementFee = bookings.reduce((sum, b) => {
    if (b.management_fee !== undefined && b.management_fee !== null) return sum + Number(b.management_fee);
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    return sum + Math.round(accommodation * 0.20);
  }, 0);
  const totalOwnerPayout = bookings.reduce((sum, b) => {
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    return sum + Math.round(accommodation * 0.80);
  }, 0);
  const totalNights = bookings.reduce((sum, b) => sum + (Number(b.number_of_nights) || 0), 0);

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
    align: 'left' | 'center' | 'right' = 'left'
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
            Control de estadías, pagos netos de Airbnb y carga de archivos CSV
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Reservas</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{bookings.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Noches Totales</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{totalNights} noches</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Adm. Inmueble (20%)</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              -{formatCOP(totalManagementFee)}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Valor Neto Propietarios</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatCOP(totalOwnerPayout)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Airbnb: {formatCOP(totalAirbnbPayout)}</p>
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
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
                  {renderSortHeader('guest_name', 'Huésped y Código', 'left')}
                  {renderSortHeader('check_in', 'Check-in / Check-out', 'left')}
                  {renderSortHeader('number_of_nights', 'Noches', 'center')}
                  {renderSortHeader('nightly_rate', 'Tarifa Noche', 'right')}
                  {renderSortHeader('net_payout', 'Valor Neto', 'right')}
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

                  const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
                  const ownerNet80 = Math.round(accommodation * 0.80);
                  const realNightlyRate =
                    b.number_of_nights > 0 ? Math.round(ownerNet80 / Number(b.number_of_nights)) : b.nightly_rate;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Guest & Code */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-xs shrink-0">
                            {b.guest_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                              {b.guest_name}
                            </p>
                            {b.airbnb_confirmation_code && (
                              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {b.airbnb_confirmation_code}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {formatDate(b.check_in)}
                        </span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {formatDate(b.check_out)}
                        </span>
                      </td>

                      {/* Nights */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <span>{b.number_of_nights}</span>
                          <Moon className="w-3.5 h-3.5 text-amber-500 fill-amber-500/30" />
                        </span>
                      </td>

                      {/* Nightly Rate (Neto Dueño 80% / Noches) */}
                      <td className="px-4 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300 text-xs">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatCOP(realNightlyRate)}
                          </span>
                          <span className="text-[10px] text-slate-400">neta/noche</span>
                        </div>
                      </td>

                      {/* Net Payout (Neto Dueño 80%) */}
                      <td className="px-4 py-3.5 text-right font-bold text-xs">
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                            {formatCOP(ownerNet80)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            Airbnb: {formatCOP(b.net_payout)} <span className="text-amber-500 font-medium">(-20% & aseo)</span>
                          </span>
                        </div>
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
