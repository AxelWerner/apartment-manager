import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from './Settings';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('@/context/PropertyContext', () => ({
  useActiveProperty: vi.fn(),
}));

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/hooks/use-damages', () => ({
  useDamages: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', email: 'owner@test.com' },
  })),
}));

vi.mock('@/hooks/use-team', () => ({
  usePropertyMembers: vi.fn(),
  usePropertyInvitations: vi.fn(),
  useCreateInvitation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateMemberRole: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateMemberOwnership: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useRemoveMember: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useCancelInvitation: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useActiveProperty } from '@/context/PropertyContext';
import { usePropertyMembers, usePropertyInvitations } from '@/hooks/use-team';

describe('Settings Route - Tabs & Team Management', () => {
  const mockProperty = {
    id: 'prop-1',
    name: 'Apto Poblado 502',
    address: 'Calle 10 # 40-20',
    city: 'Medellín',
    currency: 'COP',
    default_nightly_rate: 250000,
    default_cleaning_fee: 80000,
    monthly_revenue_target: 3000000,
    management_fee_rate: 20.0,
    check_in_time: '15:00',
    check_out_time: '11:00',
  };

  const mockMembers = [
    {
      id: 'mem-1',
      property_id: 'prop-1',
      user_id: 'user-1',
      role: 'OWNER',
      created_at: '2026-01-01',
      profile: {
        id: 'user-1',
        full_name: 'Carlos Propietario',
        phone: '+57 300 000 0000',
      },
    },
    {
      id: 'mem-2',
      property_id: 'prop-1',
      user_id: 'user-2',
      role: 'ADMINISTRATOR',
      created_at: '2026-02-01',
      profile: {
        id: 'user-2',
        full_name: 'María Administradora',
        phone: '+57 311 111 1111',
      },
    },
  ];

  const mockInvitations = [
    {
      id: 'inv-1',
      property_id: 'prop-1',
      email: 'cleaner@test.com',
      role: 'CLEANER',
      token: 'token-abc-123',
      status: 'pending',
      expires_at: new Date(Date.now() + 40 * 3600 * 1000).toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useActiveProperty).mockReturnValue({
      activeProperty: mockProperty,
      activePropertyId: 'prop-1',
      updateProperty: vi.fn(),
      role: 'OWNER',
      isOwner: true,
      isAdmin: true,
      isOperator: true,
      isCleaner: false,
      isViewer: false,
      isLoading: false,
      properties: [{ property: mockProperty, role: 'OWNER' }],
      createProperty: vi.fn(),
      switchProperty: vi.fn(),
      refreshProperties: vi.fn(),
    });

    vi.mocked(usePropertyMembers).mockReturnValue({
      data: mockMembers,
      isLoading: false,
    } as unknown as ReturnType<typeof usePropertyMembers>);

    vi.mocked(usePropertyInvitations).mockReturnValue({
      data: mockInvitations,
      isLoading: false,
    } as unknown as ReturnType<typeof usePropertyInvitations>);
  });

  it('renders Settings tabs: Inmueble y Tarifas and Equipo y Usuarios', () => {
    renderWithProviders(<Settings />, { route: '/settings' });

    expect(screen.getByRole('button', { name: /Inmueble y Tarifas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Equipo y Usuarios/i })).toBeInTheDocument();
  });

  it('renders Property profile form by default on tab Inmueble', () => {
    renderWithProviders(<Settings />, { route: '/settings' });

    expect(screen.getByText('Perfil del Inmueble')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Apto Poblado 502')).toBeInTheDocument();
    expect(screen.getByText('Copia de Seguridad y Exportación')).toBeInTheDocument();
  });

  it('switches to Equipo y Usuarios tab on click and renders members and invitations', () => {
    renderWithProviders(<Settings />, { route: '/settings' });

    const teamTabButton = screen.getByRole('button', { name: /Equipo y Usuarios/i });
    fireEvent.click(teamTabButton);

    expect(screen.getByText('Equipo y Usuarios del Apartamento')).toBeInTheDocument();
    expect(screen.getByText('Carlos Propietario')).toBeInTheDocument();
    expect(screen.getByText('María Administradora')).toBeInTheDocument();
    expect(screen.getByText('cleaner@test.com')).toBeInTheDocument();
  });

  it('opens Invite User modal when clicking Invitar Usuario button', async () => {
    renderWithProviders(<Settings />, { route: '/settings?tab=team' });

    const inviteButton = screen.getByRole('button', { name: /Invitar Usuario/i });
    fireEvent.click(inviteButton);

    await waitFor(() => {
      expect(screen.getByText('Invitar Colaborador')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('ejemplo@correo.com')).toBeInTheDocument();
    });
  });
});
