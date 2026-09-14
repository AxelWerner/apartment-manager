import React, { useState, useMemo } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Modal } from '@/components/ui/modal';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCOP } from '@/lib/formatters';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import type { Booking, BookingStatus, PayoutStatus } from '@/types/database';
import { useCreateBooking, useUpdateBooking } from '@/hooks/use-bookings';
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

  const [guestName, setGuestName] = useState(bookingToEdit?.guest_name ?? '');
  const [confirmationCode, setConfirmationCode] = useState(bookingToEdit?.airbnb_confirmation_code ?? '');
  const [guestPhone, setGuestPhone] = useState(bookingToEdit?.guest_phone ?? '');
  const [numberOfGuests, setNumberOfGuests] = useState(bookingToEdit?.number_of_guests ?? 1);
  const [checkIn, setCheckIn] = useState(bookingToEdit?.check_in ?? '');
  const [checkOut, setCheckOut] = useState(bookingToEdit?.check_out ?? '');
  const [nightlyRate, setNightlyRate] = useState<number>(
    bookingToEdit
      ? (bookingToEdit.number_of_nights > 0
          ? Math.round(Number(bookingToEdit.net_payout) / Number(bookingToEdit.number_of_nights))
          : bookingToEdit.nightly_rate)
      : 280000
  );
  const [cleaningFee, setCleaningFee] = useState<number>(bookingToEdit?.cleaning_fee_collected ?? 90000);
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

  // Gross accommodation total
  const grossAmount = useMemo(() => {
    return numberOfNights * nightlyRate + cleaningFee;
  }, [numberOfNights, nightlyRate, cleaningFee]);

  const effectiveAirbnbFee = customAirbnbFee !== null ? customAirbnbFee : Math.round(grossAmount * 0.03);
  const effectiveNetPayout = customNetPayout !== null ? customNetPayout : Math.max(0, grossAmount - effectiveAirbnbFee);

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
        nightly_rate: nightlyRate,
        gross_amount: grossAmount,
        cleaning_fee_collected: cleaningFee,
        airbnb_service_fee: effectiveAirbnbFee,
        taxes_withheld: 0,
        net_payout: effectiveNetPayout,
        status,
        payout_status: payoutStatus,
        payout_date: payoutStatus === 'paid' ? checkIn : null,
        source: 'airbnb',
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
        toast.success('Reserva registrada exitosamente');
      }
      onClose();
    } catch {
      toast.error('Error al guardar la reserva');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            Código de Confirmación Airbnb
          </label>
          <input
            type="text"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            placeholder="Ej. HM9X7Y2Z"
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
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Check-in *
          </label>
          <input
            type="date"
            required
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Check-out *
          </label>
          <input
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
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Desglose Financiero (COP)
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tarifa por Noche ($ COP)
            </label>
            <CurrencyInput
              value={nightlyRate}
              onChange={setNightlyRate}
              placeholder="280.000"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tarifa de Limpieza Cobrada ($ COP)
            </label>
            <CurrencyInput
              value={cleaningFee}
              onChange={setCleaningFee}
              placeholder="90.000"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pago Neto Real Recibido ($ COP) *
            </label>
            <CurrencyInput
              value={effectiveNetPayout}
              onChange={(val) => setCustomNetPayout(val)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-800 font-bold text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        {/* Quick Summary Strip */}
        <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
          <span className="text-slate-500">Ingreso Bruto Total:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {formatCOP(grossAmount)} COP
          </span>
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
          placeholder="Ej. Llegada a las 4 PM, solicitó cuna para bebé..."
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
          className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
        >
          {bookingToEdit ? 'Guardar Cambios' : 'Registrar Reserva'}
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
      title={bookingToEdit ? 'Editar Reserva' : 'Nueva Reserva de Airbnb'}
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
