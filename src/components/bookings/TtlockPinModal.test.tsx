import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { TtlockPinModal } from './TtlockPinModal';
import type { Booking, BookingTtlockPin } from '@/types/database';

const mockSyncMutate = vi.fn();
const mockSyncMutateAsync = vi.fn().mockResolvedValue([]);

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u-1', email: 'axel@test.com' },
    profile: { id: 'u-1', full_name: 'Axel Werner' },
  })),
}));

vi.mock('@/hooks/use-ttlock', () => ({
  useGenerateTtlockPin: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({
      id: 'pin-999',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '654321',
      pin_type: 'one_time',
      status: 'active',
      is_mock: true,
      created_at: '2026-10-25T10:00:00Z',
      generated_by: 'Axel Werner',
    } as BookingTtlockPin),
    isPending: false,
  })),
  useSyncTtlockPins: vi.fn(() => ({
    mutate: mockSyncMutate,
    mutateAsync: mockSyncMutateAsync,
    isPending: false,
  })),
}));

describe('TtlockPinModal', () => {
  const todayStr = '2026-10-25';

  const mockBooking: Booking = {
    id: 'b-active',
    property_id: 'prop-1',
    airbnb_confirmation_code: 'HM-999',
    guest_name: 'Martin Garrix',
    guest_phone: null,
    number_of_guests: 2,
    check_in: '2026-10-25',
    check_out: '2026-10-28',
    number_of_nights: 3,
    nightly_rate: 250000,
    gross_amount: 750000,
    cleaning_fee_collected: 60000,
    airbnb_service_fee: 18000,
    taxes_withheld: 0,
    net_payout: 792000,
    status: 'confirmed',
    payout_status: 'paid',
    payout_date: null,
    source: 'airbnb',
    notes: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderWithProviders(
      <TtlockPinModal
        isOpen={false}
        onClose={vi.fn()}
        booking={mockBooking}
        todayStr={todayStr}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders confirmation view with guest details before generation', () => {
    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        todayStr={todayStr}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Martin Garrix')).toBeInTheDocument();
    expect(screen.getByText(/Confirmar y Generar One-Time PIN/i)).toBeInTheDocument();
  });

  it('generates PIN upon confirmation, passes generatedBy, and displays the digits', async () => {
    const onPinGenerated = vi.fn();
    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        todayStr={todayStr}
        onPinGenerated={onPinGenerated}
      />
    );

    const generateBtn = screen.getByText(/Confirmar y Generar One-Time PIN/i);
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByTestId('ttlock-pin-number')).toHaveTextContent('654321');
    });

    expect(onPinGenerated).toHaveBeenCalled();
  });

  it('displays existing PIN directly, shows it in PIN History, and does NOT render redundant active PIN box', () => {
    const existingPin: BookingTtlockPin = {
      id: 'pin-ex',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '333444',
      pin_type: 'one_time',
      status: 'active',
      is_mock: false,
      created_at: '2026-10-25T08:30:00Z',
      generated_by: 'Axel Werner',
    };

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        existingPins={[existingPin]}
        todayStr={todayStr}
      />
    );

    expect(screen.getByTestId('ttlock-pin-number')).toHaveTextContent('333444');
    expect(screen.getByText(/Copiar Código/i)).toBeInTheDocument();
    expect(screen.getByText(/Historial de Códigos \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Axel Werner')).toBeInTheDocument();

    // Redundant gray box should be hidden when active PIN is shown
    expect(screen.queryByText(/Generación no disponible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PIN activo: 333444/i)).not.toBeInTheDocument();

    // Verify automatic lock sync was triggered
    expect(mockSyncMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        pins: expect.arrayContaining([expect.objectContaining({ id: 'pin-ex' })]),
      })
    );
  });

  it('displays used status, timestamp, and allows generating a new PIN', () => {
    const usedPin: BookingTtlockPin = {
      id: 'pin-used',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '112233',
      pin_type: 'one_time',
      status: 'used',
      created_at: '2026-10-24T14:00:00Z',
      used_at: '2026-10-24T16:45:00Z',
      generated_by: 'Manager Ana',
    };

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        existingPins={[usedPin]}
        todayStr={todayStr}
      />
    );

    expect(screen.getByText('112233')).toBeInTheDocument();
    expect(screen.getByText('Usado')).toBeInTheDocument();
    expect(screen.getByText(/Apertura registrada/i)).toBeInTheDocument();
    expect(screen.getByText('Manager Ana')).toBeInTheDocument();

    // Because the PIN is used, activePin is null and generation is re-enabled
    expect(screen.getByText(/Confirmar y Generar One-Time PIN/i)).toBeInTheDocument();
  });

  it('displays "Borrado / Desactivado" for revoked pins and enables generating a new PIN', () => {
    const revokedPin: BookingTtlockPin = {
      id: 'pin-revoked',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '556677',
      pin_type: 'one_time',
      status: 'revoked',
      created_at: '2026-10-25T07:00:00Z',
      generated_by: 'Admin User',
    };

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        existingPins={[revokedPin]}
        todayStr={todayStr}
      />
    );

    expect(screen.getByText('556677')).toBeInTheDocument();
    expect(screen.getByText('Borrado / Desactivado')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    // Re-generation is allowed
    expect(screen.getByText(/Confirmar y Generar One-Time PIN/i)).toBeInTheDocument();
  });

  it('displays the complete history of all pins previously created for the booking', () => {
    const pin1: BookingTtlockPin = {
      id: 'pin-1',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '111111',
      pin_type: 'one_time',
      status: 'revoked',
      created_at: '2026-10-24T10:00:00Z',
      generated_by: 'Carlos Agente',
    };
    const pin2: BookingTtlockPin = {
      id: 'pin-2',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '222222',
      pin_type: 'one_time',
      status: 'used',
      created_at: '2026-10-24T18:00:00Z',
      used_at: '2026-10-24T20:00:00Z',
      generated_by: 'Laura Host',
    };
    const pin3: BookingTtlockPin = {
      id: 'pin-3',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '333333',
      pin_type: 'one_time',
      status: 'active',
      created_at: '2026-10-25T08:00:00Z',
      generated_by: 'Axel Werner',
    };

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        existingPins={[pin1, pin2, pin3]}
        todayStr={todayStr}
      />
    );

    expect(screen.getByText(/Historial de Códigos \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText('111111')).toBeInTheDocument();
    expect(screen.getByText('222222')).toBeInTheDocument();
    expect(screen.getAllByText('333333')).toHaveLength(2);
    expect(screen.getByText('Carlos Agente')).toBeInTheDocument();
    expect(screen.getByText('Laura Host')).toBeInTheDocument();
    expect(screen.getByText('Axel Werner')).toBeInTheDocument();
  });

  it('hides the PIN history section for future bookings outside the 7-day window', () => {
    const futureBooking: Booking = {
      ...mockBooking,
      id: 'b-far-future',
      guest_name: 'Futuro Huésped',
      check_in: '2026-11-20',
      check_out: '2026-11-25',
    };

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={futureBooking}
        allBookings={[futureBooking]}
        todayStr={todayStr}
      />
    );

    expect(screen.getByText('Generación no disponible')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Solo disponible para la estancia activa o la primera reserva en los próximos 7 días'
      )
    ).toBeInTheDocument();
    // History section must NOT be rendered
    expect(screen.queryByText(/Historial de Códigos/i)).not.toBeInTheDocument();
  });

  it('blocks PIN generation on old / past reservations with a clear explanation', () => {
    const pastBooking: Booking = {
      ...mockBooking,
      id: 'b-past',
      check_in: '2026-10-10',
      check_out: '2026-10-15',
    };

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={pastBooking}
        allBookings={[pastBooking]}
        todayStr={todayStr}
      />
    );

    expect(screen.getByText('Reserva Finalizada')).toBeInTheDocument();
    expect(screen.getByText(/Reserva pasada/i)).toBeInTheDocument();
    expect(screen.queryByText(/Confirmar y Generar One-Time PIN/i)).not.toBeInTheDocument();
  });

  it('blocks PIN generation for the second upcoming booking within 7 days', () => {
    const firstUpcoming: Booking = {
      ...mockBooking,
      id: 'b-first',
      guest_name: 'Laura Primera',
      check_in: '2026-10-27',
      check_out: '2026-10-29',
    };

    const secondUpcoming: Booking = {
      ...mockBooking,
      id: 'b-second',
      guest_name: 'Carlos Segundo',
      check_in: '2026-10-30',
      check_out: '2026-11-02',
    };

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={secondUpcoming}
        allBookings={[firstUpcoming, secondUpcoming]}
        todayStr={todayStr}
      />
    );

    expect(screen.getByText(/Solo se habilita para la primera reserva próxima/i)).toBeInTheDocument();
    expect(screen.getByText(/Laura Primera/i)).toBeInTheDocument();
    expect(screen.queryByText(/Confirmar y Generar One-Time PIN/i)).not.toBeInTheDocument();
    // For non-first future booking, history is also hidden
    expect(screen.queryByText(/Historial de Códigos/i)).not.toBeInTheDocument();
  });

  it('copies code when clicking the copy button', async () => {
    const user = userEvent.setup();
    const existingPin: BookingTtlockPin = {
      id: 'pin-ex',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '333444',
      pin_type: 'one_time',
      status: 'active',
    };

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        existingPins={[existingPin]}
        todayStr={todayStr}
      />
    );

    const copyBtn = screen.getByText(/Copiar Código/i);
    await user.click(copyBtn);

    expect(await navigator.clipboard.readText()).toBe('333444');
  });

  it('locks body scroll when modal is open and restores it when unmounted', () => {
    document.body.style.overflow = 'visible';

    const { unmount } = renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        todayStr={todayStr}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('visible');
  });

  it('calls onClose on Escape key and on backdrop click, but not when clicking inside modal card', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    const { container } = renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={handleClose}
        booking={mockBooking}
        todayStr={todayStr}
      />
    );

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Click inside modal card (should NOT call onClose)
    const modalDialog = screen.getByRole('dialog');
    await user.click(modalDialog);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Click on backdrop (outer overlay)
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('renders history list with scrollable overflow while keeping the top section static', () => {
    const pins: BookingTtlockPin[] = [
      { id: 'p1', booking_id: 'b-active', property_id: 'prop-1', pin: '111111', pin_type: 'one_time', status: 'revoked' },
      { id: 'p2', booking_id: 'b-active', property_id: 'prop-1', pin: '222222', pin_type: 'one_time', status: 'used' },
      { id: 'p3', booking_id: 'b-active', property_id: 'prop-1', pin: '333333', pin_type: 'one_time', status: 'active' },
    ];

    renderWithProviders(
      <TtlockPinModal
        isOpen={true}
        onClose={vi.fn()}
        booking={mockBooking}
        existingPins={pins}
        todayStr={todayStr}
      />
    );

    // Guest details are inside static flex-shrink-0 container
    const guestLabel = screen.getByText('Martin Garrix');
    const staticTop = guestLabel.closest('.flex-shrink-0');
    expect(staticTop).toBeInTheDocument();

    // History list is inside scrollable overflow-y-auto container
    const historyItem = screen.getByText('111111');
    const scrollableHistory = historyItem.closest('.overflow-y-auto');
    expect(scrollableHistory).toBeInTheDocument();
  });
});

