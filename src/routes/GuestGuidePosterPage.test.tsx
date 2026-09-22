import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import GuestGuidePosterPage from './GuestGuidePosterPage';
import { renderWithProviders } from '@/test/test-utils';
import { INITIAL_GUEST_GUIDE } from '@/lib/mock-data';

vi.mock('@/hooks/use-guest-guide', () => ({
  useGuestGuide: vi.fn(),
}));

import { useGuestGuide } from '@/hooks/use-guest-guide';

describe('GuestGuidePosterPage', () => {
  const mockGuideData = {
    ...INITIAL_GUEST_GUIDE,
    welcome_title: 'Apartamento Reserva del Mar II',
    apartment_number: 'Apto 502',
    wifi_ssid: 'ReservaMar_502_5G',
    wifi_password: 'PlayaSalguero2026!',
    check_in_time: '15:00',
    check_out_time: '11:00',
    access_code: '4820 #',
    show_access_code: true,
    host_name: 'Axel Werner',
    host_phone: '+57 300 123 4567',
  };

  it('renders Variant 1 (Guía Digital e Información Clave) in Bilingual format by default', () => {
    (useGuestGuide as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockGuideData,
      isLoading: false,
    });

    renderWithProviders(<GuestGuidePosterPage />);

    expect(screen.getByText('Plantillas de Lámina QR Fijas')).toBeInTheDocument();
    expect(screen.getAllByText('Apartamento Reserva del Mar II').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Apto 502').length).toBeGreaterThan(0);
    expect(screen.getByText('A5 • Bilingüe')).toBeInTheDocument();

    // Schedule & Rules (without PIN, without host info, in bilingual format)
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(screen.getByText('11:00')).toBeInTheDocument();
    expect(screen.queryByText('4820 #')).toBeNull();
    expect(screen.queryByText('Axel Werner')).toBeNull();

    // Bilingual rules (2 lines)
    expect(screen.getByText('Normas Clave / House Rules')).toBeInTheDocument();
    expect(screen.getByText('Prohibido fumar')).toBeInTheDocument();
    expect(screen.getByText('No smoking anywhere')).toBeInTheDocument();
    expect(screen.getByText('Usar A/A en 22°-24° (apagar al salir)')).toBeInTheDocument();
    expect(screen.getByText('Set A/C to 22°-24°C & turn off when leaving')).toBeInTheDocument();
  });


  it('allows switching to Variant 2 (Solo Conexión Wi-Fi) with large network credentials and connection QR', () => {
    (useGuestGuide as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockGuideData,
      isLoading: false,
    });

    renderWithProviders(<GuestGuidePosterPage />);

    const wifiBtn = screen.getByRole('button', { name: /2\. Solo Conexión Wi-Fi/i });
    fireEvent.click(wifiBtn);

    expect(screen.getByText('Escanear para Conectar')).toBeInTheDocument();
    expect(screen.getByText('ReservaMar_502_5G')).toBeInTheDocument();
    expect(screen.getByText('PlayaSalguero2026!')).toBeInTheDocument();
  });

  it('allows switching pastel themes and triggers window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    (useGuestGuide as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockGuideData,
      isLoading: false,
    });

    renderWithProviders(<GuestGuidePosterPage />);

    // Switch to Sky theme
    const skyBtn = screen.getByRole('button', { name: /Cielo/i });
    fireEvent.click(skyBtn);

    // Print button
    const printBtn = screen.getByRole('button', { name: /Imprimir \/ PDF/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
