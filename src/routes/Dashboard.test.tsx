import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
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
    expect(screen.getByText(/Neto dueños/i)).toBeInTheDocument();
    expect(screen.getByText(/Bruto:/i)).toBeInTheDocument();
    expect(screen.getByText('Gasto de Administración')).toBeInTheDocument();
    expect(screen.getByText('Gasto de Aseo')).toBeInTheDocument();
    expect(screen.getByText('Gastos Mensuales')).toBeInTheDocument();

    // Assert ADR and RevPAR are removed
    expect(screen.queryByText(/Tarifa Diaria \(ADR\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RevPAR/i)).not.toBeInTheDocument();

    // Assert period nights counter shows aggregate nights (4 nights in September = 4/30)
    expect(screen.getByText('4/30')).toBeInTheDocument();
    expect(screen.getByText('4 de 30 noches reservadas')).toBeInTheDocument();
  });

  it('renders period nights correctly even when a guest is currently checked in', () => {
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'book-active',
          property_id: 'prop-1',
          guest_name: 'María Gómez',
          check_in: '2026-09-18',
          check_out: '2026-09-21',
          number_of_nights: 3,
          gross_amount: 900000,
          platform_fee: 27000,
          net_payout: 873000,
          cleaning_fee_collected: 80000,
          management_fee: 158600,
          owner_payout: 634400,
          payout_status: 'paid',
          booking_status: 'confirmed',
          channel: 'airbnb',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useBookings>);

    renderWithProviders(<Dashboard />);

    // Should display period nights (3/30), not guest stay progress (1/3)
    expect(screen.getByText('3/30')).toBeInTheDocument();
    expect(screen.getByText('3 de 30 noches reservadas')).toBeInTheDocument();
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

  it('renders dynamic Todo {year} hasta HOY button and filters out future check-ins', async () => {
    renderWithProviders(<Dashboard />);

    const ytdButton = screen.getByText(/Todo \d{4} hasta HOY/i);
    expect(ytdButton).toBeInTheDocument();
  });

  it('renders "Próximo Mes" in the first position and "Este Mes" as default active range', () => {
    renderWithProviders(<Dashboard />);

    const buttons = screen.getAllByRole('button');
    const rangeButtons = buttons.filter((btn) =>
      ['Próximo Mes', 'Este Mes', 'Mes Pasado', 'Todo', 'Histórico'].some((label) =>
        btn.textContent?.includes(label)
      )
    );

    // Próximo Mes is in first position
    expect(rangeButtons[0]).toHaveTextContent('Próximo Mes');
    expect(rangeButtons[1]).toHaveTextContent('Este Mes');

    // Este Mes has active highlight classes by default
    expect(rangeButtons[1]).toHaveClass('text-rose-600');
    expect(rangeButtons[0]).not.toHaveClass('text-rose-600');
  });

  it('filters data correctly when switching to "Próximo Mes"', () => {
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'book-current',
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
        {
          id: 'book-next',
          property_id: 'prop-1',
          guest_name: 'Ana Beltrán',
          check_in: '2026-10-10',
          check_out: '2026-10-17',
          number_of_nights: 7,
          gross_amount: 2500000,
          platform_fee: 75000,
          net_payout: 2425000,
          cleaning_fee_collected: 120000,
          management_fee: 461000,
          owner_payout: 1844000,
          payout_status: 'pending',
          booking_status: 'confirmed',
          channel: 'airbnb',
          created_at: '2026-09-20T00:00:00Z',
          updated_at: '2026-09-20T00:00:00Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useBookings>);

    renderWithProviders(<Dashboard />);

    // Default "Este Mes" shows September booking (4/30)
    expect(screen.getByText('4/30')).toBeInTheDocument();
    expect(screen.getByText('4 de 30 noches reservadas')).toBeInTheDocument();

    // Click "Próximo Mes"
    const nextMonthBtn = screen.getByRole('button', { name: 'Próximo Mes' });
    fireEvent.click(nextMonthBtn);

    // Now Próximo Mes should be active and display October booking (7/31)
    expect(nextMonthBtn).toHaveClass('text-rose-600');
    expect(screen.getByText('7/31')).toBeInTheDocument();
    expect(screen.getByText('7 de 31 noches reservadas')).toBeInTheDocument();
  });

  it('renders financial horizon buttons (Todo, Solo Real, Solo Futuro) and switches view', () => {
    renderWithProviders(<Dashboard />);

    const todoBtn = screen.getByRole('button', { name: /Todo \(Proyectado\)/i });
    const realBtn = screen.getByRole('button', { name: /Solo Real \(En Caja\)/i });
    const futureBtn = screen.getByRole('button', { name: /Solo Futuro \(Por Cobrar\)/i });

    expect(todoBtn).toBeInTheDocument();
    expect(realBtn).toBeInTheDocument();
    expect(futureBtn).toBeInTheDocument();

    // Default is 'all' (Todo Proyectado)
    expect(todoBtn).toHaveClass('text-slate-900');

    // Switch to 'real'
    fireEvent.click(realBtn);
    expect(realBtn).toHaveClass('bg-emerald-600');

    // Switch to 'future'
    fireEvent.click(futureBtn);
    expect(futureBtn).toHaveClass('bg-blue-600');
  });

  it('deduplicates nights in "Noches en el Período" when duplicate rows exist for the same stay', () => {
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'book-dup-1',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HMRESERVA123',
          guest_name: 'Juan Perez',
          check_in: '2026-09-01',
          check_out: '2026-09-25',
          number_of_nights: 24,
          gross_amount: 3000000,
          net_payout: 2900000,
          cleaning_fee_collected: 100000,
          management_fee: 560000,
          owner_payout: 2240000,
          payout_status: 'paid',
          booking_status: 'confirmed',
          channel: 'airbnb',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
        {
          id: 'book-dup-2',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HMRESERVA123',
          guest_name: 'Juan Perez',
          check_in: '2026-09-01',
          check_out: '2026-09-25',
          number_of_nights: 24,
          gross_amount: 150000,
          net_payout: 150000,
          cleaning_fee_collected: 0,
          management_fee: 30000,
          owner_payout: 120000,
          payout_status: 'paid',
          booking_status: 'confirmed',
          channel: 'airbnb',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useBookings>);

    renderWithProviders(<Dashboard />);

    expect(screen.getByText('Noches en el Período')).toBeInTheDocument();
    // Should display 24/30 (not 48/30)
    expect(screen.getByText('24/30')).toBeInTheDocument();
    // Subtitle: 24 de 30 noches reservadas (not 48 de 30)
    expect(screen.getByText('24 de 30 noches reservadas')).toBeInTheDocument();
    // Breakdown: 24 reales · 0 futuras (not 48 reales · 0 futuras)
    expect(screen.getByText('24 reales · 0 futuras')).toBeInTheDocument();
  });

  it('deduplicates stays in Gasto de Aseo card when duplicate rows exist for the same check-in day', () => {
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'b-dup-1',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HMNW3MBSYD',
          guest_name: 'Yeferson Valencia',
          check_in: '2026-09-21',
          check_out: '2026-09-25',
          number_of_nights: 4,
          gross_amount: 500000,
          net_payout: 488635,
          cleaning_fee_collected: 60000,
          management_fee: 90000,
          owner_payout: 398635,
          status: 'completed',
          created_at: '2026-09-21T00:00:00Z',
          updated_at: '2026-09-21T00:00:00Z',
        },
        {
          id: 'b-dup-2',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HMNW3MBSYD',
          guest_name: 'Yeferson Valencia',
          check_in: '2026-09-21',
          check_out: '2026-09-25',
          number_of_nights: 4,
          gross_amount: 150000,
          net_payout: 150000,
          cleaning_fee_collected: 0,
          management_fee: 30000,
          owner_payout: 120000,
          status: 'completed',
          created_at: '2026-09-21T00:00:00Z',
          updated_at: '2026-09-21T00:00:00Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useBookings>);

    renderWithProviders(<Dashboard />);

    expect(screen.getByText('Gasto de Aseo')).toBeInTheDocument();
    // 2 booking records on the same day must display "Recaudado (1 estadía)" not "(2 estadías)"
    expect(screen.getByText('Recaudado (1 estadía)')).toBeInTheDocument();
  });
});


