import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useBookings,
  useCreateBooking,
  useCreateBookingsBatch,
  useUpdateBooking,
  useDeleteBooking,
  useClearBookings,
} from './use-bookings';
import * as apiService from '@/lib/api-service';
import type { Booking } from '@/types/database';

vi.mock('@/lib/api-service', () => ({
  fetchBookings: vi.fn(),
  createBooking: vi.fn(),
  createBookingsBatch: vi.fn(),
  updateBooking: vi.fn(),
  deleteBooking: vi.fn(),
  clearAllBookings: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('use-bookings hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches bookings via useBookings', async () => {
    const mockList: Booking[] = [
      {
        id: 'b-100',
        property_id: 'p-1',
        airbnb_confirmation_code: 'HMTEST1',
        guest_name: 'Ana Silva',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-10-01',
        check_out: '2026-10-04',
        number_of_nights: 3,
        nightly_rate: 200000,
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

    vi.mocked(apiService.fetchBookings).mockResolvedValue(mockList);

    const { result } = renderHook(() => useBookings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockList);
    expect(apiService.fetchBookings).toHaveBeenCalledTimes(1);
  });

  it('creates booking and invalidates queries via useCreateBooking', async () => {
    const newBookingData = {
      property_id: 'p-1',
      airbnb_confirmation_code: 'HMNEW77',
      guest_name: 'Carlos Ruiz',
      guest_phone: null,
      number_of_guests: 1,
      check_in: '2026-11-01',
      check_out: '2026-11-03',
      number_of_nights: 2,
      nightly_rate: 180000,
      gross_amount: 360000,
      cleaning_fee_collected: 60000,
      airbnb_service_fee: 40000,
      taxes_withheld: 0,
      net_payout: 320000,
      status: 'confirmed' as const,
      payout_status: 'pending' as const,
      payout_date: null,
      source: 'airbnb',
      notes: null,
    };

    const createdRecord: Booking = {
      ...newBookingData,
      id: 'b-new-uuid',
    };

    vi.mocked(apiService.createBooking).mockResolvedValue(createdRecord);

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(newBookingData);

    expect(apiService.createBooking).toHaveBeenCalledWith(newBookingData);
  });

  it('creates batch of bookings via useCreateBookingsBatch with array or object', async () => {
    const batchData = [
      {
        property_id: 'p-1',
        airbnb_confirmation_code: 'BATCH1',
        guest_name: 'Guest 1',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-11-01',
        check_out: '2026-11-03',
        number_of_nights: 2,
        nightly_rate: 100000,
        gross_amount: 200000,
        cleaning_fee_collected: 50000,
        airbnb_service_fee: 30000,
        taxes_withheld: 0,
        net_payout: 170000,
        status: 'confirmed' as const,
        payout_status: 'pending' as const,
        payout_date: null,
        source: 'airbnb',
        notes: null,
      },
    ];

    const batchResult: apiService.UpsertBatchResult = {
      inserted: 1,
      updated: 0,
      unchanged: 0,
      deleted: 0,
      total: 1,
    };

    vi.mocked(apiService.createBookingsBatch).mockResolvedValue(batchResult);

    const { result } = renderHook(() => useCreateBookingsBatch(), {
      wrapper: createWrapper(),
    });

    // Test with array
    const res1 = await result.current.mutateAsync(batchData);
    expect(apiService.createBookingsBatch).toHaveBeenCalledWith(batchData);
    expect(res1).toEqual(batchResult);

    // Test with object containing options
    const res2 = await result.current.mutateAsync({
      bookings: batchData,
      options: { deleteMissing: true },
    });
    expect(apiService.createBookingsBatch).toHaveBeenCalledWith(batchData, {
      deleteMissing: true,
    });
    expect(res2).toEqual(batchResult);
  });

  it('updates booking via useUpdateBooking', async () => {
    vi.mocked(apiService.updateBooking).mockResolvedValue({} as unknown as Booking);

    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      id: 'b-100',
      updates: { guest_name: 'Ana Updated' },
    });

    expect(apiService.updateBooking).toHaveBeenCalledWith('b-100', {
      guest_name: 'Ana Updated',
    });
  });

  it('deletes booking via useDeleteBooking', async () => {
    vi.mocked(apiService.deleteBooking).mockResolvedValue(undefined as unknown as void);

    const { result } = renderHook(() => useDeleteBooking(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync('b-100');

    expect(apiService.deleteBooking).toHaveBeenCalledWith('b-100');
  });

  it('clears all bookings via useClearBookings', async () => {
    vi.mocked(apiService.clearAllBookings).mockResolvedValue(undefined as unknown as void);

    const { result } = renderHook(() => useClearBookings(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(apiService.clearAllBookings).toHaveBeenCalledTimes(1);
  });
});

