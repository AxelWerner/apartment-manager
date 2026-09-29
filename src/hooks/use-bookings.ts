import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBookings,
  createBooking,
  createBookingsBatch,
  updateBooking,
  deleteBooking,
  clearAllBookings,
  type UpsertBatchOptions,
  type UpsertBatchResult,
} from '@/lib/api-service';
import type { Booking } from '@/types/database';

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: fetchBookings,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newBooking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) =>
      createBooking(newBooking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useCreateBookingsBatch() {
  const queryClient = useQueryClient();
  return useMutation<
    UpsertBatchResult,
    Error,
    | Omit<Booking, 'id' | 'created_at' | 'updated_at'>[]
    | { bookings: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[]; options?: UpsertBatchOptions }
  >({
    mutationFn: (args) => {
      if (Array.isArray(args)) {
        return createBookingsBatch(args);
      }
      return createBookingsBatch(args.bookings, args.options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Booking> }) =>
      updateBooking(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useClearBookings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearAllBookings(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
