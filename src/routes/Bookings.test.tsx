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

vi.mock('@/hooks/use-ttlock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-ttlock')>();
  return {
    ...actual,
    useBookingPins: vi.fn(() => ({ data: [], isLoading: false })),
    useAllPropertyLocks: vi.fn(() => ({
      data: [
        {
          property_id: 'prop-1',
          lock_id: 31266290,
          is_active: true,
        },
      ],
      isLoading: false,
    })),
  };
});

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

  describe('Financial Horizon (Real vs Futuro)', () => {
    const horizonBookings: Booking[] = [
      {
        id: 'b-real',
        property_id: 'prop-1',
        airbnb_confirmation_code: 'HMREAL',
        guest_name: 'Huésped Real',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-09-01',
        check_out: '2026-09-05',
        number_of_nights: 4,
        nightly_rate: 100000,
        gross_amount: 400000,
        cleaning_fee_collected: 50000,
        airbnb_service_fee: 10000,
        taxes_withheld: 0,
        net_payout: 390000,
        management_fee: 34000,
        owner_payout: 306000,
        status: 'confirmed',
        payout_status: 'paid',
        payout_date: '2026-09-02',
        source: 'direct_10',
        notes: null,
      },
      {
        id: 'b-future',
        property_id: 'prop-1',
        airbnb_confirmation_code: 'HMFUTURE',
        guest_name: 'Huésped Futuro',
        guest_phone: null,
        number_of_guests: 2,
        check_in: '2026-11-20',
        check_out: '2026-11-25',
        number_of_nights: 5,
        nightly_rate: 100000,
        gross_amount: 500000,
        cleaning_fee_collected: 50000,
        airbnb_service_fee: 15000,
        taxes_withheld: 0,
        net_payout: 485000,
        management_fee: 43500,
        owner_payout: 391500,
        status: 'confirmed',
        payout_status: 'pending',
        payout_date: null,
        source: 'direct_10',
        notes: null,
      },
    ];

    it('displays Real and Futuro badges on booking rows and filters correctly with horizon buttons', async () => {
      const user = userEvent.setup();
      vi.mocked(useBookings).mockReturnValue({
        data: horizonBookings,
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      // Both should be visible in 'Todas'
      expect(screen.getByText('Huésped Real')).toBeInTheDocument();
      expect(screen.getByText('Huésped Futuro')).toBeInTheDocument();

      // Check badges exist
      expect(screen.getByText('Cobrado (Real)')).toBeInTheDocument();
      expect(screen.getByText('Por cobrar (Futuro)')).toBeInTheDocument();

      // Click "Solo Real"
      const realButton = screen.getByRole('button', { name: 'Solo Real' });
      await user.click(realButton);

      expect(screen.getByText('Huésped Real')).toBeInTheDocument();
      expect(screen.queryByText('Huésped Futuro')).not.toBeInTheDocument();

      // Click "Solo Futuro"
      const futureButton = screen.getByRole('button', { name: 'Solo Futuro' });
      await user.click(futureButton);

      expect(screen.queryByText('Huésped Real')).not.toBeInTheDocument();
      expect(screen.getByText('Huésped Futuro')).toBeInTheDocument();

      // Click "Todas" to restore
      const allButton = screen.getByRole('button', { name: 'Todas' });
      await user.click(allButton);

      expect(screen.getByText('Huésped Real')).toBeInTheDocument();
      expect(screen.getByText('Huésped Futuro')).toBeInTheDocument();
    });

    it('displays Real vs Futuro breakdowns in the KPI summary cards', () => {
      vi.mocked(useBookings).mockReturnValue({
        data: horizonBookings,
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      // Should display real and future sublabels in the KPI cards
      expect(screen.getAllByText(/reales/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/futuras/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Real en caja:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Futuro:/i).length).toBeGreaterThan(0);
    });

    it('deduplicates stays in KPI cards and month headers when duplicate booking rows exist on the same day', () => {
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
            net_payout: 488635,
            cleaning_fee_collected: 60000,
            status: 'completed',
            source: 'airbnb',
          },
          {
            id: 'b-dup-2',
            property_id: 'prop-1',
            airbnb_confirmation_code: 'HMNW3MBSYD',
            guest_name: 'Yeferson Valencia',
            check_in: '2026-09-21',
            check_out: '2026-09-25',
            number_of_nights: 4,
            net_payout: 150000,
            cleaning_fee_collected: 0,
            status: 'completed',
            source: 'airbnb',
          },
        ],
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      // The month header badge should show "1 reserva" (not "2 reservas")
      expect(screen.getByText('1 reserva')).toBeInTheDocument();
      // The total nights should be 4 (in KPI card and month header), not 8
      expect(screen.getAllByText(/4\s*noches/).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Search and Filter Controls in Bookings', () => {
    it('filters bookings by guest name and clears input with the clear button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Bookings />);

      expect(screen.getByText('Juan Perez')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('Buscar por huésped o código...');
      await user.type(searchInput, 'Inexistente');

      expect(screen.queryByText('Juan Perez')).not.toBeInTheDocument();
      expect(screen.getByText('No se encontraron reservas con los filtros aplicados.')).toBeInTheDocument();

      const clearButton = screen.getByTitle('Limpiar búsqueda');
      await user.click(clearButton);

      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    });
  });

  describe('Bookings with Extra Charges (e.g. late check-out)', () => {
    it('displays extra amount badge and shows extra row in breakdown mode', async () => {
      const user = userEvent.setup();
      const bookingWithExtra: Booking = {
        ...mockBookings[0],
        id: 'b-extra-row',
        guest_name: 'Santiago Botero',
        extra_amount: 50000,
        extra_description: 'Late check-out 5 horas',
        management_fee: 14000, // 4000 + 20% of 50000 (10000)
        owner_payout: 76000,  // 36000 + 80% of 50000 (40000)
      };

      vi.mocked(useBookings).mockReturnValue({
        data: [bookingWithExtra],
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      expect(screen.getByText('Santiago Botero')).toBeInTheDocument();
      // Badge under guest name
      expect(
        screen.getByText((content) => content.includes('50.000') && content.includes('Extra'))
      ).toBeInTheDocument();

      // Open breakdown by clicking the calculation toggle button
      const breakdownBtn = screen.getAllByTitle(/Ver desglose de cálculo/i)[0];
      await user.click(breakdownBtn);

      // Check breakdown content includes Extra line
      expect(screen.getByText(/Extra.*Late check-out/i)).toBeInTheDocument();
      expect(
        screen.getAllByText((content) => content.includes('50.000')).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('TTLock Smart Lock PIN Modal', () => {
    it('allows opening the PIN modal from the action button and context menu', async () => {
      const user = userEvent.setup();
      const todayDate = new Date().toISOString().slice(0, 10);
      const activeBooking: Booking = {
        ...mockBookings[0],
        id: 'b-active-today',
        guest_name: 'Laura Acuña',
        check_in: todayDate,
        check_out: '2026-10-30',
      };

      vi.mocked(useBookings).mockReturnValue({
        data: [activeBooking],
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      // Cerradura action button in row
      const lockBtn = screen.getByTitle('Cerradura TTLock (PIN)');
      expect(lockBtn).toBeInTheDocument();
      expect(lockBtn).not.toBeDisabled();

      await user.click(lockBtn);

      // Verify Modal opens
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText('Laura Acuña')).toBeInTheDocument();
      expect(within(dialog).getByText(/Confirmar y Generar One-Time PIN/i)).toBeInTheDocument();
    });

    it('disables key button and context menu item when property lock is inactive or not configured', async () => {
      const user = userEvent.setup();
      const todayDate = new Date().toISOString().slice(0, 10);
      const activeBooking: Booking = {
        ...mockBookings[0],
        id: 'b-active-today',
        guest_name: 'Laura Acuña',
        property_id: 'prop-inactive-lock',
        check_in: todayDate,
        check_out: '2026-10-30',
      };

      vi.mocked(useBookings).mockReturnValue({
        data: [activeBooking],
        isLoading: false,
      } as unknown as ReturnType<typeof useBookings>);

      renderWithProviders(<Bookings />);

      // Verify toggle button does NOT exist in toolbar (removed as only Super Dueño manages it in Settings)
      expect(screen.queryByRole('switch', { name: /PIN Cerradura/i })).not.toBeInTheDocument();

      // Key button in row is disabled
      const disabledLockBtn = screen.getByTitle('Cerradura no configurada o inactiva');
      expect(disabledLockBtn).toBeInTheDocument();
      expect(disabledLockBtn).toBeDisabled();

      // Right-click row to open context menu
      const row = screen.getByText('Laura Acuña').closest('tr');
      fireEvent.contextMenu(row!);

      // Context menu item is disabled without DESACTIVADO text
      const contextMenuItem = screen.getByRole('button', { name: /Cerradura TTLock/i });
      expect(contextMenuItem).toBeInTheDocument();
      expect(contextMenuItem).toBeDisabled();
      expect(screen.queryByText('Desactivado')).not.toBeInTheDocument();

      // Clicking disabled context menu item does not open modal
      await user.click(contextMenuItem);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

