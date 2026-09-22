import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import GuestPortal from './GuestPortal';
import { renderWithProviders } from '@/test/test-utils';
import { INITIAL_GUEST_GUIDE } from '@/lib/mock-data';

vi.mock('@/hooks/use-guest-guide', () => ({
  useGuestGuide: vi.fn(),
  useUpdateGuestGuide: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

import { useGuestGuide } from '@/hooks/use-guest-guide';

describe('GuestPortal', () => {
  it('renders property title, Wi-Fi SSID, and access code when show_access_code is true', () => {
    (useGuestGuide as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        ...INITIAL_GUEST_GUIDE,
        welcome_title: 'Reserva del Mar II',
        show_access_code: true,
        access_code: '4820 #',
      },
      isLoading: false,
    });

    renderWithProviders(<GuestPortal />);

    expect(screen.getAllByText(/Reserva del Mar II/i).length).toBeGreaterThan(0);
    expect(screen.getByText('ReservaMar_502_5G')).toBeInTheDocument();
    expect(screen.getByText('4820 #')).toBeInTheDocument();
    expect(screen.getByText(/Horas de Silencio y Tranquilidad/i)).toBeInTheDocument();
  });

  it('hides access code and displays private message when show_access_code is false', () => {
    (useGuestGuide as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        ...INITIAL_GUEST_GUIDE,
        welcome_title: 'Reserva del Mar II',
        show_access_code: false,
        access_code: '4820 #',
      },
      isLoading: false,
    });

    renderWithProviders(<GuestPortal />);

    expect(screen.queryByText('4820 #')).not.toBeInTheDocument();
    expect(screen.getByText(/Código de acceso privado/i)).toBeInTheDocument();
    expect(screen.getByText(/tu anfitrión te enviará el código exclusivo de acceso/i)).toBeInTheDocument();
  });

  it('renders key distances section and places', () => {
    (useGuestGuide as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        ...INITIAL_GUEST_GUIDE,
        welcome_title: 'Reserva del Mar II',
      },
      isLoading: false,
    });

    renderWithProviders(<GuestPortal />);

    expect(screen.getByText('Distancias y Puntos de Interés')).toBeInTheDocument();
    expect(screen.getByText(/Aeropuerto Internacional Simón Bolívar/i)).toBeInTheDocument();
    expect(screen.getByText('Centro Histórico de Santa Marta')).toBeInTheDocument();
  });
});
