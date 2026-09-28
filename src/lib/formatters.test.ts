import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCOP,
  parseCOP,
  formatDate,
  formatMonthYear,
  resolveBookingStatus,
  isBookingReal,
  isBookingFuture,
  isExpenseReal,
  isExpenseFuture,
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

    it('marks booking on check-out day before 12:00 as checked_in', () => {
      // 2026-09-15 10:00 Bogota time (UTC-5 -> 15:00 UTC)
      vi.setSystemTime(new Date('2026-09-15T15:00:00Z'));

      const status = resolveBookingStatus({
        check_in: '2026-09-10',
        check_out: '2026-09-15',
      });
      expect(status).toBe('checked_in');
    });

    it('marks booking on check-out day after 12:00 as completed', () => {
      // 2026-09-15 13:00 Bogota time (UTC-5 -> 18:00 UTC)
      vi.setSystemTime(new Date('2026-09-15T18:00:00Z'));

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
});
