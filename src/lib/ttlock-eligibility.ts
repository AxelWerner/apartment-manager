import type { Booking, BookingTtlockPin } from '@/types/database';

export interface PinEligibilityResult {
  canGenerate: boolean;
  reason?:
    | 'already_has_pin'
    | 'cancelled'
    | 'completed'
    | 'past_booking'
    | 'not_in_7_days_window'
    | 'not_closest_booking'
    | 'no_lock_configured';
  message: string;
  activePin?: string;
  activePinObj?: BookingTtlockPin;
  isClosest: boolean;
  isCurrentStay?: boolean;
  isFirstUpcoming?: boolean;
}

/**
 * Calculates whole days difference between two ISO date strings (YYYY-MM-DD).
 * Positive if toDateStr is in the future relative to fromDateStr.
 */
export function calculateDaysDifference(fromDateStr: string, toDateStr: string): number {
  const [y1, m1, d1] = fromDateStr.split('-').map(Number);
  const [y2, m2, d2] = toDateStr.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((t2 - t1) / MS_PER_DAY);
}

/**
 * Evaluates whether a target booking is currently eligible for a TTLock One-Time Passcode.
 *
 * Rules:
 * 1. Booking cannot be cancelled or completed.
 * 2. Old/past bookings (check_out < today) CANNOT generate a PIN.
 * 3. If it already has an active/mock PIN, further generation is disabled and the existing PIN is returned.
 * 4. AT MOST 2 RESERVATIONS per property can have PIN generation enabled at any time:
 *    - Case 1: If there is an active reservation currently (check_in <= today <= check_out), it CAN generate PIN.
 *    - Case 2: If there are reservations starting within the next 7 days, ONLY the FIRST upcoming reservation CAN generate PIN.
 *    - Any subsequent upcoming reservation in the 7-day window is temporarily blocked.
 */
export function checkBookingPinEligibility(
  targetBooking: Booking,
  allPropertyBookings: Booking[],
  existingPins: BookingTtlockPin[] = [],
  todayStr: string
): PinEligibilityResult {
  // 1. Status validation
  if (targetBooking.status === 'cancelled') {
    return {
      canGenerate: false,
      reason: 'cancelled',
      message: 'Reserva cancelada',
      isClosest: false,
    };
  }

  if (targetBooking.status === 'completed') {
    return {
      canGenerate: false,
      reason: 'completed',
      message: 'Reserva completada',
      isClosest: false,
    };
  }

  // 2. Existing active PIN check
  const currentPin = existingPins.find(
    (p) =>
      p.booking_id === targetBooking.id &&
      (p.status === 'active' || p.status === 'mock')
  );

  if (currentPin) {
    return {
      canGenerate: false,
      reason: 'already_has_pin',
      message: `PIN activo: ${currentPin.pin}`,
      activePin: currentPin.pin,
      activePinObj: currentPin,
      isClosest: true,
    };
  }

  // 3. Reject old / past bookings (check_out < todayStr)
  if (targetBooking.check_out < todayStr) {
    return {
      canGenerate: false,
      reason: 'past_booking',
      message: 'Reserva pasada (no disponible para generar PIN)',
      isClosest: false,
    };
  }

  // 4. Filter candidate bookings for the same property
  const propertyCandidates = allPropertyBookings.filter(
    (b) =>
      (!targetBooking.property_id || b.property_id === targetBooking.property_id) &&
      b.status !== 'cancelled' &&
      b.status !== 'completed'
  );

  // Check Case 1: Is target booking the current active stay? (check_in <= today <= check_out)
  const currentActiveStay = propertyCandidates.find(
    (b) => b.check_in <= todayStr && b.check_out >= todayStr
  );

  if (currentActiveStay && currentActiveStay.id === targetBooking.id) {
    return {
      canGenerate: true,
      message: 'Reserva activa hoy: lista para generar One-Time PIN',
      isClosest: true,
      isCurrentStay: true,
    };
  }

  // Check Case 2: First upcoming reservation in the next 7 days (check_in > today and <= 7 days)
  const upcomingCandidates = propertyCandidates
    .filter((b) => {
      const daysUntilCheckIn = calculateDaysDifference(todayStr, b.check_in);
      return b.check_in > todayStr && daysUntilCheckIn >= 0 && daysUntilCheckIn <= 7;
    })
    .sort((a, b) => {
      const checkInDiff = a.check_in.localeCompare(b.check_in);
      if (checkInDiff !== 0) return checkInDiff;
      return a.check_out.localeCompare(b.check_out);
    });

  const upcomingIndex = upcomingCandidates.findIndex((b) => b.id === targetBooking.id);

  if (upcomingIndex === -1) {
    return {
      canGenerate: false,
      reason: 'not_in_7_days_window',
      message: 'Solo disponible para la estancia activa o la primera reserva en los próximos 7 días',
      isClosest: false,
    };
  }

  if (upcomingIndex === 0) {
    return {
      canGenerate: true,
      message: 'Primera reserva próxima (≤ 7 días): lista para generar One-Time PIN',
      isClosest: true,
      isFirstUpcoming: true,
    };
  }

  // Subsequent upcoming reservation within 7 days
  const firstUpcoming = upcomingCandidates[0];
  return {
    canGenerate: false,
    reason: 'not_closest_booking',
    message: `Bloqueado: Solo se habilita para la primera reserva próxima (${firstUpcoming.guest_name} - ${firstUpcoming.check_in})`,
    isClosest: false,
  };
}
