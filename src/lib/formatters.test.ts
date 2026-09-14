import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCOP,
  parseCOP,
  formatDate,
  formatMonthYear,
  resolveBookingStatus,
} from './formatters';

describe('formatters', () => {
  describe('formatCOP', () => {
    it('formats numbers into Colombian Pesos without decimal cents', () => {
      const result = formatCOP(1500000);
      // In es-CO, formatting is $ 1.500.000 or includes non-breaking space
      expect(result).toMatch(/\$?\s?1\.500\.000/);
    });

    it('appends COP suffix when includeCurrencySuffix is true', () => {
      const result = formatCOP(250000, true);
      expect(result).toContain('COP');
    });

    it('handles null, undefined and NaN safely returning $ 0', () => {
      expect(formatCOP(null)).toBe('$ 0');
      expect(formatCOP(undefined)).toBe('$ 0');
      expect(formatCOP(NaN)).toBe('$ 0');
    });

    it('formats zero correctly', () => {
      const result = formatCOP(0);
      expect(result).toMatch(/\$?\s?0/);
    });
  });

  describe('parseCOP', () => {
    it('extracts clean integer from formatted currency string', () => {
      expect(parseCOP('$ 1.500.000')).toBe(1500000);
      expect(parseCOP('COP 350.000')).toBe(350000);
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
});
