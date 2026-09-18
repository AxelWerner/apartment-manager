import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Bookings from './Bookings';
import { renderWithProviders } from '@/test/test-utils';
import type { Booking } from '@/types/database';

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn(),
  useDeleteBooking: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useClearBookings: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useCreateBooking: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useUpdateBooking: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useCreateBookingsBatch: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-property', () => ({
  useProperty: vi.fn(() => ({
    data: {
      default_cleaning_fee: 60000,
      default_nightly_rate: 280000,
    },
  })),
}));

import { useBookings } from '@/hooks/use-bookings';

const mockBookings: Booking[] = [
  {
    id: 'b-1',
    property_id: 'prop-1',
    airbnb_confirmation_code: 'HM12345',
    guest_name: 'Juan Perez',
    guest_phone: null,
    number_of_guests: 2,
    check_in: '2026-09-20',
    check_out: '2026-09-23',
    number_of_nights: 3,
    nightly_rate: 12000,
    gross_amount: 103000,
    cleaning_fee_collected: 60000,
    airbnb_service_fee: 3000,
    taxes_withheld: 0,
    net_payout: 100000,
    management_fee: 4000,
    owner_payout: 36000,
    status: 'confirmed',
    payout_status: 'paid',
    payout_date: '2026-09-20',
    source: 'direct_10',
    notes: null,
  },
];

describe('Bookings Route - Revenue Breakdown and Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBookings).mockReturnValue({
      data: mockBookings,
      isLoading: false,
    } as unknown as ReturnType<typeof useBookings>);
  });

  it('renders default compact "Solo Neto" mode with owner net value', () => {
    renderWithProviders(<Bookings />);

    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('$ 36.000,00')).toBeInTheDocument();
    // In default compact mode, breakdown labels like 'Bruto:' or 'Aseo:' are not visible in the table
    expect(within(table).queryByText('Bruto:')).not.toBeInTheDocument();
    expect(within(table).queryByText('Aseo:')).not.toBeInTheDocument();
  });

  it('toggles breakdown mode when clicking the toolbar "Ver Desglose" button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Bookings />);

    const breakdownButton = screen.getByTitle('Mostrar desglose de Bruto, Aseo, Adm y Neto');
    await user.click(breakdownButton);

    const table = screen.getByRole('table');
    // Now breakdown items should be displayed inside the table
    expect(within(table).getByText('Bruto:')).toBeInTheDocument();
    expect(within(table).getByText('Aseo:')).toBeInTheDocument();
    expect(within(table).getByText('Adm (10%):')).toBeInTheDocument();
    expect(within(table).getByText('Neto:')).toBeInTheDocument();
    expect(within(table).getByText('$ 100.000,00')).toBeInTheDocument(); // Bruto
    expect(within(table).getByText('-$ 60.000,00')).toBeInTheDocument(); // Aseo
    expect(within(table).getByText('-$ 4.000,00')).toBeInTheDocument(); // Adm
  });

  it('toggles breakdown for an individual row when clicking the net payout cell', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Bookings />);

    const table = screen.getByRole('table');
    // Cell containing the net amount inside the table
    const netCell = within(table).getByText('$ 36.000,00').closest('td');
    expect(netCell).toBeInTheDocument();

    if (netCell) {
      await user.click(netCell);
    }

    // That row is now in breakdown mode
    expect(within(table).getByText('Bruto:')).toBeInTheDocument();
    expect(within(table).getByText('Aseo:')).toBeInTheDocument();
    expect(within(table).getByText('Adm (10%):')).toBeInTheDocument();
  });

  it('opens context menu on right click and allows toggling breakdown', async () => {
    renderWithProviders(<Bookings />);

    const row = screen.getByText('Juan Perez').closest('tr');
    expect(row).toBeInTheDocument();

    // Trigger right click (contextmenu)
    fireEvent.contextMenu(row!);

    // Context menu should appear
    expect(screen.getByText('Ver desglose de cálculo')).toBeInTheDocument();
    expect(screen.getByText('Cambiar todas a Desglose')).toBeInTheDocument();
    expect(screen.getByText('Editar reserva')).toBeInTheDocument();
    expect(screen.getByText('Eliminar reserva')).toBeInTheDocument();

    // Click "Ver desglose de cálculo"
    const toggleOption = screen.getByText('Ver desglose de cálculo');
    fireEvent.click(toggleOption);

    const table = screen.getByRole('table');
    // Breakdown is now visible
    expect(within(table).getByText('Bruto:')).toBeInTheDocument();
  });
});
