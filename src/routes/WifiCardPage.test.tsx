import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import WifiCardPage from './WifiCardPage';
import { renderWithProviders } from '@/test/test-utils';
import { INITIAL_GUEST_GUIDE } from '@/lib/mock-data';

vi.mock('@/hooks/use-guest-guide', () => ({
  useGuestGuide: vi.fn(),
}));

import { useGuestGuide } from '@/hooks/use-guest-guide';

describe('WifiCardPage', () => {
  it('renders Wi-Fi network SSID and password correctly for physical in-apartment QR scan', () => {
    (useGuestGuide as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        ...INITIAL_GUEST_GUIDE,
        welcome_title: 'Reserva del Mar II',
        apartment_number: 'Apto 502',
        wifi_ssid: 'ReservaMar_502_5G',
        wifi_password: 'PlayaSalguero2026!',
      },
      isLoading: false,
    });

    renderWithProviders(<WifiCardPage />);

    expect(screen.getByText('Conexión Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('ReservaMar_502_5G')).toBeInTheDocument();
    expect(screen.getByText('Ver Guía Completa')).toBeInTheDocument();
    expect(screen.getByText('Ayuda Anfitrión')).toBeInTheDocument();
  });
});
