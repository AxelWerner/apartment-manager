import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import {
  useUserPendingInvitations,
  useAcceptPendingInvitation,
  useDeclinePendingInvitation,
} from './use-pending-invitations';
import * as invitationsService from '@/lib/invitations-service';
import { useAuth } from '@/hooks/use-auth';
import { useActiveProperty } from '@/context/PropertyContext';
import { toast } from 'sonner';
import type { UserPendingInvitation } from '@/types/database';
import type { User } from '@supabase/supabase-js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/invitations-service', () => ({
  fetchUserPendingInvitations: vi.fn(),
  acceptPropertyInvitation: vi.fn(),
  declinePropertyInvitation: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/context/PropertyContext', () => ({
  useActiveProperty: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function createWrapper(queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
})) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('use-pending-invitations hooks', () => {
  const mockRefreshProperties = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useActiveProperty).mockReturnValue({
      refreshProperties: mockRefreshProperties,
    } as unknown as ReturnType<typeof useActiveProperty>);
  });

  const mockInvitation: UserPendingInvitation = {
    id: 'inv-1',
    property_id: 'prop-1',
    email: 'user@example.com',
    role: 'OPERATOR',
    invited_by: 'owner-1',
    token: 'tok-123',
    status: 'pending',
    expires_at: '2026-11-01',
    property_name: 'Downtown Studio',
    property_city: 'Buenos Aires',
  };

  describe('useUserPendingInvitations', () => {
    it('returns empty list when user is not logged in', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
      } as unknown as ReturnType<typeof useAuth>);

      const { result } = renderHook(() => useUserPendingInvitations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.invitations).toEqual([]);
      expect(result.current.count).toBe(0);
      expect(invitationsService.fetchUserPendingInvitations).not.toHaveBeenCalled();
    });

    it('fetches pending invitations when user is logged in', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'u-1' } as unknown as User,
      } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(invitationsService.fetchUserPendingInvitations).mockResolvedValue([
        mockInvitation,
      ]);

      const { result } = renderHook(() => useUserPendingInvitations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.invitations).toEqual([mockInvitation]);
      expect(result.current.count).toBe(1);
      expect(invitationsService.fetchUserPendingInvitations).toHaveBeenCalled();
    });
  });

  describe('useAcceptPendingInvitation', () => {
    it('handles successful invitation acceptance', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(invitationsService.acceptPropertyInvitation).mockResolvedValue({
        success: true,
        property_id: 'prop-1',
      });

      const { result } = renderHook(() => useAcceptPendingInvitation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({
        token: 'tok-123',
        propertyName: 'Downtown Studio',
        propertyId: 'prop-1',
      });

      expect(invitationsService.acceptPropertyInvitation).toHaveBeenCalledWith('tok-123');
      expect(toast.success).toHaveBeenCalledWith('¡Te has unido exitosamente a "Downtown Studio"!');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['my_pending_invitations'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user_properties'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['properties'] });
      expect(mockRefreshProperties).toHaveBeenCalled();
      expect(localStorage.getItem('active_property_id')).toBe('prop-1');
      expect(mockNavigate).toHaveBeenCalledWith('/p/prop-1/dashboard');
    });

    it('handles generic toast and fallback propertyId if not returned directly', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      vi.mocked(invitationsService.acceptPropertyInvitation).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useAcceptPendingInvitation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({
        token: 'tok-123',
        propertyId: 'prop-fallback',
      });

      expect(toast.success).toHaveBeenCalledWith('¡Te has unido exitosamente al apartamento!');
      expect(mockNavigate).toHaveBeenCalledWith('/p/prop-fallback/dashboard');
    });

    it('handles acceptance failure', async () => {
      vi.mocked(invitationsService.acceptPropertyInvitation).mockResolvedValue({
        success: false,
        error: 'Token expirado',
      });

      const { result } = renderHook(() => useAcceptPendingInvitation(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ token: 'invalid-token' })
      ).rejects.toThrow('Token expirado');

      expect(toast.error).toHaveBeenCalledWith('Token expirado');
    });
  });

  describe('useDeclinePendingInvitation', () => {
    it('handles successful invitation decline', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(invitationsService.declinePropertyInvitation).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useDeclinePendingInvitation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({
        token: 'tok-123',
        propertyName: 'Downtown Studio',
      });

      expect(invitationsService.declinePropertyInvitation).toHaveBeenCalledWith('tok-123');
      expect(toast.info).toHaveBeenCalledWith('Invitación a "Downtown Studio" rechazada');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['my_pending_invitations'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['property_invitations'] });
    });

    it('handles declining without propertyName and failure scenario', async () => {
      vi.mocked(invitationsService.declinePropertyInvitation).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useDeclinePendingInvitation(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        token: 'tok-456',
      });

      expect(toast.info).toHaveBeenCalledWith('Invitación rechazada');

      // Failure test
      vi.mocked(invitationsService.declinePropertyInvitation).mockResolvedValue({
        success: false,
        error: 'No se pudo rechazar',
      });

      await expect(
        result.current.mutateAsync({ token: 'tok-err' })
      ).rejects.toThrow('No se pudo rechazar');

      expect(toast.error).toHaveBeenCalledWith('No se pudo rechazar');
    });
  });
});
