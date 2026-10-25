import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Lock, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { checkBookingPinEligibility } from '@/lib/ttlock-eligibility';
import type { Booking, BookingTtlockPin } from '@/types/database';

interface TtlockPinCellProps {
  booking: Booking;
  allBookings: Booking[];
  existingPins: BookingTtlockPin[];
  todayStr: string;
  onOpenModal: (booking: Booking, pin?: BookingTtlockPin | null) => void;
}

export function TtlockPinCell({
  booking,
  allBookings,
  existingPins,
  todayStr,
  onOpenModal,
}: TtlockPinCellProps) {
  const [copied, setCopied] = useState(false);

  const eligibility = checkBookingPinEligibility(
    booking,
    allBookings,
    existingPins,
    todayStr
  );

  const handleCopy = async (e: React.MouseEvent, pin: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      toast.success(`PIN ${pin} copiado`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  // 1. PIN already generated and active
  if (eligibility.reason === 'already_has_pin' && eligibility.activePin) {
    return (
      <div className="flex items-center gap-1.5 justify-center">
        <button
          type="button"
          onClick={() => onOpenModal(booking, eligibility.activePinObj)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors shadow-2xs"
          title="Ver detalles del One-Time PIN"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{eligibility.activePin}</span>
        </button>
        <button
          type="button"
          onClick={(e) => handleCopy(e, eligibility.activePin!)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Copiar código PIN"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    );
  }

  // 2. Eligible to generate PIN (closest within 7 days or active stay)
  if (eligibility.canGenerate) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onOpenModal(booking, null)}
          data-testid="generate-pin-button"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs hover:shadow-xs transition-all active:scale-[0.98]"
          title="Generar One-Time PIN para el huésped"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Generar PIN</span>
        </button>
      </div>
    );
  }

  // 3. Waiting for previous booking to finish (inside 7-day window, but not closest)
  if (eligibility.reason === 'not_closest_booking') {
    return (
      <div className="flex justify-center">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 cursor-help"
          title={eligibility.message}
        >
          <Lock className="w-3 h-3 text-slate-400" />
          <span>En espera</span>
        </span>
      </div>
    );
  }

  // 4. Other states: cancelled, completed, or > 7 days away
  return <div className="text-center text-xs text-slate-300 dark:text-slate-600 select-none">—</div>;
}
