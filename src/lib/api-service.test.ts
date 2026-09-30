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
    it('deletes all existing Airbnb bookings for that year and inserts all bookings from the batch', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
        delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
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
        // 1. Same details
        { ...existingBooking },
        // 2. Updated payout
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

      expect(result.inserted).toBe(3);
      expect(result.updated).toBe(0);
      expect(result.unchanged).toBe(0);
      expect(result.deleted).toBe(1);
      expect(result.total).toBe(3);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('imports reservations spanning multiple years without restriction', async () => {
      const multiYearBatch: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[] = [
        {
          property_id: DEFAULT_PROPERTY_ID,
          airbnb_confirmation_code: 'HM2025',
          guest_name: 'Guest 2025',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2025-12-20',
          check_out: '2025-12-24',
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
        },
        {
          property_id: DEFAULT_PROPERTY_ID,
          airbnb_confirmation_code: 'HM2026',
          guest_name: 'Guest 2026',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-01-10',
          check_out: '2026-01-14',
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
        },
      ];

      const res = await upsertBookingsBatch(multiYearBatch);
      expect(res.inserted).toBe(2);
      expect(res.total).toBe(2);
    });

    it('imports and stores bookings even if airbnb_confirmation_code or guest_name is duplicated', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
        delete: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
      });

      const batchWithDuplicates: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[] = [
        {
          property_id: DEFAULT_PROPERTY_ID,
          airbnb_confirmation_code: 'HM_DUPLICATE',
          guest_name: 'Ana Maria',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-04-01',
          check_out: '2026-04-04',
          number_of_nights: 3,
          nightly_rate: 100000,
          gross_amount: 360000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 50000,
          taxes_withheld: 0,
          net_payout: 310000,
          status: 'confirmed',
          payout_status: 'paid',
          payout_date: null,
          source: 'airbnb',
          notes: null,
        },
        {
          property_id: DEFAULT_PROPERTY_ID,
          airbnb_confirmation_code: 'HM_DUPLICATE',
          guest_name: 'Ana Maria',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-04-05',
          check_out: '2026-04-08',
          number_of_nights: 3,
          nightly_rate: 100000,
          gross_amount: 360000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 50000,
          taxes_withheld: 0,
          net_payout: 310000,
          status: 'confirmed',
          payout_status: 'paid',
          payout_date: null,
          source: 'airbnb',
          notes: null,
        },
      ];

      const result = await upsertBookingsBatch(batchWithDuplicates);

      expect(result.inserted).toBe(2);
      expect(result.total).toBe(2);

      const stored: Booking[] = JSON.parse(localStorage.getItem('apt_mgr_bookings_v2') || '[]');
      const matching = stored.filter((b) => b.airbnb_confirmation_code === 'HM_DUPLICATE');
      expect(matching.length).toBe(2);
      expect(matching[0].id).not.toBe(matching[1].id);
    });

    it('deletes missing bookings for that year when importing full-year data (e.g. DB has A,B,C and imports C,D -> A,B deleted)', async () => {
      const mockIn = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        upsert: mockUpsert,
        delete: mockDelete,
      });

      const baseBooking = {
        property_id: DEFAULT_PROPERTY_ID,
        guest_phone: null,
        number_of_guests: 2,
        number_of_nights: 3,
        nightly_rate: 100000,
        gross_amount: 360000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 50000,
        taxes_withheld: 0,
        net_payout: 310000,
        status: 'confirmed' as const,
        payout_status: 'paid' as const,
        payout_date: null,
        source: 'airbnb',
        notes: null,
      };

      // Existing bookings in DB for 2026: A, B, C; and one for 2025: X
      const booking2025: Booking = {
        ...baseBooking,
        id: 'b-2025-X',
        airbnb_confirmation_code: 'HMX',
        guest_name: 'Guest 2025 X',
        check_in: '2025-11-01',
        check_out: '2025-11-04',
      };
      const bookingA: Booking = {
        ...baseBooking,
        id: 'b-2026-A',
        airbnb_confirmation_code: 'HMA',
        guest_name: 'Guest A',
        check_in: '2026-03-01',
        check_out: '2026-03-04',
      };
      const bookingB: Booking = {
        ...baseBooking,
        id: 'b-2026-B',
        airbnb_confirmation_code: 'HMB',
        guest_name: 'Guest B',
        check_in: '2026-05-01',
        check_out: '2026-05-04',
      };
      const bookingC: Booking = {
        ...baseBooking,
        id: 'b-2026-C',
        airbnb_confirmation_code: 'HMC',
        guest_name: 'Guest C',
        check_in: '2026-07-01',
        check_out: '2026-07-04',
      };

      localStorage.setItem(
        'apt_mgr_bookings_v2',
        JSON.stringify([booking2025, bookingA, bookingB, bookingC])
      );

      // Incoming batch for 2026: C (updated net_payout) and D (new)
      const incomingBatch: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[] = [
        {
          ...bookingC,
          net_payout: 400000, // Updated payout
        },
        {
          ...baseBooking,
          airbnb_confirmation_code: 'HMD',
          guest_name: 'Guest D',
          check_in: '2026-09-01',
          check_out: '2026-09-04',
        },
      ];

      const result = await upsertBookingsBatch(incomingBatch, { syncYear: '2026' });

      // Result counts: all existing Airbnb bookings in 2026 (A, B, C) are deleted, and all incoming (C, D) inserted
      expect(result.inserted).toBe(2); // C and D inserted
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(3); // A, B, and C deleted
      expect(result.total).toBe(2);

      // Verify localStorage: A and B are removed, C is updated, D is added, 2025-X is preserved
      const storedBookings: Booking[] = JSON.parse(
        localStorage.getItem('apt_mgr_bookings_v2') || '[]'
      );
      const codes = storedBookings.map((b) => b.airbnb_confirmation_code);
      expect(codes).toContain('HMC');
      expect(codes).toContain('HMD');
      expect(codes).toContain('HMX'); // 2025 preserved
      expect(codes).not.toContain('HMA'); // 2026 A deleted
      expect(codes).not.toContain('HMB'); // 2026 B deleted

      const updatedC = storedBookings.find((b) => b.airbnb_confirmation_code === 'HMC');
      expect(updatedC?.net_payout).toBe(400000);
    });

    it('wipes ALL existing Airbnb bookings across all years by default when importing', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq, in: vi.fn().mockResolvedValue({ error: null }) });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: mockInsert,
        delete: mockDelete,
      });

      const baseBooking: Booking = {
        id: 'b-base',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: 'HM',
        guest_name: 'Guest',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-01-01',
        check_out: '2026-01-04',
        number_of_nights: 3,
        nightly_rate: 100000,
        gross_amount: 360000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 50000,
        taxes_withheld: 0,
        net_payout: 310000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'airbnb',
        notes: null,
      };

      const booking2024 = { ...baseBooking, id: 'b-2024', check_in: '2024-05-01', check_out: '2024-05-04' };
      const booking2025 = { ...baseBooking, id: 'b-2025', check_in: '2025-05-01', check_out: '2025-05-04' };
      const directBooking = { ...baseBooking, id: 'b-direct', source: 'direct' };

      localStorage.setItem(
        'apt_mgr_bookings_v2',
        JSON.stringify([booking2024, booking2025, directBooking])
      );

      const incomingBatch: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[] = [
        {
          ...baseBooking,
          airbnb_confirmation_code: 'HMNEW',
          check_in: '2026-10-01',
          check_out: '2026-10-04',
        },
      ];

      const res = await upsertBookingsBatch(incomingBatch);

      // Deletes 2 airbnb bookings (2024 and 2025), keeps directBooking
      expect(res.deleted).toBe(2);
      expect(res.inserted).toBe(1);

      const stored: Booking[] = JSON.parse(localStorage.getItem('apt_mgr_bookings_v2') || '[]');
      expect(stored.map((b) => b.id)).toContain('b-direct');
      expect(stored.map((b) => b.id)).not.toContain('b-2024');
      expect(stored.map((b) => b.id)).not.toContain('b-2025');
    });

    it('never deletes or updates direct bookings when importing Airbnb bookings for that year', async () => {
      const mockIn = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ in: mockIn });
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        upsert: mockUpsert,
        delete: mockDelete,
      });

      // Existing bookings in DB for 2026:
      // 1. Direct booking without code
      const directBooking1: Booking = {
        id: 'b-dir-1',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: null,
        guest_name: 'Direct Guest 1',
        guest_phone: '+57 300 111 2222',
        number_of_guests: 2,
        check_in: '2026-04-10',
        check_out: '2026-04-15',
        number_of_nights: 5,
        nightly_rate: 200000,
        gross_amount: 1060000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 0,
        taxes_withheld: 0,
        net_payout: 1060000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'direct',
        notes: 'Reserva directa WhatsApp',
      };

      // 2. Direct booking with reference code
      const directBooking2: Booking = {
        id: 'b-dir-2',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: 'DIR-2026-02',
        guest_name: 'Direct Guest 2',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-06-01',
        check_out: '2026-06-05',
        number_of_nights: 4,
        nightly_rate: 250000,
        gross_amount: 1060000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 0,
        taxes_withheld: 0,
        net_payout: 1060000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'direct_25',
        notes: 'Reserva directa 25%',
      };

      // 3. Airbnb booking that is missing from new file (should be deleted)
      const oldAirbnbBooking: Booking = {
        id: 'b-ab-old',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: 'HMOLD_TO_DELETE',
        guest_name: 'Old Airbnb Guest',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-02-01',
        check_out: '2026-02-04',
        number_of_nights: 3,
        nightly_rate: 100000,
        gross_amount: 360000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 50000,
        taxes_withheld: 0,
        net_payout: 310000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'airbnb',
        notes: null,
      };

      // 4. Airbnb booking that is present in new file (should be updated)
      const existingAirbnbBooking: Booking = {
        id: 'b-ab-keep',
        property_id: DEFAULT_PROPERTY_ID,
        airbnb_confirmation_code: 'HMKEEP',
        guest_name: 'Keep Airbnb Guest',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-08-01',
        check_out: '2026-08-05',
        number_of_nights: 4,
        nightly_rate: 150000,
        gross_amount: 660000,
        cleaning_fee_collected: 60000,
        airbnb_service_fee: 60000,
        taxes_withheld: 0,
        net_payout: 600000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: null,
        source: 'airbnb',
        notes: null,
      };

      localStorage.setItem(
        'apt_mgr_bookings_v2',
        JSON.stringify([directBooking1, directBooking2, oldAirbnbBooking, existingAirbnbBooking])
      );

      // Incoming batch from Airbnb CSV for 2026: only HMKEEP (updated payout) and HMNEW
      const incomingBatch: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[] = [
        {
          ...existingAirbnbBooking,
          net_payout: 650000,
        },
        {
          property_id: DEFAULT_PROPERTY_ID,
          airbnb_confirmation_code: 'HMNEW',
          guest_name: 'New Airbnb Guest',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-09-01',
          check_out: '2026-09-04',
          number_of_nights: 3,
          nightly_rate: 120000,
          gross_amount: 420000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 50000,
          taxes_withheld: 0,
          net_payout: 370000,
          status: 'confirmed',
          payout_status: 'paid',
          payout_date: null,
          source: 'airbnb',
          notes: null,
        },
      ];

      const result = await upsertBookingsBatch(incomingBatch);

      // Both old Airbnb bookings in 2026 should be deleted (count = 2)
      expect(result.deleted).toBe(2);
      expect(result.inserted).toBe(2); // HMKEEP and HMNEW
      expect(result.updated).toBe(0);

      const storedBookings: Booking[] = JSON.parse(
        localStorage.getItem('apt_mgr_bookings_v2') || '[]'
      );
      const storedIds = storedBookings.map((b) => b.id);
      expect(storedIds).toContain('b-dir-1'); // Direct booking preserved
      expect(storedIds).toContain('b-dir-2'); // Direct booking with code preserved
      expect(storedIds).not.toContain('b-ab-old'); // Old Airbnb booking deleted
      expect(storedIds).not.toContain('b-ab-keep'); // Old Airbnb booking record replaced with incoming

      const storedCodes = storedBookings.map((b) => b.airbnb_confirmation_code);
      expect(storedCodes).toContain('HMKEEP');
      expect(storedCodes).toContain('HMNEW');

      // Verify that direct bookings retained their source and details
      const dir1 = storedBookings.find((b) => b.id === 'b-dir-1');
      expect(dir1?.source).toBe('direct');
      const dir2 = storedBookings.find((b) => b.id === 'b-dir-2');
      expect(dir2?.source).toBe('direct_25');

      // Verify that mockDelete was called with ONLY the Airbnb booking IDs, never direct bookings
      expect(mockIn).toHaveBeenCalledWith('id', expect.arrayContaining(['b-ab-old', 'b-ab-keep']));
      expect(mockIn).not.toHaveBeenCalledWith('id', expect.arrayContaining(['b-dir-1']));
      expect(mockIn).not.toHaveBeenCalledWith('id', expect.arrayContaining(['b-dir-2']));
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

