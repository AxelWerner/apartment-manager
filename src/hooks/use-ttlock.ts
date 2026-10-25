import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBookingPins,
  fetchPropertyLock,
  fetchAllPropertyLocks,
  savePropertyLock,
  generateBookingPin,
  updatePinsFromLockRecords,
  fetchAccountLocks,
  exchangeTtlockCode,
  connectTtlockAccount,
  assignPropertyLock,
  unlinkPropertyLock,
  getTtlockOAuthUrl,
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

export function useAllPropertyLocks() {
  return useQuery<PropertyLock[]>({
    queryKey: ['property-locks'],
    queryFn: () => fetchAllPropertyLocks(),
  });
}

export function useAccountLocks(propertyId?: string, enabled = true) {
  return useQuery({
    queryKey: ['account-locks', propertyId],
    queryFn: () => (propertyId ? fetchAccountLocks(propertyId) : Promise.resolve([])),
    enabled: Boolean(propertyId) && enabled,
  });
}

export function useConnectTtlockAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { propertyId: string; username: string; password: string }) =>
      connectTtlockAccount(params),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['property-lock', vars.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['account-locks', vars.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property-locks'] });
    },
  });
}

export function useExchangeTtlockCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, propertyId, redirectUri }: { code: string; propertyId: string; redirectUri: string }) =>
      exchangeTtlockCode(code, propertyId, redirectUri),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['property-lock', vars.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['account-locks', vars.propertyId] });
    },
  });
}

export function useAssignPropertyLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      lockId,
      lockName,
      lockAlias,
    }: {
      propertyId: string;
      lockId: number;
      lockName?: string;
      lockAlias?: string;
    }) => assignPropertyLock(propertyId, lockId, lockName, lockAlias),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['property-lock', vars.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property-locks'] });
    },
  });
}

export function useUnlinkPropertyLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      unlinkType,
    }: {
      propertyId: string;
      unlinkType?: 'lock_only' | 'full_account';
    }) => unlinkPropertyLock(propertyId, unlinkType),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['property-lock', vars.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['account-locks', vars.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property-locks'] });
    },
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
    mutationFn: async ({
      pins,
      lockId,
      propertyId,
    }: {
      pins: BookingTtlockPin[];
      lockId?: number | null;
      propertyId?: string;
    }) => {
      return updatePinsFromLockRecords(pins, lockId ?? undefined, propertyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ttlock-pins'] });
    },
  });
}

export { getTtlockOAuthUrl };

