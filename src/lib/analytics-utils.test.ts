import { describe, it, expect } from 'vitest';
import {
  calculateLeadTimeDays,
  getBookingEffectiveNightlyRate,
  calculateMonthAnalytics,
  calculateMoMComparison,
  getAvailableMonths,
} from './analytics-utils';
import type { Booking } from '@/types/database';

describe('analytics-utils', () => {
  describe('calculateLeadTimeDays', () => {
    it('calculates exact lead time between booking date and check-in date', () => {
      // Booked 14 days in advance
      expect(calculateLeadTimeDays('2026-09-15', '2026-09-01')).toBe(14);
      // Same day booking
      expect(calculateLeadTimeDays('2026-09-09', '2026-09-09')).toBe(0);
      // Booked 1 day in advance
      expect(calculateLeadTimeDays('2026-09-10', '2026-09-09')).toBe(1);
    });

    it('returns null if bookingDate is null or undefined or empty', () => {
      expect(calculateLeadTimeDays('2026-09-15', null)).toBeNull();
      expect(calculateLeadTimeDays('2026-09-15', undefined)).toBeNull();
      expect(calculateLeadTimeDays('2026-09-15', '')).toBeNull();
      expect(calculateLeadTimeDays('', '2026-09-01')).toBeNull();
    });

    it('clamps negative differences to 0 if booking date is recorded after check-in', () => {
      expect(calculateLeadTimeDays('2026-09-01', '2026-09-05')).toBe(0);
    });
  });

  describe('getBookingEffectiveNightlyRate', () => {
    it('uses nightly_rate if provided and positive', () => {
      const b: Partial<Booking> = {
        nightly_rate: 320000,
        net_payout: 960000,
        number_of_nights: 3,
      };
      expect(getBookingEffectiveNightlyRate(b as Booking)).toBe(320000);
    });

    it('derives nightly rate from net_payout minus cleaning fee if nightly_rate is missing', () => {
      const b: Partial<Booking> = {
        nightly_rate: 0,
        net_payout: 720000,
        cleaning_fee_collected: 60000,
        number_of_nights: 3,
      };
      // (720000 - 60000) / 3 = 220000
      expect(getBookingEffectiveNightlyRate(b as Booking)).toBe(220000);
    });
  });

  describe('calculateMonthAnalytics', () => {
    const mockBookings: Booking[] = [
      {
        id: 'b1',
        property_id: 'prop-1',
        airbnb_confirmation_code: 'HM111',
        guest_name: 'Ana Gomez',
        guest_phone: null,
        number_of_guests: 2,
        booking_date: '2026-08-25', // 7 days lead time
        check_in: '2026-09-01',
        check_out: '2026-09-05', // 4 nights in Sep (1, 2, 3, 4)
        number_of_nights: 4,
        nightly_rate: 300000,
        gross_amount: 1260000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 36000,
        taxes_withheld: 0,
        net_payout: 1200000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: '2026-09-02',
        source: 'airbnb',
        notes: null,
      },
      {
        id: 'b2',
        property_id: 'prop-1',
        airbnb_confirmation_code: null,
        guest_name: 'Carlos Ruiz',
        guest_phone: null,
        number_of_guests: 3,
        booking_date: '2026-09-08', // 2 days lead time
        check_in: '2026-09-10',
        check_out: '2026-09-16', // 6 nights in Sep (10, 11, 12, 13, 14, 15)
        number_of_nights: 6,
        nightly_rate: 280000,
        gross_amount: 1740000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 0,
        taxes_withheld: 0,
        net_payout: 1680000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: '2026-09-11',
        source: 'direct',
        notes: null,
      },
      {
        id: 'b3-cross',
        property_id: 'prop-1',
        airbnb_confirmation_code: 'HM222',
        guest_name: 'David Silva',
        guest_phone: null,
        number_of_guests: 2,
        booking_date: '2026-09-15', // 13 days lead time
        check_in: '2026-09-28',
        check_out: '2026-10-03', // 5 nights total: 2 nights in Sep (28, 29, 30? Sept has 30 days -> 28, 29, 30 = 3 nights in Sep: night of 28, 29, 30)
        number_of_nights: 5,
        nightly_rate: 350000,
        gross_amount: 1810000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 50000,
        taxes_withheld: 0,
        net_payout: 1750000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: '2026-09-29',
        source: 'airbnb',
        notes: null,
      },
      {
        id: 'b-cancelled',
        property_id: 'prop-1',
        airbnb_confirmation_code: 'HMCANC',
        guest_name: 'Ignorado Cancelado',
        guest_phone: null,
        number_of_guests: 1,
        booking_date: '2026-09-01',
        check_in: '2026-09-20',
        check_out: '2026-09-25',
        number_of_nights: 5,
        nightly_rate: 400000,
        gross_amount: 2000000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 50000,
        taxes_withheld: 0,
        net_payout: 1950000,
        status: 'cancelled',
        payout_status: 'pending',
        payout_date: null,
        source: 'airbnb',
        notes: null,
      },
    ];

    it('calculates correct occupancy, ADR, RevPAR, LOS, and Lead Time for September 2026 (30 days)', () => {
      const stats = calculateMonthAnalytics(mockBookings, '2026-09');

      expect(stats.daysInMonth).toBe(30);

      // Booked nights in Sep:
      // b1: Sep 1, 2, 3, 4 = 4 nights
      // b2: Sep 10, 11, 12, 13, 14, 15 = 6 nights
      // b3-cross: Sep 28, 29, 30 = 3 nights (Oct 1 and Oct 2 belong to October)
      // Cancelled booking is excluded!
      // Total nights = 4 + 6 + 3 = 13 nights
      expect(stats.occupiedNights).toBe(13);
      expect(stats.vacantNights).toBe(17);
      expect(stats.occupancyRate).toBeCloseTo((13 / 30) * 100, 1);

      // Total accommodation revenue in Sep:
      // b1: 4 * 300000 = 1,200,000
      // b2: 6 * 280000 = 1,680,000
      // b3-cross: 3 * 350000 = 1,050,000
      // Total = 3,930,000
      expect(stats.totalAccommodationRevenue).toBe(3930000);

      // ADR = Total Accommodation Revenue / Occupied Nights = 3,930,000 / 13 = 302,308
      expect(stats.adr).toBe(Math.round(3930000 / 13));

      // RevPAR = Total Accommodation Revenue / Days in Month = 3,930,000 / 30 = 131,000
      expect(stats.revPar).toBe(Math.round(3930000 / 30));

      // RevPAR should also equal ADR * (occupiedNights / 30)
      const expectedRevPar = Math.round(stats.adr * (13 / 30));
      expect(Math.abs(stats.revPar - expectedRevPar)).toBeLessThanOrEqual(2);

      // Total bookings touching Sep = 3 (b1, b2, b3-cross)
      expect(stats.totalBookings).toBe(3);

      // LOS = Average full reservation length: (4 + 6 + 5) / 3 = 15 / 3 = 5.0 nights
      expect(stats.averageLos).toBe(5.0);

      // Lead Time:
      // b1: check_in 2026-09-01, booking_date 2026-08-25 -> 7 days
      // b2: check_in 2026-09-10, booking_date 2026-09-08 -> 2 days
      // b3-cross: check_in 2026-09-28, booking_date 2026-09-15 -> 13 days
      // Average = (7 + 2 + 13) / 3 = 22 / 3 = 7.3 days
      expect(stats.bookingsWithLeadTimeCount).toBe(3);
      expect(stats.averageLeadTime).toBe(7.3);
      expect(stats.minLeadTime).toBe(2);
      expect(stats.maxLeadTime).toBe(13);

      // Daily status verification
      expect(stats.dailyStatus.length).toBe(30);
      expect(stats.dailyStatus[0].isOccupied).toBe(true); // Sep 1
      expect(stats.dailyStatus[0].guestName).toBe('Ana Gomez');
      expect(stats.dailyStatus[4].isOccupied).toBe(false); // Sep 5 (checkout day of b1, not yet occupied by b2)
      expect(stats.dailyStatus[9].isOccupied).toBe(true); // Sep 10 (b2 check-in)
      expect(stats.dailyStatus[29].isOccupied).toBe(true); // Sep 30 (b3 night)
    });

    it('correctly allocates remaining 2 nights of b3-cross to October', () => {
      const statsOct = calculateMonthAnalytics(mockBookings, '2026-10');
      expect(statsOct.daysInMonth).toBe(31);
      // Oct 1, Oct 2 = 2 nights
      expect(statsOct.occupiedNights).toBe(2);
      expect(statsOct.totalAccommodationRevenue).toBe(2 * 350000);
      expect(statsOct.adr).toBe(350000);
      expect(statsOct.revPar).toBe(Math.round((2 * 350000) / 31));
    });

    it('handles an empty month with 0 bookings gracefully', () => {
      const stats = calculateMonthAnalytics([], '2026-05');
      expect(stats.occupiedNights).toBe(0);
      expect(stats.occupancyRate).toBe(0);
      expect(stats.totalAccommodationRevenue).toBe(0);
      expect(stats.adr).toBe(0);
      expect(stats.revPar).toBe(0);
      expect(stats.totalBookings).toBe(0);
      expect(stats.averageLos).toBe(0);
      expect(stats.averageLeadTime).toBeNull();
      expect(stats.dailyStatus.length).toBe(31);
    });

    it('filters by channel correctly', () => {
      const airbnbOnly = calculateMonthAnalytics(mockBookings, '2026-09', { channelFilter: 'airbnb' });
      // Only b1 (4 nights) and b3 (3 nights) = 7 nights
      expect(airbnbOnly.occupiedNights).toBe(7);
      expect(airbnbOnly.totalBookings).toBe(2);

      const directOnly = calculateMonthAnalytics(mockBookings, '2026-09', { channelFilter: 'direct' });
      // Only b2 (6 nights)
      expect(directOnly.occupiedNights).toBe(6);
      expect(directOnly.totalBookings).toBe(1);
    });
  });

  describe('calculateMoMComparison', () => {
    it('computes deltas and percentage changes accurately', () => {
      const curr = {
        adr: 300000,
        occupancyRate: 80,
        revPar: 240000,
        totalAccommodationRevenue: 7200000,
        averageLos: 4.5,
        averageLeadTime: 15,
      } as ReturnType<typeof calculateMonthAnalytics>;

      const prev = {
        adr: 250000,
        occupancyRate: 70,
        revPar: 175000,
        totalAccommodationRevenue: 5250000,
        averageLos: 3.5,
        averageLeadTime: 10,
      } as ReturnType<typeof calculateMonthAnalytics>;

      const mom = calculateMoMComparison(curr, prev);
      expect(mom).not.toBeNull();
      expect(mom?.adrDelta).toBe(50000);
      expect(mom?.adrDeltaPercent).toBe(20);
      expect(mom?.occupancyDelta).toBe(10);
      expect(mom?.losDelta).toBe(1.0);
      expect(mom?.leadTimeDelta).toBe(5);
    });
  });

  describe('getAvailableMonths', () => {
    it('returns sorted unique months from bookings and current month', () => {
      const bookings = [
        { check_in: '2026-07-10', check_out: '2026-07-15' },
        { check_in: '2026-09-01', check_out: '2026-09-05' },
      ] as Booking[];

      const months = getAvailableMonths(bookings, '2026-09-29');
      expect(months).toContain('2026-09');
      expect(months).toContain('2026-07');
      expect(months[0] >= months[1]).toBe(true); // descending
    });
  });
});
