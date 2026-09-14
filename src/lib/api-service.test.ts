import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchProperty,
  updateProperty,
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
  });
});
