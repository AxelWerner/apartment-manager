import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { TtlockPinCell } from './TtlockPinCell';
import type { Booking, BookingTtlockPin } from '@/types/database';

describe('TtlockPinCell', () => {
  const todayStr = '2026-10-25';

  const mockBooking: Booking = {
    id: 'b-active',
    property_id: 'prop-1',
    airbnb_confirmation_code: 'HM-111',
    guest_name: 'David Guetta',
    guest_phone: null,
    number_of_guests: 2,
    check_in: '2026-10-25',
    check_out: '2026-10-28',
    number_of_nights: 3,
    nightly_rate: 200000,
    gross_amount: 600000,
    cleaning_fee_collected: 50000,
    airbnb_service_fee: 15000,
    taxes_withheld: 0,
    net_payout: 635000,
    status: 'confirmed',
    payout_status: 'paid',
    payout_date: null,
    source: 'airbnb',
    notes: null,
  };

  it('renders "Generar PIN" button when booking is eligible', () => {
    const onOpenModal = vi.fn();
    renderWithProviders(
      <TtlockPinCell
        booking={mockBooking}
        allBookings={[mockBooking]}
        existingPins={[]}
        todayStr={todayStr}
        onOpenModal={onOpenModal}
      />
    );

    const button = screen.getByTestId('generate-pin-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Generar PIN');

    fireEvent.click(button);
    expect(onOpenModal).toHaveBeenCalledWith(mockBooking, null);
  });

  it('renders active PIN badge when already generated', () => {
    const existingPin: BookingTtlockPin = {
      id: 'pin-1',
      booking_id: 'b-active',
      property_id: 'prop-1',
      pin: '789123',
      pin_type: 'one_time',
      status: 'active',
    };

    const onOpenModal = vi.fn();
    renderWithProviders(
      <TtlockPinCell
        booking={mockBooking}
        allBookings={[mockBooking]}
        existingPins={[existingPin]}
        todayStr={todayStr}
        onOpenModal={onOpenModal}
      />
    );

    expect(screen.getByText('789123')).toBeInTheDocument();
    expect(screen.queryByTestId('generate-pin-button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('789123'));
    expect(onOpenModal).toHaveBeenCalledWith(mockBooking, existingPin);
  });

  it('renders "En espera" badge when not the closest upcoming booking', () => {
    const closestBooking: Booking = {
      ...mockBooking,
      id: 'b-closest',
      guest_name: 'Ana Maria',
      check_in: '2026-10-26',
      check_out: '2026-10-28',
    };

    const laterBooking: Booking = {
      ...mockBooking,
      id: 'b-later',
      guest_name: 'Pedro Pascal',
      check_in: '2026-10-29',
      check_out: '2026-10-31',
    };

    renderWithProviders(
      <TtlockPinCell
        booking={laterBooking}
        allBookings={[closestBooking, laterBooking]}
        existingPins={[]}
        todayStr={todayStr}
        onOpenModal={vi.fn()}
      />
    );

    const waitingBadge = screen.getByText('En espera');
    expect(waitingBadge).toBeInTheDocument();
  });

  it('renders dash for bookings outside the 7-day window', () => {
    const farBooking: Booking = {
      ...mockBooking,
      id: 'b-far',
      check_in: '2026-11-20',
      check_out: '2026-11-25',
    };

    renderWithProviders(
      <TtlockPinCell
        booking={farBooking}
        allBookings={[farBooking]}
        existingPins={[]}
        todayStr={todayStr}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
