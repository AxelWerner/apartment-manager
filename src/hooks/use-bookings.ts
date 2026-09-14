import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBookings,
  createBooking,
  createBookingsBatch,
  updateBooking,
  deleteBooking,
  clearAllBookings,
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
  return useMutation({
    mutationFn: (bookings: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[]) =>
      createBookingsBatch(bookings),
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
