import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import AcceptInvitation from './AcceptInvitation';
import { renderWithProviders } from '@/test/test-utils';
import { fetchInvitationByToken, acceptPropertyInvitation } from '@/lib/invitations-service';
import { useAuth } from '@/hooks/use-auth';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/invitations-service', () => ({
  fetchInvitationByToken: vi.fn(),
  acceptPropertyInvitation: vi.fn(),
}));

function renderAcceptInvitation(route = '/invite/tok-123') {
  return renderWithProviders(
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvitation />} />
    </Routes>,
    { route }
  );
}

describe('AcceptInvitation Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(fetchInvitationByToken).mockReturnValue(new Promise(() => {}));

    renderAcceptInvitation('/invite/tok-123');
    expect(screen.getByText(/Cargando invitación/i)).toBeInTheDocument();
  });

  it('renders error state when invitation does not exist', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(fetchInvitationByToken).mockResolvedValue(null);

    renderAcceptInvitation('/invite/invalid-tok');

    await waitFor(() => {
      expect(screen.getByText('Invitación no disponible')).toBeInTheDocument();
      expect(screen.getByText('Ir al Inicio de Sesión')).toBeInTheDocument();
    });
  });

  it('renders expired state when invitation has expired', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(fetchInvitationByToken).mockResolvedValue({
      invitation: {
        id: 'inv-1',
        property_id: 'prop-1',
        email: 'test@example.com',
        role: 'ADMINISTRATOR',
        invited_by: null,
        token: 'tok-123',
        status: 'pending',
        expires_at: '2026-01-01T00:00:00Z',
      },
      property: {
        id: 'prop-1',
        name: 'Apto Poblado',
        city: 'Medellín',
        address: 'El Poblado',
        currency: 'COP',
        default_nightly_rate: 250000,
        default_cleaning_fee: 80000,
        check_in_time: '15:00',
        check_out_time: '11:00',
      },
      isExpired: true,
    });

    renderAcceptInvitation('/invite/tok-123');

    await waitFor(() => {
      expect(screen.getByText('Invitación Expirada')).toBeInTheDocument();
    });
  });

  it('renders invitation details with login button when user is unauthenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(fetchInvitationByToken).mockResolvedValue({
      invitation: {
        id: 'inv-1',
        property_id: 'prop-1',
        email: 'colaborador@test.com',
        role: 'ADMINISTRATOR',
        invited_by: null,
        token: 'tok-123',
        status: 'pending',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      property: {
        id: 'prop-1',
        name: 'Suite Provenza',
        city: 'Medellín',
        address: 'Cra 35 # 8A',
        currency: 'COP',
        default_nightly_rate: 300000,
        default_cleaning_fee: 90000,
        check_in_time: '15:00',
        check_out_time: '11:00',
      },
      isExpired: false,
    });

    renderAcceptInvitation('/invite/tok-123');

    await waitFor(() => {
      expect(screen.getByText('Suite Provenza')).toBeInTheDocument();
      expect(screen.getByText('Administrador')).toBeInTheDocument();
      expect(screen.getByText('Iniciar Sesión para Aceptar')).toBeInTheDocument();
    });
  });

  it('renders accept button when user is authenticated and processes acceptance', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u-current', email: 'colaborador@test.com' },
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(fetchInvitationByToken).mockResolvedValue({
      invitation: {
        id: 'inv-1',
        property_id: 'prop-1',
        email: 'colaborador@test.com',
        role: 'OWNER',
        invited_by: null,
        token: 'tok-123',
        status: 'pending',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      property: {
        id: 'prop-1',
        name: 'Suite Provenza',
        city: 'Medellín',
        address: 'Cra 35 # 8A',
        currency: 'COP',
        default_nightly_rate: 300000,
        default_cleaning_fee: 90000,
        check_in_time: '15:00',
        check_out_time: '11:00',
      },
      isExpired: false,
    });

    vi.mocked(acceptPropertyInvitation).mockResolvedValue({
      success: true,
      property_id: 'prop-1',
    });

    renderAcceptInvitation('/invite/tok-123');

    await waitFor(() => {
      expect(screen.getByText('Suite Provenza')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Aceptar Invitación y Entrar/i })).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole('button', { name: /Aceptar Invitación y Entrar/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(acceptPropertyInvitation).toHaveBeenCalledWith('tok-123');
    });
  });
});
