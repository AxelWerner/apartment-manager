import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBookingPins,
  fetchPropertyLock,
  savePropertyLock,
  generateBookingPin,
  updatePinsFromLockRecords,
  type GeneratePinParams,
} from '@/lib/ttlock-service';
import type { BookingTtlockPin, PropertyLock } from '@/types/database';

export function useBookingPins(propertyId?: string) {
  return useQuery<BookingTtlockPin[]>({
    queryKey: ['ttlock-pins', propertyId],
    queryFn: () => fetchBookingPins(propertyId),
  });
}

export function usePropertyLock(propertyId?: string) {
  return useQuery<PropertyLock | null>({
    queryKey: ['property-lock', propertyId],
    queryFn: () => (propertyId ? fetchPropertyLock(propertyId) : Promise.resolve(null)),
    enabled: Boolean(propertyId),
  });
}

export function useSavePropertyLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lockData: Partial<PropertyLock> & { property_id: string; lock_id: number }) =>
      savePropertyLock(lockData),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['property-lock', vars.property_id] });
    },
  });
}

export function useGenerateTtlockPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: GeneratePinParams) => generateBookingPin(params),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ttlock-pins'] });
      queryClient.invalidateQueries({ queryKey: ['ttlock-pins', vars.propertyId] });
    },
  });
}

export function useSyncTtlockPins() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pins, lockId }: { pins: BookingTtlockPin[]; lockId?: number | null }) => {
      return updatePinsFromLockRecords(pins, lockId ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ttlock-pins'] });
    },
  });
}
