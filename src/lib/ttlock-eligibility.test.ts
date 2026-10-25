import { describe, it, expect } from 'vitest';
import {
  calculateDaysDifference,
  checkBookingPinEligibility,
} from './ttlock-eligibility';
import type { Booking, BookingTtlockPin } from '@/types/database';

describe('ttlock-eligibility (2 reservations max rule)', () => {
  describe('calculateDaysDifference', () => {
    it('calculates 0 days for identical dates', () => {
      expect(calculateDaysDifference('2026-10-25', '2026-10-25')).toBe(0);
    });

    it('calculates positive days when second date is in the future', () => {
      expect(calculateDaysDifference('2026-10-25', '2026-10-28')).toBe(3);
      expect(calculateDaysDifference('2026-10-25', '2026-11-01')).toBe(7);
    });

    it('calculates negative days when second date is in the past', () => {
      expect(calculateDaysDifference('2026-10-25', '2026-10-20')).toBe(-5);
    });
  });

  describe('checkBookingPinEligibility', () => {
    const today = '2026-10-25';

    const baseBooking: Booking = {
      id: 'b-1',
      property_id: 'prop-1',
      airbnb_confirmation_code: 'HM100',
      guest_name: 'Camila Diaz',
      guest_phone: null,
      number_of_guests: 2,
      check_in: '2026-10-27',
      check_out: '2026-10-30',
      number_of_nights: 3,
      nightly_rate: 200000,
      gross_amount: 600000,
      cleaning_fee_collected: 50000,
      airbnb_service_fee: 18000,
      taxes_withheld: 0,
      net_payout: 632000,
      status: 'confirmed',
      payout_status: 'paid',
      payout_date: null,
      source: 'airbnb',
      notes: null,
    };

    it('rejects cancelled bookings', () => {
      const target: Booking = { ...baseBooking, status: 'cancelled' };
      const result = checkBookingPinEligibility(target, [target], [], today);

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('cancelled');
    });

    it('rejects completed bookings', () => {
      const target: Booking = { ...baseBooking, status: 'completed' };
      const result = checkBookingPinEligibility(target, [target], [], today);

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('completed');
    });

    it('rejects old / past bookings where check_out is prior to today', () => {
      const pastBooking: Booking = {
        ...baseBooking,
        id: 'b-past',
        check_in: '2026-10-15',
        check_out: '2026-10-20',
      };

      const result = checkBookingPinEligibility(pastBooking, [pastBooking], [], today);

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('past_booking');
      expect(result.message).toContain('Reserva pasada');
    });

    it('returns existing active pin if already generated', () => {
      const existingPin: BookingTtlockPin = {
        id: 'pin-1',
        booking_id: 'b-1',
        property_id: 'prop-1',
        pin: '849201',
        pin_type: 'one_time',
        status: 'active',
      };

      const result = checkBookingPinEligibility(baseBooking, [baseBooking], [existingPin], today);

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('already_has_pin');
      expect(result.activePin).toBe('849201');
    });

    it('rejects bookings outside the 7-day window (e.g. 10 days away)', () => {
      const farBooking: Booking = {
        ...baseBooking,
        id: 'b-far',
        check_in: '2026-11-10',
        check_out: '2026-11-14',
      };

      const result = checkBookingPinEligibility(farBooking, [farBooking], [], today);

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('not_in_7_days_window');
    });

    it('allows generation for an active stay today', () => {
      const activeBooking: Booking = {
        ...baseBooking,
        id: 'b-active',
        check_in: '2026-10-24',
        check_out: '2026-10-28',
      };

      const result = checkBookingPinEligibility(activeBooking, [activeBooking], [], today);

      expect(result.canGenerate).toBe(true);
      expect(result.isCurrentStay).toBe(true);
    });

    it('allows generation for BOTH the current stay and the first upcoming booking (2 bookings max)', () => {
      const activeBooking: Booking = {
        ...baseBooking,
        id: 'b-active',
        guest_name: 'Santiago Ramirez',
        check_in: '2026-10-24',
        check_out: '2026-10-27',
      };

      const firstUpcomingBooking: Booking = {
        ...baseBooking,
        id: 'b-upcoming-1',
        guest_name: 'Lucia Morales',
        check_in: '2026-10-28', // 3 days away
        check_out: '2026-10-31',
      };

      const allBookings = [activeBooking, firstUpcomingBooking];

      // 1. Current active booking CAN generate PIN
      const activeRes = checkBookingPinEligibility(activeBooking, allBookings, [], today);
      expect(activeRes.canGenerate).toBe(true);
      expect(activeRes.isCurrentStay).toBe(true);

      // 2. First upcoming booking in next 7 days CAN ALSO generate PIN
      const upcomingRes = checkBookingPinEligibility(firstUpcomingBooking, allBookings, [], today);
      expect(upcomingRes.canGenerate).toBe(true);
      expect(upcomingRes.isFirstUpcoming).toBe(true);
    });

    it('blocks the SECOND upcoming booking when multiple upcoming bookings are within 7 days', () => {
      const firstUpcoming: Booking = {
        ...baseBooking,
        id: 'b-up-1',
        guest_name: 'Mateo Gomez',
        check_in: '2026-10-27', // 2 days away
        check_out: '2026-10-29',
      };

      const secondUpcoming: Booking = {
        ...baseBooking,
        id: 'b-up-2',
        guest_name: 'Valentina Restrepo',
        check_in: '2026-10-30', // 5 days away
        check_out: '2026-11-02',
      };

      const all = [secondUpcoming, firstUpcoming]; // unordered input

      // First upcoming is eligible
      const firstRes = checkBookingPinEligibility(firstUpcoming, all, [], today);
      expect(firstRes.canGenerate).toBe(true);
      expect(firstRes.isFirstUpcoming).toBe(true);

      // Second upcoming is blocked (only 1 upcoming booking allowed)
      const secondRes = checkBookingPinEligibility(secondUpcoming, all, [], today);
      expect(secondRes.canGenerate).toBe(false);
      expect(secondRes.reason).toBe('not_closest_booking');
      expect(secondRes.message).toContain('Mateo Gomez');
    });

    it('handles scenario with active stay, first upcoming (eligible), and second upcoming (blocked)', () => {
      const activeBooking: Booking = {
        ...baseBooking,
        id: 'b-active',
        guest_name: 'Carlos Actual',
        check_in: '2026-10-23',
        check_out: '2026-10-26',
      };

      const firstUpcoming: Booking = {
        ...baseBooking,
        id: 'b-up-1',
        guest_name: 'Ana Proxima',
        check_in: '2026-10-27',
        check_out: '2026-10-29',
      };

      const secondUpcoming: Booking = {
        ...baseBooking,
        id: 'b-up-2',
        guest_name: 'Felipe Futuro',
        check_in: '2026-10-30',
        check_out: '2026-11-01',
      };

      const all = [secondUpcoming, activeBooking, firstUpcoming];

      // Active stay can generate PIN
      expect(checkBookingPinEligibility(activeBooking, all, [], today).canGenerate).toBe(true);

      // First upcoming can generate PIN
      expect(checkBookingPinEligibility(firstUpcoming, all, [], today).canGenerate).toBe(true);

      // Second upcoming CANNOT generate PIN
      const secondRes = checkBookingPinEligibility(secondUpcoming, all, [], today);
      expect(secondRes.canGenerate).toBe(false);
      expect(secondRes.reason).toBe('not_closest_booking');
    });

    it('isolates bookings by property_id', () => {
      const prop1Booking: Booking = {
        ...baseBooking,
        id: 'b-p1',
        property_id: 'prop-1',
        check_in: '2026-10-26',
        check_out: '2026-10-28',
      };

      const prop2Booking: Booking = {
        ...baseBooking,
        id: 'b-p2',
        property_id: 'prop-2',
        check_in: '2026-10-26',
        check_out: '2026-10-28',
      };

      const all = [prop1Booking, prop2Booking];

      // Both should be eligible for their respective properties
      const res1 = checkBookingPinEligibility(prop1Booking, all, [], today);
      expect(res1.canGenerate).toBe(true);

      const res2 = checkBookingPinEligibility(prop2Booking, all, [], today);
      expect(res2.canGenerate).toBe(true);
    });
  });
});
