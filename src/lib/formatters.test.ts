import { describe, it, expect } from 'vitest';
import {
  formatCOP,
  parseCOP,
  formatDate,
  formatMonthYear,
  resolveBookingStatus,
  getBookingYear,
  isBookingReal,
  isBookingFuture,
  isExpenseReal,
  isExpenseFuture,
  isDirectBooking,
  isAirbnbBooking,
  isSameStay,
  calculateUniqueBookedNights,
  calculateUniqueStays,
  groupBookingsByStay,
} from './formatters';

describe('formatters', () => {
  describe('formatCOP', () => {
    it('formats numbers into Colombian Pesos with 2 decimal places', () => {
      const result = formatCOP(1500000);
      // In es-CO, formatting is $ 1.500.000,00 or includes non-breaking space
      expect(result).toMatch(/\$?\s?1\.500\.000,00/);
    });

    it('appends COP suffix when includeCurrencySuffix is true', () => {
      const result = formatCOP(250000, true);
      expect(result).toContain('COP');
      expect(result).toMatch(/\$?\s?250\.000,00\s?COP/);
    });

    it('handles null, undefined and NaN safely returning $ 0,00', () => {
      expect(formatCOP(null)).toBe('$ 0,00');
      expect(formatCOP(undefined)).toBe('$ 0,00');
      expect(formatCOP(NaN)).toBe('$ 0,00');
    });

    it('formats zero correctly with 2 decimals', () => {
      const result = formatCOP(0);
      expect(result).toMatch(/\$?\s?0,00/);
    });
  });

  describe('parseCOP', () => {
    it('extracts clean integer from formatted currency string', () => {
      expect(parseCOP('$ 1.500.000')).toBe(1500000);
      expect(parseCOP('$ 1.500.000,00')).toBe(1500000);
      expect(parseCOP('COP 350.000,50')).toBe(350000.5);
      expect(parseCOP('2.800.000 COP')).toBe(2800000);
    });

    it('returns the number unchanged if already a number', () => {
      expect(parseCOP(50000)).toBe(50000);
    });

    it('returns 0 for empty or non-numeric strings', () => {
      expect(parseCOP('')).toBe(0);
      expect(parseCOP('abc')).toBe(0);
    });
  });

  describe('formatDate', () => {
    it('formats ISO date string into readable Spanish format', () => {
      const result = formatDate('2026-09-15');
      expect(result.toLowerCase()).toContain('15');
      expect(result.toLowerCase()).toContain('sep');
      expect(result).toContain('2026');
    });

    it('returns dash for null or undefined', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
    });
  });

  describe('formatMonthYear', () => {
    it('formats YYYY-MM into capitalized Spanish month and year', () => {
      const result = formatMonthYear('2026-09');
      expect(result.toLowerCase()).toContain('septiembre');
      expect(result).toContain('2026');
    });

    it('returns dash for null or undefined', () => {
      expect(formatMonthYear(null)).toBe('—');
      expect(formatMonthYear(undefined)).toBe('—');
    });
  });

  describe('resolveBookingStatus', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('preserves cancelled status regardless of dates', () => {
      const status = resolveBookingStatus({
        status: 'cancelled',
        check_in: '2026-01-01',
        check_out: '2026-01-05',
      });
      expect(status).toBe('cancelled');
    });

    it('marks future bookings as confirmed', () => {
      // Mock system time to 2026-09-01 10:00:00 Bogota time (UTC-5 -> 15:00 UTC)
      vi.setSystemTime(new Date('2026-09-01T15:00:00Z'));

      const status = resolveBookingStatus({
        check_in: '2026-09-10',
        check_out: '2026-09-15',
      });
      expect(status).toBe('confirmed');
    });

    it('marks past bookings as completed', () => {
      // Mock system time to 2026-09-20 10:00:00 Bogota time
      vi.setSystemTime(new Date('2026-09-20T15:00:00Z'));

      const status = resolveBookingStatus({
        check_in: '2026-09-10',
        check_out: '2026-09-15',
      });
      expect(status).toBe('completed');
    });

    it('marks booking on check-in day before 14:00 as confirmed', () => {
      // 2026-09-10 11:00 Bogota time (UTC-5 -> 16:00 UTC)
      vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));

      const status = resolveBookingStatus({
        check_in: '2026-09-10',
        check_out: '2026-09-15',
      });
      expect(status).toBe('confirmed');
    });

    it('marks booking on check-in day after 14:00 as checked_in', () => {
      // 2026-09-10 15:00 Bogota time (UTC-5 -> 20:00 UTC)
      vi.setSystemTime(new Date('2026-09-10T20:00:00Z'));

      const status = resolveBookingStatus({
        check_in: '2026-09-10',
        check_out: '2026-09-15',
      });
      expect(status).toBe('checked_in');
    });

    it('marks booking on check-out day as checked_in throughout the stay', () => {
      // 2026-09-15 15:00 Bogota time (UTC-5 -> 20:00 UTC)
      vi.setSystemTime(new Date('2026-09-15T20:00:00Z'));

      const status = resolveBookingStatus({
        check_in: '2026-09-10',
        check_out: '2026-09-15',
      });
      expect(status).toBe('checked_in');
    });

    it('marks booking on check-in day before 14:00 as checked_in if manually marked as checked_in', () => {
      // 2026-09-10 10:00 Bogota time (UTC-5 -> 15:00 UTC)
      vi.setSystemTime(new Date('2026-09-10T15:00:00Z'));

      const status = resolveBookingStatus({
        status: 'checked_in',
        check_in: '2026-09-10',
        check_out: '2026-09-15',
      });
      expect(status).toBe('checked_in');
    });

    it('marks booking after check-out date as completed', () => {
      // 2026-09-16 08:00 Bogota time (UTC-5 -> 13:00 UTC)
      vi.setSystemTime(new Date('2026-09-16T13:00:00Z'));

      const status = resolveBookingStatus({
        check_in: '2026-09-10',
        check_out: '2026-09-15',
      });
      expect(status).toBe('completed');
    });
  });

  describe('Real vs Future Financial Classification', () => {
    it('identifies past or completed bookings as real', () => {
      expect(
        isBookingReal({
          check_in: '2026-09-01',
          check_out: '2026-09-05',
          status: 'completed',
        }, '2026-09-28')
      ).toBe(true);

      expect(
        isBookingFuture({
          check_in: '2026-09-01',
          check_out: '2026-09-05',
          status: 'completed',
        }, '2026-09-28')
      ).toBe(false);
    });

    it('identifies paid bookings as real regardless of date', () => {
      expect(
        isBookingReal({
          check_in: '2026-10-15',
          check_out: '2026-10-20',
          payout_status: 'paid',
        }, '2026-09-28')
      ).toBe(true);

      expect(
        isBookingFuture({
          check_in: '2026-10-15',
          check_out: '2026-10-20',
          payout_status: 'paid',
        }, '2026-09-28')
      ).toBe(false);
    });

    it('identifies future unpaid bookings as future', () => {
      expect(
        isBookingReal({
          check_in: '2026-10-15',
          check_out: '2026-10-20',
          payout_status: 'pending',
          status: 'confirmed',
        }, '2026-09-28')
      ).toBe(false);

      expect(
        isBookingFuture({
          check_in: '2026-10-15',
          check_out: '2026-10-20',
          payout_status: 'pending',
          status: 'confirmed',
        }, '2026-09-28')
      ).toBe(true);
    });

    it('identifies cancelled bookings as neither real nor future revenue', () => {
      expect(
        isBookingReal({
          check_in: '2026-10-15',
          check_out: '2026-10-20',
          status: 'cancelled',
        }, '2026-09-28')
      ).toBe(false);

      expect(
        isBookingFuture({
          check_in: '2026-10-15',
          check_out: '2026-10-20',
          status: 'cancelled',
        }, '2026-09-28')
      ).toBe(false);
    });

    it('classifies expenses based on payment status', () => {
      expect(isExpenseReal({ payment_status: 'paid' })).toBe(true);
      expect(isExpenseFuture({ payment_status: 'paid' })).toBe(false);

      expect(isExpenseReal({ payment_status: 'pending' })).toBe(false);
      expect(isExpenseFuture({ payment_status: 'pending' })).toBe(true);

      expect(isExpenseReal({ payment_status: 'scheduled' })).toBe(false);
      expect(isExpenseFuture({ payment_status: 'scheduled' })).toBe(true);
    });
  });

  describe('getBookingYear', () => {
    it('extracts year from ISO date strings (YYYY-MM-DD)', () => {
      expect(getBookingYear('2026-09-11')).toBe('2026');
      expect(getBookingYear('2025-01-01')).toBe('2025');
      expect(getBookingYear('2027-12-31')).toBe('2027');
    });

    it('extracts year from slash/period formatted dates (MM/DD/YYYY or DD.MM.YYYY)', () => {
      expect(getBookingYear('09/11/2026')).toBe('2026');
      expect(getBookingYear('11.09.2026')).toBe('2026');
      expect(getBookingYear('2026/09/11')).toBe('2026');
    });

    it('returns null for empty, invalid, or missing date strings', () => {
      expect(getBookingYear('')).toBeNull();
      expect(getBookingYear(null)).toBeNull();
      expect(getBookingYear(undefined)).toBeNull();
      expect(getBookingYear('invalid-date')).toBeNull();
    });
  });

  describe('isDirectBooking and isAirbnbBooking', () => {
    it('identifies direct bookings correctly', () => {
      expect(isDirectBooking('direct')).toBe(true);
      expect(isDirectBooking('direct_10')).toBe(true);
      expect(isDirectBooking('direct_25')).toBe(true);
      expect(isDirectBooking('direct_custom')).toBe(true);
      expect(isDirectBooking({ source: 'direct' })).toBe(true);
      expect(isDirectBooking({ source: 'direct_10' })).toBe(true);
      expect(isDirectBooking({ source: 'direct_25' })).toBe(true);
    });

    it('identifies airbnb bookings correctly', () => {
      expect(isDirectBooking('airbnb')).toBe(false);
      expect(isDirectBooking(null)).toBe(false);
      expect(isDirectBooking(undefined)).toBe(false);
      expect(isDirectBooking({ source: 'airbnb' })).toBe(false);
      expect(isDirectBooking({ source: null })).toBe(false);
      expect(isDirectBooking({})).toBe(false);

      expect(isAirbnbBooking('airbnb')).toBe(true);
      expect(isAirbnbBooking(null)).toBe(true);
      expect(isAirbnbBooking(undefined)).toBe(true);
      expect(isAirbnbBooking({ source: 'airbnb' })).toBe(true);
      expect(isAirbnbBooking({ source: null })).toBe(true);
      expect(isAirbnbBooking({})).toBe(true);

      expect(isAirbnbBooking('direct')).toBe(false);
      expect(isAirbnbBooking({ source: 'direct' })).toBe(false);
      expect(isAirbnbBooking({ source: 'direct_10' })).toBe(false);
      expect(isAirbnbBooking({ source: 'direct_25' })).toBe(false);
    });
  });

  describe('isSameStay', () => {
    it('returns true when dates and confirmation code match', () => {
      const a = {
        check_in: '2026-09-01',
        check_out: '2026-09-25',
        airbnb_confirmation_code: 'HMABC123',
        guest_name: 'Carlos Ruiz',
      };
      const b = {
        check_in: '2026-09-01',
        check_out: '2026-09-25',
        airbnb_confirmation_code: 'hmabc123',
        guest_name: 'Carlos',
      };
      expect(isSameStay(a, b)).toBe(true);
    });

    it('returns true when dates and guest name match (even if codes differ or null)', () => {
      const a = {
        check_in: '2026-09-01',
        check_out: '2026-09-25',
        airbnb_confirmation_code: null,
        guest_name: 'Carlos Ruiz',
      };
      const b = {
        check_in: '2026-09-01',
        check_out: '2026-09-25',
        airbnb_confirmation_code: 'HMXYZ999',
        guest_name: 'carlos ruiz',
      };
      expect(isSameStay(a, b)).toBe(true);
    });

    it('returns false when dates differ even if confirmation code or guest matches', () => {
      const a = {
        check_in: '2026-09-01',
        check_out: '2026-09-25',
        airbnb_confirmation_code: 'HMABC123',
        guest_name: 'Carlos Ruiz',
      };
      const b = {
        check_in: '2026-09-26',
        check_out: '2026-09-30',
        airbnb_confirmation_code: 'HMABC123',
        guest_name: 'Carlos Ruiz',
      };
      expect(isSameStay(a, b)).toBe(false);
    });

    it('returns false when properties differ', () => {
      const a = {
        property_id: 'prop-1',
        check_in: '2026-09-01',
        check_out: '2026-09-25',
        airbnb_confirmation_code: null,
        guest_name: 'Carlos Ruiz',
      };
      const b = {
        property_id: 'prop-2',
        check_in: '2026-09-01',
        check_out: '2026-09-25',
        airbnb_confirmation_code: null,
        guest_name: 'Carlos Ruiz',
      };
      expect(isSameStay(a, b)).toBe(false);
    });
  });

  describe('calculateUniqueBookedNights', () => {
    it('counts nights once when duplicate rows exist for the same stay', () => {
      const bookings = [
        {
          id: 'b1',
          check_in: '2026-09-01',
          check_out: '2026-09-25',
          number_of_nights: 24,
          airbnb_confirmation_code: 'HMABC123',
          guest_name: 'Carlos Ruiz',
        },
        {
          id: 'b2',
          check_in: '2026-09-01',
          check_out: '2026-09-25',
          number_of_nights: 24,
          airbnb_confirmation_code: 'HMABC123',
          guest_name: 'Carlos Ruiz',
        },
      ];
      // Instead of 48 nights, should only count 24
      expect(calculateUniqueBookedNights(bookings)).toBe(24);
    });

    it('handles multiple stays correctly, keeping unique nights for each', () => {
      const bookings = [
        {
          id: 'b1',
          check_in: '2026-09-01',
          check_out: '2026-09-05',
          number_of_nights: 4,
          airbnb_confirmation_code: 'HM1',
          guest_name: 'Ana',
        },
        {
          id: 'b1-dup',
          check_in: '2026-09-01',
          check_out: '2026-09-05',
          number_of_nights: 4,
          airbnb_confirmation_code: 'HM1',
          guest_name: 'Ana',
        },
        {
          id: 'b2',
          check_in: '2026-09-10',
          check_out: '2026-09-15',
          number_of_nights: 5,
          airbnb_confirmation_code: 'HM2',
          guest_name: 'Pedro',
        },
      ];
      // 4 + 5 = 9 nights (not 4 + 4 + 5 = 13)
      expect(calculateUniqueBookedNights(bookings)).toBe(9);
    });

    it('ignores cancelled bookings', () => {
      const bookings = [
        {
          id: 'b1',
          check_in: '2026-09-01',
          check_out: '2026-09-05',
          number_of_nights: 4,
          airbnb_confirmation_code: 'HM1',
          guest_name: 'Ana',
          status: 'cancelled' as const,
        },
      ];
      expect(calculateUniqueBookedNights(bookings)).toBe(0);
    });

    it('falls back to date diff when number_of_nights is 0', () => {
      const bookings = [
        {
          id: 'b1',
          check_in: '2026-09-01',
          check_out: '2026-09-05',
          number_of_nights: 0,
          airbnb_confirmation_code: 'HM1',
          guest_name: 'Ana',
        },
      ];
      expect(calculateUniqueBookedNights(bookings)).toBe(4);
    });
  });

  describe('calculateUniqueStays and groupBookingsByStay', () => {
    it('counts 1 stay when duplicate rows exist for the same check-in date', () => {
      const bookings = [
        {
          id: 'b1',
          check_in: '2026-09-21',
          check_out: '2026-09-25',
          airbnb_confirmation_code: 'HMNW3MBSYD',
          guest_name: 'Yeferson Valencia',
        },
        {
          id: 'b2',
          check_in: '2026-09-21',
          check_out: '2026-09-25',
          airbnb_confirmation_code: 'HMNW3MBSYD',
          guest_name: 'Yeferson Valencia',
        },
      ];

      expect(calculateUniqueStays(bookings)).toBe(1);
      const groups = groupBookingsByStay(bookings);
      expect(groups.length).toBe(1);
      expect(groups[0].length).toBe(2);
    });

    it('correctly calculates 7 stays when given 8 booking rows with 1 duplicate on the same day', () => {
      const bookings = [
        { id: '1', check_in: '2026-09-09', check_out: '2026-09-11', guest_name: 'Liliana Nieto' },
        { id: '2', check_in: '2026-09-11', check_out: '2026-09-14', guest_name: 'Laura Gomez' },
        { id: '3', check_in: '2026-09-14', check_out: '2026-09-17', guest_name: 'Julian Ruiz' },
        { id: '4', check_in: '2026-09-18', check_out: '2026-09-21', guest_name: 'Juan Camilo' },
        { id: '5', check_in: '2026-09-21', check_out: '2026-09-25', guest_name: 'Yeferson Valencia', airbnb_confirmation_code: 'HMNW3MBSYD' },
        { id: '6', check_in: '2026-09-21', check_out: '2026-09-25', guest_name: 'Yeferson Valencia', airbnb_confirmation_code: 'HMNW3MBSYD' },
        { id: '7', check_in: '2026-09-25', check_out: '2026-09-28', guest_name: 'Juan Amaya' },
        { id: '8', check_in: '2026-09-29', check_out: '2026-10-01', guest_name: 'Alejandro Urieles' },
      ];

      // 8 rows, but exactly 7 unique stays!
      expect(calculateUniqueStays(bookings)).toBe(7);
      expect(calculateUniqueBookedNights(bookings)).toBe(20);
    });

    it('does not merge back-to-back stays where check-out equals next check-in', () => {
      const bookings = [
        { id: '1', check_in: '2026-09-09', check_out: '2026-09-11', guest_name: 'Liliana Nieto' },
        { id: '2', check_in: '2026-09-11', check_out: '2026-09-14', guest_name: 'Laura Gomez' },
      ];

      expect(isSameStay(bookings[0], bookings[1])).toBe(false);
      expect(calculateUniqueStays(bookings)).toBe(2);
    });

    it('ignores cancelled bookings when calculating unique stays', () => {
      const bookings = [
        { id: '1', check_in: '2026-09-01', check_out: '2026-09-05', guest_name: 'Ana', status: 'cancelled' as const },
        { id: '2', check_in: '2026-09-10', check_out: '2026-09-15', guest_name: 'Pedro' },
      ];

      expect(calculateUniqueStays(bookings)).toBe(1);
    });
  });
});
