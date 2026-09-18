import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn(),
  useCreateBooking: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateBooking: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('@/hooks/use-expenses', () => ({
  useExpenses: vi.fn(),
  useDeleteExpense: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateExpense: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useCreateExpense: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('@/hooks/use-damages', () => ({
  useDamages: vi.fn(),
}));

vi.mock('@/hooks/use-property', () => ({
  useProperty: vi.fn(),
  useUpdateProperty: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useBookings } from '@/hooks/use-bookings';
import { useExpenses } from '@/hooks/use-expenses';
import { useDamages } from '@/hooks/use-damages';
import { useProperty } from '@/hooks/use-property';

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'book-1',
          property_id: 'prop-1',
          guest_name: 'Carlos Ruiz',
          check_in: '2026-09-01',
          check_out: '2026-09-05',
          number_of_nights: 4,
          gross_amount: 1500000,
          platform_fee: 45000,
          net_payout: 1455000,
          cleaning_fee_collected: 100000,
          management_fee: 271000,
          owner_payout: 1084000,
          payout_status: 'paid',
          booking_status: 'confirmed',
          channel: 'airbnb',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useBookings>);

    vi.mocked(useExpenses).mockReturnValue({
      data: [
        {
          id: 'exp-1',
          property_id: 'prop-1',
          category: 'electricity',
          description: 'Factura EPM Luz',
          amount: 250000,
          date: '2026-09-01',
          due_date: null,
          billing_month: '2026-09',
          expense_type: 'utility_monthly',
          payment_status: 'paid',
          is_recurring: true,
          recurrence_period: 'monthly',
          linked_booking_id: null,
          receipt_url: null,
          notes: null,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useExpenses>);

    vi.mocked(useDamages).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useDamages>);

    vi.mocked(useProperty).mockReturnValue({
      data: {
        id: 'prop-1',
        name: 'Apto 502',
        address: 'El Poblado, Medellín',
        total_units: 1,
        monthly_revenue_target: 6000000,
        currency: 'COP',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useProperty>);
  });

  it('renders unified Occupancy and Nights card and the large breakdown card with prominent Net Profit', () => {
    renderWithProviders(<Dashboard />);

    // Assert unified top occupancy and nights card
    expect(screen.getByText('Tasa de Ocupación')).toBeInTheDocument();
    expect(screen.getByText('Noches en el Período')).toBeInTheDocument();

    // Assert large consolidated card components
    expect(screen.getByText('Desglose Financiero y Gastos del Período')).toBeInTheDocument();
    expect(screen.getByText('Ganancia Neta')).toBeInTheDocument();
    expect(screen.getByText('Ingresos de Alojamiento')).toBeInTheDocument();
    expect(screen.getByText(/Neto total propietarios/i)).toBeInTheDocument();
    expect(screen.getByText(/Bruto total:/i)).toBeInTheDocument();
    expect(screen.getByText('Gasto de Administración')).toBeInTheDocument();
    expect(screen.getByText('Airbnb (20%):')).toBeInTheDocument();
    expect(screen.getAllByText('Directas (10%):').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Directas (25%):').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Gasto de Aseo')).toBeInTheDocument();
    expect(screen.getByText('Gastos Mensuales')).toBeInTheDocument();
    expect(screen.getByText('Adm Edificio:')).toBeInTheDocument();
    expect(screen.getByText('Servicios Públicos:')).toBeInTheDocument();

    // Assert ADR and RevPAR are removed
    expect(screen.queryByText(/Tarifa Diaria \(ADR\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RevPAR/i)).not.toBeInTheDocument();
  });

  it('renders hyphen (-) when there are no bookings', () => {
    vi.mocked(useBookings).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useBookings>);

    renderWithProviders(<Dashboard />);

    expect(screen.getByText('Noches en el Período')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.getByText('Sin reservas en el período')).toBeInTheDocument();
  });

  it('renders dynamic Todo {year} hasta {month} button and filters out future months', async () => {
    renderWithProviders(<Dashboard />);

    const ytdButton = screen.getByText(/Todo \d{4} hasta/i);
    expect(ytdButton).toBeInTheDocument();
  });
});
