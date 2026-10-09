import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { EmptyPropertyView } from './EmptyPropertyView';
import { renderWithProviders } from '@/test/test-utils';
import * as pendingHook from '@/hooks/use-pending-invitations';
import { useActiveProperty } from '@/context/PropertyContext';
import type { UserPendingInvitation } from '@/types/database';

vi.mock('@/context/PropertyContext', () => ({
  useActiveProperty: vi.fn(),
}));

vi.mock('@/hooks/use-pending-invitations', () => ({
  useUserPendingInvitations: vi.fn(),
  useAcceptPendingInvitation: vi.fn(),
  useDeclinePendingInvitation: vi.fn(),
}));

describe('EmptyPropertyView Component', () => {
  const mockAcceptMutateAsync = vi.fn().mockResolvedValue({ success: true });
  const mockDeclineMutateAsync = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useActiveProperty).mockReturnValue({
      createProperty: vi.fn(),
      refreshProperties: vi.fn(),
    } as unknown as ReturnType<typeof useActiveProperty>);
    vi.mocked(pendingHook.useAcceptPendingInvitation).mockReturnValue({
      mutateAsync: mockAcceptMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof pendingHook.useAcceptPendingInvitation>);
    vi.mocked(pendingHook.useDeclinePendingInvitation).mockReturnValue({
      mutateAsync: mockDeclineMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof pendingHook.useDeclinePendingInvitation>);
  });

  it('renders default empty state when there are no invitations', () => {
    vi.mocked(pendingHook.useUserPendingInvitations).mockReturnValue({
      invitations: [],
      count: 0,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<EmptyPropertyView />);

    expect(screen.getByText(/Comienza añadiendo tu primer apartamento/i)).toBeInTheDocument();
    expect(screen.queryByText(/¡Tienes 1 invitación pendiente!/i)).not.toBeInTheDocument();
  });

  it('renders prominent invitation banner when pending invitations exist', async () => {
    const mockInv: UserPendingInvitation = {
      id: 'inv-1',
      property_id: 'prop-1',
      property_name: 'Loft Poblado',
      property_city: 'Medellín',
      email: 'user@test.com',
      role: 'ADMINISTRATOR',
      invited_by: 'owner-1',
      inviter_name: 'Carlos Dueño',
      token: 'tok-abc',
      status: 'pending',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString(),
    };

    vi.mocked(pendingHook.useUserPendingInvitations).mockReturnValue({
      invitations: [mockInv],
      count: 1,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<EmptyPropertyView />);

    expect(screen.getByText(/¡Tienes 1 invitación pendiente!/i)).toBeInTheDocument();
    expect(screen.getByText('Loft Poblado')).toBeInTheDocument();
    expect(screen.getByText(/Invitado por: Carlos Dueño/i)).toBeInTheDocument();

    const acceptBtn = screen.getByRole('button', { name: /Aceptar invitación/i });
    await fireEvent.click(acceptBtn);

    expect(mockAcceptMutateAsync).toHaveBeenCalledWith({
      token: 'tok-abc',
      propertyName: 'Loft Poblado',
      propertyId: 'prop-1',
    });
  });

  it('allows declining an invitation from the empty property view', async () => {
    const mockInv: UserPendingInvitation = {
      id: 'inv-1',
      property_id: 'prop-1',
      property_name: 'Loft Poblado',
      property_city: 'Medellín',
      email: 'user@test.com',
      role: 'ADMINISTRATOR',
      invited_by: 'owner-1',
      token: 'tok-abc',
      status: 'pending',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString(),
    };

    vi.mocked(pendingHook.useUserPendingInvitations).mockReturnValue({
      invitations: [mockInv],
      count: 1,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<EmptyPropertyView />);

    const declineBtn = screen.getByRole('button', { name: /Rechazar/i });
    await fireEvent.click(declineBtn);

    expect(mockDeclineMutateAsync).toHaveBeenCalledWith({
      token: 'tok-abc',
      propertyName: 'Loft Poblado',
    });
  });
});
