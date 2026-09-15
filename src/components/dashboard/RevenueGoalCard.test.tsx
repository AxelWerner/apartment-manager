import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevenueGoalCard } from './RevenueGoalCard';
import { renderWithProviders } from '@/test/test-utils';
import type { Booking, Property } from '@/types/database';

const mockProperty: Property = {
  id: 'test-prop-id',
  name: 'Reserva del Mar II',
  address: 'Santa Marta',
  city: 'Santa Marta',
  currency: 'COP',
  default_nightly_rate: 280000,
  default_cleaning_fee: 60000,
  monthly_revenue_target: 2000000, // 2.000.000 COP
  check_in_time: '15:00',
  check_out_time: '11:00',
};

const createMockBooking = (overrides: Partial<Booking>): Booking => ({
  id: 'b-1',
  property_id: 'test-prop-id',
  airbnb_confirmation_code: 'CONF123',
  guest_name: 'Test Guest',
  guest_phone: null,
  number_of_guests: 2,
  check_in: '2026-09-05',
  check_out: '2026-09-08',
  number_of_nights: 3,
  nightly_rate: 200000,
  gross_amount: 600000,
  cleaning_fee_collected: 60000,
  airbnb_service_fee: 50000,
  taxes_withheld: 0,
  net_payout: 500000,
  status: 'completed',
  payout_status: 'paid',
  payout_date: '2026-09-06',
  source: 'airbnb',
  notes: null,
  ...overrides,
});

describe('RevenueGoalCard Component', () => {
  it('calculates monthly revenue excluding cancelled bookings', () => {
    const bookings: Booking[] = [
      createMockBooking({ id: 'b-1', check_in: '2026-09-01', net_payout: 1000000, owner_payout: 800000, status: 'completed' }),
      createMockBooking({ id: 'b-2', check_in: '2026-09-10', net_payout: 500000, owner_payout: 400000, status: 'confirmed' }),
      createMockBooking({ id: 'b-3', check_in: '2026-09-15', net_payout: 700000, owner_payout: 560000, status: 'cancelled' }), // cancelled: ignored
      createMockBooking({ id: 'b-4', check_in: '2026-08-20', net_payout: 900000, owner_payout: 720000, status: 'completed' }), // other month: ignored
    ];

    renderWithProviders(
      <RevenueGoalCard
        bookings={bookings}
        property={mockProperty}
        currentMonthStr="2026-09"
        currentYear={2026}
      />
    );

    // Total active September revenue: 800.000 + 400.000 = 1.200.000
    // Goal: 2.000.000 COP -> 60% progress
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('displays goal achieved badge when revenue equals or exceeds target', () => {
    const bookings: Booking[] = [
      createMockBooking({ id: 'b-1', check_in: '2026-09-01', net_payout: 2500000, status: 'completed' }),
    ];

    renderWithProviders(
      <RevenueGoalCard
        bookings={bookings}
        property={mockProperty}
        currentMonthStr="2026-09"
        currentYear={2026}
      />
    );

    // 2.500.000 / 2.000.000 -> Goal achieved
    expect(screen.getByText(/¡Meta Lograda!/i)).toBeInTheDocument();
  });

  it('opens edit modal when clicking edit button', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <RevenueGoalCard
        bookings={[]}
        property={mockProperty}
        currentMonthStr="2026-09"
        currentYear={2026}
      />
    );

    const editBtn = screen.getByTitle('Editar meta mensual');
    await user.click(editBtn);

    expect(screen.getByText('Ajustar Meta Mensual de Reservas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar Meta/i })).toBeInTheDocument();
  });
});
