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
    const bookingRow = screen.getByTestId('booking-row');
    expect(within(bookingRow).getByText('$ 36.000,00')).toBeInTheDocument();
    // In default compact mode, breakdown labels like 'Bruto:' or 'Aseo:' are not visible in the table
    expect(within(bookingRow).queryByText('Bruto:')).not.toBeInTheDocument();
    expect(within(bookingRow).queryByText('Aseo:')).not.toBeInTheDocument();
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

    const bookingRow = screen.getByTestId('booking-row');
    // Cell containing the net amount inside the booking row
    const netCell = within(bookingRow).getByText('$ 36.000,00').closest('td');
    expect(netCell).toBeInTheDocument();

    if (netCell) {
      await user.click(netCell);
    }

    // That row is now in breakdown mode
    expect(within(bookingRow).getByText('Bruto:')).toBeInTheDocument();
    expect(within(bookingRow).getByText('Aseo:')).toBeInTheDocument();
    expect(within(bookingRow).getByText('Adm (10%):')).toBeInTheDocument();
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

  describe('Month Grouping and Collapsing in Bookings', () => {
    const multiMonthBookings: Booking[] = [
      ...mockBookings,
      {
        id: 'b-oct-1',
        property_id: 'prop-1',
        airbnb_confirmation_code: 'HM67890',
        guest_name: 'María Gómez',
        guest_phone: null,
        number_of_guests: 3,
        check_in: '2026-10-15',
        check_out: '2026-10-20',
        number_of_nights: 5,
        nightly_rate: 150000,
        gross_amount: 800000,
        cleaning_fee_collected: 80000,
        airbnb_service_fee: 20000,
        taxes_withheld: 0,
        net_payout: 780000,
        management_fee: 140000,
        owner_payout: 560000,
        status: 'confirmed',
        payout_status: 'pending',
        payout_date: null,
        source: 'airbnb',
        notes: null,
      },
    ];

    it('renders bookings grouped by month with month headers showing label, count, nights, and net subtotal', () => {
      vi.mocked(useBookings).mockReturnValue({
        data: multiMonthBookings,
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      const monthHeaders = screen.getAllByTestId('month-group-row');
      expect(monthHeaders).toHaveLength(2); // Octubre 2026 and Septiembre 2026

      const sepHeader = screen.getByText('Septiembre 2026').closest('tr')!;
      expect(within(sepHeader).getByText('1 reserva')).toBeInTheDocument();
      expect(within(sepHeader).getByText('3 noches')).toBeInTheDocument();

      const octHeader = screen.getByText('Octubre 2026').closest('tr')!;
      expect(within(octHeader).getByText('1 reserva')).toBeInTheDocument();
      expect(within(octHeader).getByText('5 noches')).toBeInTheDocument();
    });

    it('collapses a month when clicking its group header and expands when clicked again', async () => {
      const user = userEvent.setup();
      vi.mocked(useBookings).mockReturnValue({
        data: multiMonthBookings,
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      // Both booking rows visible
      expect(screen.getAllByTestId('booking-row')).toHaveLength(2);
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      expect(screen.getByText('María Gómez')).toBeInTheDocument();

      // Click on Octubre header to collapse it
      const octHeader = screen.getByText('Octubre 2026').closest('tr')!;
      await user.click(octHeader);

      // Now María Gómez is hidden, Juan Perez remains
      expect(screen.queryByText('María Gómez')).not.toBeInTheDocument();
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      expect(screen.getAllByTestId('booking-row')).toHaveLength(1);

      // Click again to expand
      await user.click(octHeader);
      expect(screen.getByText('María Gómez')).toBeInTheDocument();
      expect(screen.getAllByTestId('booking-row')).toHaveLength(2);
    });

    it('collapses and expands all months using quick action buttons', async () => {
      const user = userEvent.setup();
      vi.mocked(useBookings).mockReturnValue({
        data: multiMonthBookings,
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      // Click "Colapsar"
      await user.click(screen.getByRole('button', { name: /Colapsar/i }));
      expect(screen.queryAllByTestId('booking-row')).toHaveLength(0);

      // Click "Expandir"
      await user.click(screen.getByRole('button', { name: /Expandir/i }));
      expect(screen.getAllByTestId('booking-row')).toHaveLength(2);
    });
  });
});

