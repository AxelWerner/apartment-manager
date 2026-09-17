import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchProperty,
  updateProperty,
  fetchBookings,
  upsertBookingsBatch,
} from './api-service';
import { supabase, DEFAULT_PROPERTY_ID } from './supabase';
import type { Property, Booking } from '@/types/database';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  DEFAULT_PROPERTY_ID: 'test-prop-uuid',
}));

describe('api-service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('fetchProperty', () => {
    it('returns property from Supabase when available and caches it in localStorage', async () => {
      const mockProp: Property = {
        id: DEFAULT_PROPERTY_ID,
        name: 'Propiedad Supabase',
        address: 'Calle 10',
        city: 'Santa Marta',
        currency: 'COP',
        default_nightly_rate: 300000,
        default_cleaning_fee: 70000,
        monthly_revenue_target: 3500000,
        check_in_time: '15:00',
        check_out_time: '11:00',
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: mockProp, error: null });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
      });

      const prop = await fetchProperty();

      expect(prop.name).toBe('Propiedad Supabase');
      expect(JSON.parse(localStorage.getItem('apt_mgr_property') || '{}').name).toBe('Propiedad Supabase');
    });

    it('falls back to local storage when Supabase returns an error', async () => {
      const cachedProp: Property = {
        id: DEFAULT_PROPERTY_ID,
        name: 'Propiedad en Caché',
        address: 'Playa',
        city: 'Santa Marta',
        currency: 'COP',
        default_nightly_rate: 280000,
        default_cleaning_fee: 60000,
        check_in_time: '15:00',
        check_out_time: '11:00',
      };
      localStorage.setItem('apt_mgr_property', JSON.stringify(cachedProp));

      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: new Error('Offline') });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
      });

      const prop = await fetchProperty();
      expect(prop.name).toBe('Propiedad en Caché');
    });
  });

  describe('updateProperty', () => {
    it('updates local storage and calls Supabase update', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        update: mockUpdate,
      });

      const updated = await updateProperty({ default_nightly_rate: 350000 });

      expect(updated.default_nightly_rate).toBe(350000);
      expect(mockUpdate).toHaveBeenCalledWith({ default_nightly_rate: 350000 });
      expect(JSON.parse(localStorage.getItem('apt_mgr_property') || '{}').default_nightly_rate).toBe(350000);
    });
  });

  describe('upsertBookingsBatch', () => {
    it('accurately categorizes inserted, updated, and unchanged bookings', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        upsert: mockUpsert,
      });

      const existingBooking: Booking = {
        id: 'b-existing',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: 'HMOLD123',
        guest_name: 'Existing Guest',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-10-01',
        check_out: '2026-10-05',
        number_of_nights: 4,
        nightly_rate: 150000,
        gross_amount: 600000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 50000,
        taxes_withheld: 0,
        net_payout: 550000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'airbnb',
        notes: null,
      };
      localStorage.setItem('apt_mgr_bookings_v2', JSON.stringify([existingBooking]));

      const batchToImport: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[] = [
        // 1. Unchanged
        { ...existingBooking },
        // 2. Updated: payout changed
        { ...existingBooking, airbnb_confirmation_code: 'HMOLD123', net_payout: 580000 },
        // 3. New booking
        {
          property_id: DEFAULT_PROPERTY_ID,
          airbnb_confirmation_code: 'HMNEW456',
          guest_name: 'Brand New Guest',
          guest_phone: null,
          number_of_guests: 1,
          check_in: '2026-11-01',
          check_out: '2026-11-03',
          number_of_nights: 2,
          nightly_rate: 200000,
          gross_amount: 400000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 40000,
          taxes_withheld: 0,
          net_payout: 360000,
          status: 'confirmed',
          payout_status: 'pending',
          payout_date: null,
          source: 'airbnb',
          notes: null,
        },
      ];

      const result = await upsertBookingsBatch(batchToImport);

      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.unchanged).toBe(1);
      expect(result.total).toBe(3);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('calculates 20% management fee after deducting cleaning fee, and 80% nightly rate', async () => {
      const rawBooking: Booking = {
        id: 'b-calc-test',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: 'HMCALC123',
        guest_name: 'Calculation Test Guest',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-09-11',
        check_out: '2026-09-14',
        number_of_nights: 3,
        nightly_rate: 106106,
        gross_amount: 378815,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 71993,
        taxes_withheld: 0,
        net_payout: 318317, // 318.317 COP transferido por Airbnb (incluye 60.000 de aseo)
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'airbnb',
        notes: null,
      };

      const mockOrder = vi.fn().mockResolvedValue({ data: [rawBooking], error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
      });

      const bookings = await fetchBookings();
      const synced = bookings.find((b) => b.id === 'b-calc-test');

      expect(synced?.owner_payout).toBe(206654);
      // 80% alojamiento: 258.317 * 0.80 = 206.654 COP / 3 noches = 68.885 COP por noche
      expect(synced?.nightly_rate).toBe(68885);
    });

    it('calculates 10% management fee and 90% owner payout for direct bookings after deducting cleaning fee', async () => {
      const directBooking: Booking = {
        id: 'b-direct-test',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: null,
        guest_name: 'Direct Booking Guest',
        guest_phone: '+57 300 000 0000',
        number_of_guests: 2,
        check_in: '2026-09-20',
        check_out: '2026-09-22',
        number_of_nights: 2,
        nightly_rate: 450000,
        gross_amount: 1090000,
        cleaning_fee_collected: 90000,
        airbnb_service_fee: 0,
        taxes_withheld: 0,
        net_payout: 1090000, // Total received: 1.090.000 COP
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'direct',
        notes: 'Reserva directa',
      };

      const mockOrder = vi.fn().mockResolvedValue({ data: [directBooking], error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
      });

      const bookings = await fetchBookings();
      const synced = bookings.find((b) => b.id === 'b-direct-test');

      expect(synced).toBeDefined();
      // Base alojamiento: 1.090.000 - 90.000 = 1.000.000 COP
      // 10% comision adm: 1.000.000 * 0.10 = 100.000 COP
      expect(synced?.management_fee).toBe(100000);
      // Neto propietario (90% alojamiento): 1.000.000 * 0.90 = 900.000 COP
      expect(synced?.owner_payout).toBe(900000);
      // 90% alojamiento / 2 noches = 450.000 COP / noche
      expect(synced?.nightly_rate).toBe(450000);
    });

    it('calculates 25% management fee and 75% owner payout for direct_25 bookings after deducting cleaning fee', async () => {
      const directBooking: Booking = {
        id: 'b-direct25-test',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: null,
        guest_name: 'Direct 25 Booking Guest',
        guest_phone: '+57 300 000 0000',
        number_of_guests: 2,
        check_in: '2026-09-20',
        check_out: '2026-09-22',
        number_of_nights: 2,
        nightly_rate: 375000,
        gross_amount: 1060000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 0,
        taxes_withheld: 0,
        net_payout: 1060000, // Total received: 1.060.000 COP
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'direct_25',
        notes: 'Reserva directa 25%',
      };

      const mockOrder = vi.fn().mockResolvedValue({ data: [directBooking], error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
      });

      const bookings = await fetchBookings();
      const synced = bookings.find((b) => b.id === 'b-direct25-test');

      expect(synced).toBeDefined();
      // Base alojamiento: 1.060.000 - 60.000 = 1.000.000 COP
      // 25% comision adm: 1.000.000 * 0.25 = 250.000 COP
      expect(synced?.management_fee).toBe(250000);
      // Neto propietario (75% alojamiento): 1.000.000 * 0.75 = 750.000 COP
      expect(synced?.owner_payout).toBe(750000);
      // 75% alojamiento / 2 noches = 375.000 COP / noche
      expect(synced?.nightly_rate).toBe(375000);
    });
  });
});

