import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { InvitationsBell } from './InvitationsBell';
import { renderWithProviders } from '@/test/test-utils';
import * as pendingHook from '@/hooks/use-pending-invitations';
import type { UserPendingInvitation } from '@/types/database';

vi.mock('@/hooks/use-pending-invitations', () => ({
  useUserPendingInvitations: vi.fn(),
  useAcceptPendingInvitation: vi.fn(),
  useDeclinePendingInvitation: vi.fn(),
}));

describe('InvitationsBell Component', () => {
  const mockAcceptMutateAsync = vi.fn().mockResolvedValue({ success: true });
  const mockDeclineMutateAsync = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pendingHook.useAcceptPendingInvitation).mockReturnValue({
      mutateAsync: mockAcceptMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof pendingHook.useAcceptPendingInvitation>);
    vi.mocked(pendingHook.useDeclinePendingInvitation).mockReturnValue({
      mutateAsync: mockDeclineMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof pendingHook.useDeclinePendingInvitation>);
  });

  it('renders bell button without badge when count is 0', () => {
    vi.mocked(pendingHook.useUserPendingInvitations).mockReturnValue({
      invitations: [],
      count: 0,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<InvitationsBell />);

    const button = screen.getByRole('button', { name: /Invitaciones/i });
    expect(button).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('opens popover showing empty state when clicked with 0 invitations', () => {
    vi.mocked(pendingHook.useUserPendingInvitations).mockReturnValue({
      invitations: [],
      count: 0,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<InvitationsBell />);

    const button = screen.getByRole('button', { name: /Invitaciones/i });
    fireEvent.click(button);

    expect(screen.getByText(/Sin invitaciones pendientes/i)).toBeInTheDocument();
  });

  it('renders numeric badge when pending invitations exist', () => {
    vi.mocked(pendingHook.useUserPendingInvitations).mockReturnValue({
      invitations: [
        {
          id: 'inv-1',
          property_id: 'prop-1',
          property_name: 'Penthouse Poblado',
          property_city: 'Medellín',
          email: 'user@test.com',
          role: 'ADMINISTRATOR',
          invited_by: 'owner-1',
          inviter_name: 'Carlos Dueño',
          token: 'tok-abc',
          status: 'pending',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ],
      count: 1,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<InvitationsBell />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays invitations list and allows accepting an invitation', async () => {
    const mockInv: UserPendingInvitation = {
      id: 'inv-1',
      property_id: 'prop-1',
      property_name: 'Penthouse Poblado',
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

    renderWithProviders(<InvitationsBell />);

    const button = screen.getByRole('button', { name: /Invitaciones/i });
    fireEvent.click(button);

    expect(screen.getByText('Penthouse Poblado')).toBeInTheDocument();
    expect(screen.getByText(/De: Carlos Dueño/i)).toBeInTheDocument();

    const acceptBtn = screen.getByRole('button', { name: /Aceptar/i });
    await fireEvent.click(acceptBtn);

    expect(mockAcceptMutateAsync).toHaveBeenCalledWith({
      token: 'tok-abc',
      propertyName: 'Penthouse Poblado',
      propertyId: 'prop-1',
    });
  });

  it('allows declining an invitation', async () => {
    const mockInv: UserPendingInvitation = {
      id: 'inv-1',
      property_id: 'prop-1',
      property_name: 'Penthouse Poblado',
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

    renderWithProviders(<InvitationsBell />);

    const button = screen.getByRole('button', { name: /Invitaciones/i });
    fireEvent.click(button);

    const declineBtn = screen.getByRole('button', { name: /Rechazar/i });
    await fireEvent.click(declineBtn);

    expect(mockDeclineMutateAsync).toHaveBeenCalledWith({
      token: 'tok-abc',
      propertyName: 'Penthouse Poblado',
    });
  });
});
