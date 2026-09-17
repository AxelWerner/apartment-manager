import React, { useState, useMemo } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Modal } from '@/components/ui/modal';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCOP, getBookingSourceInfo } from '@/lib/formatters';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import type { Booking, BookingStatus, PayoutStatus } from '@/types/database';
import { useCreateBooking, useUpdateBooking } from '@/hooks/use-bookings';
import { useProperty } from '@/hooks/use-property';
import { toast } from 'sonner';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingToEdit?: Booking | null;
}

interface BookingFormContentProps {
  bookingToEdit?: Booking | null;
  onClose: () => void;
}

function BookingFormContent({ bookingToEdit, onClose }: BookingFormContentProps) {
  const createBookingMutation = useCreateBooking();
  const updateBookingMutation = useUpdateBooking();
  const { data: property } = useProperty();

  const configuredCleaningFee = property?.default_cleaning_fee ?? 60000;
  const configuredNightlyRate = property?.default_nightly_rate ?? 280000;

  const initialSource = useMemo<'airbnb' | 'direct_10' | 'direct_25'>(() => {
    if (bookingToEdit?.source === 'direct_25') return 'direct_25';
    if (bookingToEdit?.source === 'direct' || bookingToEdit?.source === 'direct_10') return 'direct_10';
    return 'airbnb';
  }, [bookingToEdit]);

  const [source, setSource] = useState<'airbnb' | 'direct_10' | 'direct_25'>(initialSource);
  const [guestName, setGuestName] = useState(bookingToEdit?.guest_name ?? '');
  const [confirmationCode, setConfirmationCode] = useState(bookingToEdit?.airbnb_confirmation_code ?? '');
  const [guestPhone, setGuestPhone] = useState(bookingToEdit?.guest_phone ?? '');
  const [numberOfGuests, setNumberOfGuests] = useState(bookingToEdit?.number_of_guests ?? 1);
  const [checkIn, setCheckIn] = useState(bookingToEdit?.check_in ?? '');
  const [checkOut, setCheckOut] = useState(bookingToEdit?.check_out ?? '');

  const sourceInfo = getBookingSourceInfo(source);
  const isDirect = sourceInfo.isDirect;
  const adminCommissionRate = sourceInfo.commissionRate;
  const ownerPayoutRate = sourceInfo.ownerRate;

  const defaultNightlyRate = useMemo(() => {
    if (!bookingToEdit) return configuredNightlyRate;
    const accommodation = Math.max(
      0,
      Number(bookingToEdit.net_payout) - Number(bookingToEdit.cleaning_fee_collected || 0)
    );
    const rate = getBookingSourceInfo(bookingToEdit.source).ownerRate;
    return bookingToEdit.number_of_nights > 0
      ? Math.round((accommodation * rate) / Number(bookingToEdit.number_of_nights))
      : bookingToEdit.nightly_rate;
  }, [bookingToEdit, configuredNightlyRate]);

  const [cleaningFee, setCleaningFee] = useState<number>(
    bookingToEdit?.cleaning_fee_collected ?? configuredCleaningFee
  );
  const [customAirbnbFee, setCustomAirbnbFee] = useState<number | null>(
    bookingToEdit ? bookingToEdit.airbnb_service_fee : null
  );
  const [customNetPayout, setCustomNetPayout] = useState<number | null>(
    bookingToEdit ? bookingToEdit.net_payout : null
  );
  const [status, setStatus] = useState<BookingStatus>(bookingToEdit?.status ?? 'confirmed');
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus>(bookingToEdit?.payout_status ?? 'pending');
  const [notes, setNotes] = useState(bookingToEdit?.notes ?? '');

  // Auto-calculated nights
  const numberOfNights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    try {
      const days = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
      return days > 0 ? days : 0;
    } catch {
      return 0;
    }
  }, [checkIn, checkOut]);

  const fallbackNetPayout = numberOfNights > 0 ? numberOfNights * defaultNightlyRate + cleaningFee : 0;
  const effectiveNetPayout = customNetPayout !== null ? customNetPayout : fallbackNetPayout;
  const effectiveAirbnbFee = isDirect
    ? 0
    : customAirbnbFee !== null
    ? customAirbnbFee
    : Math.round(effectiveNetPayout * 0.03);
  const grossAmount = bookingToEdit?.gross_amount ?? (effectiveNetPayout + effectiveAirbnbFee);

  // Deducir el aseo al pago recibido antes de calcular la comisión de administradora (10% directa, 20% Airbnb)
  const accommodationBase = Math.max(0, effectiveNetPayout - cleaningFee);
  const effectiveManagementFee = Math.round(accommodationBase * adminCommissionRate);
  const effectiveOwnerAccommodation = Math.max(0, accommodationBase - effectiveManagementFee);
  const effectiveOwnerPayout = effectiveOwnerAccommodation; // 90% para directa, 80% para Airbnb
  const effectiveNightlyRate =
    numberOfNights > 0 ? Math.round(effectiveOwnerAccommodation / numberOfNights) : defaultNightlyRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error('Por favor ingresa el nombre del huésped');
      return;
    }
    if (!checkIn || !checkOut || numberOfNights <= 0) {
      toast.error('La fecha de check-out debe ser posterior a la de check-in');
      return;
    }

    try {
      const payload = {
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: confirmationCode.trim() || null,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim() || null,
        number_of_guests: numberOfGuests,
        check_in: checkIn,
        check_out: checkOut,
        number_of_nights: numberOfNights,
        nightly_rate: effectiveNightlyRate,
        gross_amount: grossAmount,
        cleaning_fee_collected: cleaningFee,
        airbnb_service_fee: effectiveAirbnbFee,
        taxes_withheld: 0,
        net_payout: effectiveNetPayout,
        management_fee: effectiveManagementFee,
        owner_payout: effectiveOwnerPayout,
        status,
        payout_status: payoutStatus,
        payout_date: payoutStatus === 'paid' ? checkIn : null,
        source,
        notes: notes.trim() || null,
      };

      if (bookingToEdit) {
        await updateBookingMutation.mutateAsync({
          id: bookingToEdit.id,
          updates: payload,
        });
        toast.success('Reserva actualizada correctamente');
      } else {
        await createBookingMutation.mutateAsync(payload);
        toast.success(
          isDirect
            ? 'Reserva directa registrada exitosamente'
            : 'Reserva de Airbnb registrada exitosamente'
        );
      }
      onClose();
    } catch {
      toast.error('Error al guardar la reserva');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Channel / Source Selector */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Origen de la Reserva
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setSource('airbnb')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              source === 'airbnb'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Airbnb (20%)</span>
          </button>
          <button
            type="button"
            onClick={() => setSource('direct_10')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              source === 'direct_10'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Directa (10%)</span>
          </button>
          <button
            type="button"
            onClick={() => setSource('direct_25')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              source === 'direct_25'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Directa (25%)</span>
          </button>
        </div>
      </div>

      {/* Guest Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nombre del Huésped *
          </label>
          <input
            type="text"
            required
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Ej. Juan Pérez"
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {isDirect ? 'Código / Referencia (Opcional)' : 'Código de Confirmación Airbnb'}
          </label>
          <input
            type="text"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            placeholder={isDirect ? 'Ej. DIR-2026-01' : 'Ej. HM9X7Y2Z'}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 uppercase font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Phone & Guest Count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Teléfono / WhatsApp (Opcional)
          </label>
          <input
            type="tel"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            placeholder="+57 300 123 4567"
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Número de Huéspedes
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={numberOfGuests}
            onChange={(e) => setNumberOfGuests(parseInt(e.target.value, 10) || 1)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Dates & Nights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="modal-check-in" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Check-in *
          </label>
          <input
            id="modal-check-in"
            type="date"
            required
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div>
          <label htmlFor="modal-check-out" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Check-out *
          </label>
          <input
            id="modal-check-out"
            type="date"
            required
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Noches Calculadas
          </label>
          <div className="w-full px-3 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-center">
            {numberOfNights} {numberOfNights === 1 ? 'noche' : 'noches'}
          </div>
        </div>
      </div>

      {/* Financial Breakdown (COP) */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Desglose Financiero ({isDirect ? 'Reserva Directa' : 'Airbnb'} - COP)
          </p>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isDirect
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            Comisión Admin: {Math.round(adminCommissionRate * 100)}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tarifa por Noche ($ COP)
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                (Alojamiento ÷ noches)
              </span>
            </div>
            <CurrencyInput
              value={effectiveNightlyRate}
              disabled
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold cursor-not-allowed opacity-90"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tarifa de Limpieza / Aseo ($ COP)
            </label>
            <CurrencyInput
              value={cleaningFee}
              onChange={setCleaningFee}
              placeholder="60.000"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {!isDirect ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Comisión Airbnb (~3%) ($ COP)
              </label>
              <CurrencyInput
                value={effectiveAirbnbFee}
                onChange={(val) => setCustomAirbnbFee(val)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-medium"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Comisión Plataforma ($ COP)
              </label>
              <input
                type="text"
                disabled
                value="$ 0 (Directa sin comisión Airbnb)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 font-bold cursor-not-allowed"
              />
            </div>
          )}
          <div>
            <label htmlFor="modal-net-payout" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isDirect ? 'Pago Total Recibido ($ COP) *' : 'Pago Neto Real Recibido ($ COP) *'}
            </label>
            <CurrencyInput
              id="modal-net-payout"
              value={effectiveNetPayout}
              onChange={(val) => setCustomNetPayout(val)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-800 font-bold text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        {/* Financial Breakdown Strip */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span>{isDirect ? 'Pago Total Recibido (100%):' : 'Pago Transferido por Airbnb (100%):'}</span>
            <span className="font-semibold text-slate-900 dark:text-white">{formatCOP(effectiveNetPayout)} COP</span>
          </div>
          {cleaningFee > 0 && (
            <div className="flex justify-between items-center text-slate-500 text-[11px]">
              <span>Base Alojamiento (Total - Aseo {formatCOP(cleaningFee)}):</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{formatCOP(accommodationBase)} COP</span>
            </div>
          )}
          <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
            <span>Comisión Administradora ({Math.round(adminCommissionRate * 100)}% sobre alojamiento):</span>
            <span className="font-semibold">-{formatCOP(effectiveManagementFee)} COP</span>
          </div>
          <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-bold pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <span>Valor Neto Propietario ({Math.round(ownerPayoutRate * 100)}%):</span>
            <span>{formatCOP(effectiveOwnerPayout)} COP</span>
          </div>
          {numberOfNights > 0 && (
            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5">
              <span>Tarifa Real por Noche ({numberOfNights} {numberOfNights === 1 ? 'noche' : 'noches'}):</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCOP(effectiveNightlyRate)} / noche</span>
            </div>
          )}
        </div>
      </div>

      {/* Statuses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Estado de la Estadía
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingStatus)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="confirmed">Confirmada</option>
            <option value="checked_in">En el Apartamento</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Estado del Pago
          </label>
          <select
            value={payoutStatus}
            onChange={(e) => setPayoutStatus(e.target.value as PayoutStatus)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="paid">Pagado / Recibido</option>
            <option value="pending">Pendiente por Pagar</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Notas u Observaciones
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. Reserva directa de conocidos, llegada a las 4 PM..."
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createBookingMutation.isPending || updateBookingMutation.isPending}
          className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-md transition-all disabled:opacity-50 ${
            source === 'direct_25'
              ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-600/20'
              : source === 'direct_10'
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
          }`}
        >
          {bookingToEdit
            ? 'Guardar Cambios'
            : source === 'direct_25'
            ? 'Registrar Reserva Directa (25%)'
            : source === 'direct_10'
            ? 'Registrar Reserva Directa (10%)'
            : 'Registrar Reserva Airbnb'}
        </button>
      </div>
    </form>
  );
}

export function BookingModal({ isOpen, onClose, bookingToEdit }: BookingModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        bookingToEdit
          ? 'Editar Reserva'
          : 'Nueva Reserva'
      }
      subtitle="Ingresa los datos de la estadía y el desglose de ingresos en COP"
      maxWidth="xl"
    >
      <BookingFormContent
        key={bookingToEdit?.id ?? 'new-booking'}
        bookingToEdit={bookingToEdit}
        onClose={onClose}
      />
    </Modal>
  );
}

