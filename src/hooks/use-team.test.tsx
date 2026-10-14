import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  usePropertyMembers,
  usePropertyInvitations,
  useCreateInvitation,
  useCancelInvitation,
  useUpdateMemberRole,
  useUpdateMemberOwnership,
  useTransferPrimaryOwnership,
  useRemoveMember,
} from './use-team';
import * as invitationsService from '@/lib/invitations-service';
import type { PropertyMember, PropertyInvitation } from '@/types/database';

vi.mock('@/lib/invitations-service', () => ({
  fetchPropertyMembers: vi.fn(),
  updatePropertyMemberRole: vi.fn(),
  updatePropertyMemberOwnership: vi.fn(),
  transferPrimaryOwnership: vi.fn(),
  removePropertyMember: vi.fn(),
  fetchPropertyInvitations: vi.fn(),
  createPropertyInvitation: vi.fn(),
  cancelPropertyInvitation: vi.fn(),
}));

function createWrapper(queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('use-team hooks', () => {
  const propertyId = 'prop-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockMember: PropertyMember = {
    id: 'pm-1',
    property_id: propertyId,
    user_id: 'user-1',
    role: 'ADMINISTRATOR',
    is_primary_owner: false,
    profile: {
      id: 'user-1',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+123456789',
    },
  };

  const mockInvitation: PropertyInvitation = {
    id: 'inv-1',
    property_id: propertyId,
    email: 'newbie@example.com',
    role: 'OPERATOR',
    invited_by: 'user-1',
    token: 'tok-abc',
    status: 'pending',
    expires_at: '2026-11-01',
  };

  describe('usePropertyMembers', () => {
    it('fetches members when propertyId is provided', async () => {
      vi.mocked(invitationsService.fetchPropertyMembers).mockResolvedValue([mockMember]);

      const { result } = renderHook(() => usePropertyMembers(propertyId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([mockMember]);
      expect(invitationsService.fetchPropertyMembers).toHaveBeenCalledWith(propertyId);
    });

    it('is disabled when propertyId is undefined', () => {
      const { result } = renderHook(() => usePropertyMembers(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(invitationsService.fetchPropertyMembers).not.toHaveBeenCalled();
    });
  });

  describe('usePropertyInvitations', () => {
    it('fetches invitations when propertyId is provided', async () => {
      vi.mocked(invitationsService.fetchPropertyInvitations).mockResolvedValue([mockInvitation]);

      const { result } = renderHook(() => usePropertyInvitations(propertyId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([mockInvitation]);
      expect(invitationsService.fetchPropertyInvitations).toHaveBeenCalledWith(propertyId);
    });

    it('is disabled when propertyId is undefined', () => {
      const { result } = renderHook(() => usePropertyInvitations(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(invitationsService.fetchPropertyInvitations).not.toHaveBeenCalled();
    });
  });

  describe('useCreateInvitation', () => {
    it('throws error if no propertyId is provided', async () => {
      const { result } = renderHook(() => useCreateInvitation(undefined), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ email: 'test@test.com', role: 'VIEWER' })
      ).rejects.toThrow('No active property selected');
    });

    it('creates invitation and invalidates property_invitations query', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(invitationsService.createPropertyInvitation).mockResolvedValue(mockInvitation);

      const { result } = renderHook(() => useCreateInvitation(propertyId), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({ email: 'newbie@example.com', role: 'OPERATOR' });

      expect(invitationsService.createPropertyInvitation).toHaveBeenCalledWith(
        propertyId,
        'newbie@example.com',
        'OPERATOR'
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['property_invitations', propertyId],
      });
    });
  });

  describe('useCancelInvitation', () => {
    it('cancels invitation and invalidates property_invitations query', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(invitationsService.cancelPropertyInvitation).mockResolvedValue(undefined as unknown as void);

      const { result } = renderHook(() => useCancelInvitation(propertyId), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync('inv-1');

      expect(invitationsService.cancelPropertyInvitation).toHaveBeenCalledWith('inv-1');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['property_invitations', propertyId],
      });
    });
  });

  describe('useUpdateMemberRole', () => {
    it('throws error if no propertyId', async () => {
      const { result } = renderHook(() => useUpdateMemberRole(undefined), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ memberId: 'pm-1', newRole: 'OWNER' })
      ).rejects.toThrow('No active property selected');
    });

    it('updates member role and invalidates property_members query', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(invitationsService.updatePropertyMemberRole).mockResolvedValue(undefined as unknown as void);

      const { result } = renderHook(() => useUpdateMemberRole(propertyId), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({ memberId: 'pm-1', newRole: 'OWNER' });

      expect(invitationsService.updatePropertyMemberRole).toHaveBeenCalledWith(
        propertyId,
        'pm-1',
        'OWNER'
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['property_members', propertyId],
      });
    });
  });

  describe('useUpdateMemberOwnership', () => {
    it('throws error if no propertyId', async () => {
      const { result } = renderHook(() => useUpdateMemberOwnership(undefined), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ memberId: 'pm-1', isOwner: true })
      ).rejects.toThrow('No active property selected');
    });

    it('updates member ownership and invalidates property_members query', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(invitationsService.updatePropertyMemberOwnership).mockResolvedValue(undefined as unknown as void);

      const { result } = renderHook(() => useUpdateMemberOwnership(propertyId), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({ memberId: 'pm-1', isOwner: true });

      expect(invitationsService.updatePropertyMemberOwnership).toHaveBeenCalledWith(
        propertyId,
        'pm-1',
        true
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['property_members', propertyId],
      });
    });
  });

  describe('useTransferPrimaryOwnership', () => {
    it('throws error if no propertyId', async () => {
      const { result } = renderHook(() => useTransferPrimaryOwnership(undefined), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ newOwnerUserId: 'user-2' })
      ).rejects.toThrow('No active property selected');
    });

    it('transfers primary ownership and invalidates relevant queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(invitationsService.transferPrimaryOwnership).mockResolvedValue(undefined as unknown as void);

      const { result } = renderHook(() => useTransferPrimaryOwnership(propertyId), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({ newOwnerUserId: 'user-2' });

      expect(invitationsService.transferPrimaryOwnership).toHaveBeenCalledWith(
        propertyId,
        'user-2'
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['property_members', propertyId],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['properties'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['property', propertyId],
      });
    });
  });

  describe('useRemoveMember', () => {
    it('throws error if no propertyId', async () => {
      const { result } = renderHook(() => useRemoveMember(undefined), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync('pm-1')
      ).rejects.toThrow('No active property selected');
    });

    it('removes member and invalidates property_members query', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(invitationsService.removePropertyMember).mockResolvedValue(undefined as unknown as void);

      const { result } = renderHook(() => useRemoveMember(propertyId), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync('pm-1');

      expect(invitationsService.removePropertyMember).toHaveBeenCalledWith(
        propertyId,
        'pm-1'
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['property_members', propertyId],
      });
    });
  });
});
