import React, { useState, useMemo } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Modal } from '@/components/ui/modal';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCOP, getBookingSourceInfo } from '@/lib/formatters';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import { usePropertyContext } from '@/context/PropertyContext';
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
  const propertyCtx = usePropertyContext();
  const activePropertyId = propertyCtx?.activePropertyId || DEFAULT_PROPERTY_ID;
  const createBookingMutation = useCreateBooking();
  const updateBookingMutation = useUpdateBooking();
  const { data: property } = useProperty(activePropertyId);

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
  const [bookingDate, setBookingDate] = useState(bookingToEdit?.booking_date ?? '');
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
  const [extraAmount, setExtraAmount] = useState<number>(
    bookingToEdit?.extra_amount !== undefined && bookingToEdit?.extra_amount !== null
      ? Number(bookingToEdit.extra_amount)
      : 0
  );
  const [extraDescription, setExtraDescription] = useState<string>(
    bookingToEdit?.extra_description ?? ''
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
  const numericExtraAmount = Number(extraAmount) || 0;
  const grossAmount = bookingToEdit?.gross_amount ?? (effectiveNetPayout + effectiveAirbnbFee + numericExtraAmount);

  // Deducir el aseo al pago recibido antes de calcular la comisión de administradora (10% directa 10%, 20% Airbnb, 25% directa 25%)
  // Los cobros extras (ej. 50.000 COP por horas extra) se desglosan con la misma tasa comisionable
  const baseAccommodationBeforeExtra = Math.max(0, effectiveNetPayout - cleaningFee);
  const baseManagementFee = Math.round(baseAccommodationBeforeExtra * adminCommissionRate);
  const baseOwnerIncome = Math.max(0, baseAccommodationBeforeExtra - baseManagementFee);

  const extraManagementFee = Math.round(numericExtraAmount * adminCommissionRate);
  const extraOwnerIncome = Math.max(0, numericExtraAmount - extraManagementFee);

  const effectiveManagementFee = baseManagementFee + extraManagementFee;
  const effectiveOwnerPayout = baseOwnerIncome + extraOwnerIncome;
  const effectiveNightlyRate =
    numberOfNights > 0
      ? Math.round(baseOwnerIncome / numberOfNights)
      : defaultNightlyRate;

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
        property_id: bookingToEdit?.property_id || activePropertyId || DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: confirmationCode.trim() || null,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim() || null,
        number_of_guests: numberOfGuests,
        booking_date: bookingDate ? bookingDate : null,
        check_in: checkIn,
        check_out: checkOut,
        number_of_nights: numberOfNights,
        nightly_rate: effectiveNightlyRate,
        gross_amount: grossAmount,
        cleaning_fee_collected: cleaningFee,
        airbnb_service_fee: effectiveAirbnbFee,
        taxes_withheld: 0,
        net_payout: effectiveNetPayout,
        extra_amount: numericExtraAmount,
        extra_description: extraDescription.trim() || null,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label htmlFor="modal-booking-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Fecha de Reserva
          </label>
          <input
            id="modal-booking-date"
            type="date"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
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

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="modal-nightly-rate" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tarifa por Noche ($ COP)
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                (Alojamiento ÷ noches)
              </span>
            </div>
            <CurrencyInput
              id="modal-nightly-rate"
              value={effectiveNightlyRate}
              disabled
              placeholder="0"
              rightLabel="Tarifa noche"
              className="w-full text-left px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold cursor-not-allowed opacity-90"
            />
          </div>

          <div>
            <label htmlFor="modal-cleaning-fee" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tarifa de Limpieza / Aseo ($ COP)
            </label>
            <CurrencyInput
              id="modal-cleaning-fee"
              value={cleaningFee}
              onChange={setCleaningFee}
              placeholder="60.000"
              rightLabel="Limpieza"
              className="w-full text-left px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>

          <div>
            {!isDirect ? (
              <div>
                <label htmlFor="modal-airbnb-fee" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Comisión Airbnb (~3%) ($ COP)
                </label>
                <CurrencyInput
                  id="modal-airbnb-fee"
                  value={effectiveAirbnbFee}
                  onChange={(val) => setCustomAirbnbFee(val)}
                  placeholder="0"
                  rightLabel="Comisión Airbnb"
                  className="w-full text-left px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-medium"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="modal-platform-fee" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Comisión Plataforma ($ COP)
                </label>
                <div className="relative w-full flex items-center">
                  <input
                    id="modal-platform-fee"
                    type="text"
                    disabled
                    value="$ 0 (Directa sin comisión Airbnb)"
                    className="w-full text-left px-3 py-2 pr-32 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 font-bold cursor-not-allowed"
                  />
                  <span className="absolute right-3.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 pointer-events-none select-none">
                    Directa ($ 0)
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="modal-net-payout" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isDirect ? 'Pago Total Recibido ($ COP) *' : 'Pago Neto Real Recibido ($ COP) *'}
            </label>
            <CurrencyInput
              id="modal-net-payout"
              value={effectiveNetPayout}
              onChange={(val) => setCustomNetPayout(val)}
              placeholder="0"
              rightLabel={isDirect ? "Pago total" : "Pago neto"}
              className="w-full text-left px-3 py-2 text-sm rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-800 font-bold text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        {/* Cobro Extra / Horas Adicionales */}
        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Cobro Extra / Horas Adicionales
            </span>
            {numericExtraAmount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                +{formatCOP(numericExtraAmount)} COP • adm {Math.round(adminCommissionRate * 100)}%: {formatCOP(extraManagementFee)}
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="modal-extra-amount" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor Extra ($ COP)
              </label>
              <CurrencyInput
                id="modal-extra-amount"
                value={extraAmount}
                onChange={(val) => setExtraAmount(val || 0)}
                placeholder="0"
                rightLabel="Valor extra"
                className="w-full text-left px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="modal-extra-description" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Concepto / Motivo del Extra
              </label>
              <div className="relative w-full flex items-center">
                <input
                  id="modal-extra-description"
                  type="text"
                  value={extraDescription}
                  onChange={(e) => setExtraDescription(e.target.value)}
                  placeholder="ej. Late check-out (5 horas extra)"
                  className="w-full text-left px-3 py-2 pr-28 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
                <span className="absolute right-3.5 text-xs font-semibold text-slate-400 dark:text-slate-500 pointer-events-none select-none">
                  Motivo extra
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Breakdown Strip */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
          {/* 1. Pago base Transferido por Airbnb / Recibido */}
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span>{isDirect ? 'Pago base recibido:' : 'Pago base Transferido por Airbnb:'}</span>
            <span className="font-semibold text-slate-900 dark:text-white">{formatCOP(effectiveNetPayout)} COP</span>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700/80 my-1" />

          {/* 2. Base Alojamiento, Comisión, Ingresos base y Tarifa por noche */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center text-slate-500 text-[11px]">
              <span>
                {cleaningFee > 0
                  ? `Base Alojamiento (Total Recibido - Aseo ${formatCOP(cleaningFee)}):`
                  : 'Base Alojamiento:'}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {formatCOP(baseAccommodationBeforeExtra)} COP
              </span>
            </div>

            <div className="flex justify-between items-center text-amber-600 dark:text-amber-400 text-[11px]">
              <span>Comisión Administradora {Math.round(adminCommissionRate * 100)}%:</span>
              <span className="font-semibold">-{formatCOP(baseManagementFee)} COP</span>
            </div>

            <div className={`flex justify-between items-center ${numericExtraAmount > 0 ? 'text-slate-700 dark:text-slate-300 text-[11px]' : 'text-emerald-600 dark:text-emerald-400 font-bold'}`}>
              <span>
                {numericExtraAmount > 0
                  ? `Ingresos base de Alojamiento ${Math.round(ownerPayoutRate * 100)}%:`
                  : `Ingresos de Alojamiento ${Math.round(ownerPayoutRate * 100)}%:`}
              </span>
              <span className={numericExtraAmount > 0 ? 'font-semibold' : 'font-bold'}>
                {formatCOP(baseOwnerIncome)} COP
              </span>
            </div>

            {numberOfNights > 0 && (
              <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5">
                <span>Tarifa Real por Noche ({numberOfNights} {numberOfNights === 1 ? 'noche' : 'noches'}):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCOP(effectiveNightlyRate)} / noche</span>
              </div>
            )}
          </div>

          {/* 3. Cobro Extra y 4. Totales (cuando hay cobro extra) */}
          {numericExtraAmount > 0 && (
            <>
              {/* Cobro Extra */}
              <div className="border-t border-slate-200 dark:border-slate-700/80 my-1" />
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400 font-medium text-[11px]">
                  <span>Cobro Extra{extraDescription ? ` (${extraDescription})` : ''}:</span>
                  <span className="font-bold">+{formatCOP(numericExtraAmount)} COP</span>
                </div>
                <div className="flex justify-between items-center text-amber-600 dark:text-amber-400 text-[11px]">
                  <span>Comisión Administradora {Math.round(adminCommissionRate * 100)}%:</span>
                  <span className="font-semibold">-{formatCOP(extraManagementFee)} COP</span>
                </div>
              </div>

              {/* Totales */}
              <div className="border-t border-slate-200 dark:border-slate-700/80 my-1" />
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-amber-700 dark:text-amber-300 font-semibold">
                  <span>Total Administradora:</span>
                  <span className="font-bold">-{formatCOP(effectiveManagementFee)} COP</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-bold text-sm pt-0.5">
                  <span>Total Ingresos de Alojamiento:</span>
                  <span>{formatCOP(effectiveOwnerPayout)} COP</span>
                </div>
              </div>
            </>
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

