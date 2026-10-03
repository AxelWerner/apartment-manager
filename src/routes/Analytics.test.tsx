import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Analytics from './Analytics';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn(),
}));

vi.mock('@/hooks/use-property', () => ({
  useProperty: vi.fn(),
}));

import { useBookings } from '@/hooks/use-bookings';
import { useProperty } from '@/hooks/use-property';

describe('Analytics Component (Analíticas del Apto)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-15T15:00:00Z'));
    vi.mocked(useProperty).mockReturnValue({
      data: {
        id: 'prop-1',
        name: 'Reserva del Mar II',
        city: 'Santa Marta',
        currency: 'COP',
        default_nightly_rate: 300000,
        default_cleaning_fee: 60000,
        check_in_time: '15:00',
        check_out_time: '11:00',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProperty>);

    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'b-1',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HMTW8FZT3Y',
          guest_name: 'Laura Estefanía Gomez',
          guest_phone: null,
          number_of_guests: 3,
          booking_date: '2026-09-01', // 10 days lead time
          check_in: '2026-09-11',
          check_out: '2026-09-14', // 3 nights
          number_of_nights: 3,
          nightly_rate: 320000,
          gross_amount: 1020000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 30000,
          taxes_withheld: 0,
          net_payout: 960000,
          status: 'confirmed',
          payout_status: 'paid',
          payout_date: '2026-09-12',
          source: 'airbnb',
          notes: null,
        },
        {
          id: 'b-2',
          property_id: 'prop-1',
          airbnb_confirmation_code: null,
          guest_name: 'Liliana Nieto',
          guest_phone: null,
          number_of_guests: 2,
          booking_date: '2026-09-15', // 5 days lead time
          check_in: '2026-09-20',
          check_out: '2026-09-25', // 5 nights
          number_of_nights: 5,
          nightly_rate: 280000,
          gross_amount: 1460000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 0,
          taxes_withheld: 0,
          net_payout: 1400000,
          status: 'confirmed',
          payout_status: 'paid',
          payout_date: '2026-09-21',
          source: 'direct',
          notes: null,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useBookings>);
  });

  it('renders the header and all 5 requested KPIs: ADR, Ocupacion, LOS, Lead Time, and RevPar', () => {
    renderWithProviders(<Analytics />);

    // Header
    expect(screen.getByText('Analíticas del Apto')).toBeInTheDocument();
    expect(screen.getByText(/Indicadores de desempeño hotelero y rentabilidad/i)).toBeInTheDocument();

    // 1. ADR
    expect(screen.getAllByText('ADR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Precio Promedio / Noche')).toBeInTheDocument();

    // 2. Ocupación
    expect(screen.getAllByText('Ocupación').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Porcentaje de Noches')).toBeInTheDocument();

    // 3. RevPAR
    expect(screen.getAllByText('RevPAR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Rentabilidad Noche Disp.')).toBeInTheDocument();
    expect(screen.getByText(/Total noches \/ 30 días del mes/i)).toBeInTheDocument();

    // 4. LOS
    expect(screen.getAllByText('LOS').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Duración de Estadía')).toBeInTheDocument();

    // 5. Lead Time
    expect(screen.getAllByText('Lead Time').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ventana de Reserva')).toBeInTheDocument();
  });

  it('renders multi-month chart, daily occupancy calendar, distribution cards, and tables', () => {
    renderWithProviders(<Analytics />);

    expect(screen.getByText('Evolución Multimes: ADR, RevPAR y Ocupación')).toBeInTheDocument();
    expect(screen.getByText(/Calendario Diario de Ocupación/i)).toBeInTheDocument();
    expect(screen.getByText('Distribución de Duración (LOS)')).toBeInTheDocument();
    expect(screen.getByText('Ventana de Reserva (Lead Time)')).toBeInTheDocument();
    expect(screen.getByText('Tabla Comparativa Mes a Mes')).toBeInTheDocument();
    expect(screen.getByText(/Detalle de Reservas del Mes/i)).toBeInTheDocument();

    // Booking guests rendered
    expect(screen.getAllByText('Laura Estefanía Gomez').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Liliana Nieto').length).toBeGreaterThanOrEqual(1);
  });

  it('allows filtering by channel (Airbnb vs Directas)', () => {
    renderWithProviders(<Analytics />);

    const channelSelect = screen.getByLabelText(/Filtrar por canal de reserva/i);
    expect(channelSelect).toBeInTheDocument();

    // Select Airbnb only
    fireEvent.change(channelSelect, { target: { value: 'airbnb' } });

    // Laura Estefanía Gomez should remain (airbnb)
    expect(screen.getAllByText('Laura Estefanía Gomez').length).toBeGreaterThanOrEqual(1);
  });

  it('handles loading state properly', () => {
    vi.mocked(useBookings).mockReturnValue({
      data: [],
      isLoading: true,
    } as unknown as ReturnType<typeof useBookings>);

    renderWithProviders(<Analytics />);
    expect(screen.getByText('Calculando analíticas del apartamento...')).toBeInTheDocument();
  });
});
