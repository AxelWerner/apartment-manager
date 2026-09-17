import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Bookings from './Bookings';
import * as apiService from '@/lib/api-service';
import type { Booking } from '@/types/database';

vi.mock('@/lib/api-service', () => ({
  fetchBookings: vi.fn(),
  deleteBooking: vi.fn(),
  clearAllBookings: vi.fn(),
}));

describe('Bookings Route', () => {
  let queryClient: QueryClient;

  const mockBookings: Booking[] = [
    {
      id: 'b-1',
      property_id: 'prop-1',
      airbnb_confirmation_code: 'HM123456',
      guest_name: 'Ana Airbnb',
      guest_phone: null,
      number_of_guests: 2,
      check_in: '2026-09-10',
      check_out: '2026-09-12',
      number_of_nights: 2,
      nightly_rate: 100000,
      gross_amount: 300000,
      cleaning_fee_collected: 60000,
      airbnb_service_fee: 10000,
      taxes_withheld: 0,
      net_payout: 260000,
      management_fee: 40000,
      owner_payout: 160000,
      status: 'completed',
      payout_status: 'paid',
      payout_date: '2026-09-10',
      source: 'airbnb',
      notes: null,
    },
    {
      id: 'b-2',
      property_id: 'prop-1',
      airbnb_confirmation_code: null,
      guest_name: 'Daniel Directo',
      guest_phone: null,
      number_of_guests: 2,
      check_in: '2026-09-15',
      check_out: '2026-09-18',
      number_of_nights: 3,
      nightly_rate: 300000,
      gross_amount: 1090000,
      cleaning_fee_collected: 90000,
      airbnb_service_fee: 0,
      taxes_withheld: 0,
      net_payout: 1090000,
      management_fee: 100000,
      owner_payout: 900000,
      status: 'confirmed',
      payout_status: 'paid',
      payout_date: '2026-09-15',
      source: 'direct',
      notes: null,
    },
    {
      id: 'b-3',
      property_id: 'prop-1',
      airbnb_confirmation_code: null,
      guest_name: 'Valeria Directa 25',
      guest_phone: null,
      number_of_guests: 3,
      check_in: '2026-09-20',
      check_out: '2026-09-23',
      number_of_nights: 3,
      nightly_rate: 200000,
      gross_amount: 660000,
      cleaning_fee_collected: 60000,
      airbnb_service_fee: 0,
      taxes_withheld: 0,
      net_payout: 660000,
      management_fee: 150000,
      owner_payout: 450000,
      status: 'confirmed',
      payout_status: 'paid',
      payout_date: '2026-09-20',
      source: 'direct_25',
      notes: null,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    (apiService.fetchBookings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockBookings);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Bookings />
      </QueryClientProvider>
    );
  };

  it('renders bookings list with badges for Airbnb (20%), Directa (10%), and Directa (25%)', async () => {
    renderComponent();

    expect(await screen.findByText('Ana Airbnb')).toBeInTheDocument();
    expect(screen.getByText('Daniel Directo')).toBeInTheDocument();
    expect(screen.getByText('Valeria Directa 25')).toBeInTheDocument();

    expect(screen.getAllByText('Airbnb (20%)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Directa (10%)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Directa (25%)').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by channel correctly', async () => {
    renderComponent();

    expect(await screen.findByText('Ana Airbnb')).toBeInTheDocument();
    expect(screen.getByText('Daniel Directo')).toBeInTheDocument();
    expect(screen.getByText('Valeria Directa 25')).toBeInTheDocument();

    // Select "Todas las Directas" filter
    const channelSelect = screen.getByDisplayValue('Todos los orígenes');
    fireEvent.change(channelSelect, { target: { value: 'direct_all' } });

    expect(screen.queryByText('Ana Airbnb')).not.toBeInTheDocument();
    expect(screen.getByText('Daniel Directo')).toBeInTheDocument();
    expect(screen.getByText('Valeria Directa 25')).toBeInTheDocument();

    // Select "Directas (25%)" filter
    fireEvent.change(channelSelect, { target: { value: 'direct_25' } });
    expect(screen.queryByText('Ana Airbnb')).not.toBeInTheDocument();
    expect(screen.queryByText('Daniel Directo')).not.toBeInTheDocument();
    expect(screen.getByText('Valeria Directa 25')).toBeInTheDocument();

    // Select "Directas (10%)" filter
    fireEvent.change(channelSelect, { target: { value: 'direct_10' } });
    expect(screen.queryByText('Ana Airbnb')).not.toBeInTheDocument();
    expect(screen.getByText('Daniel Directo')).toBeInTheDocument();
    expect(screen.queryByText('Valeria Directa 25')).not.toBeInTheDocument();

    // Select "Airbnb (20%)" filter
    fireEvent.change(channelSelect, { target: { value: 'airbnb' } });
    expect(screen.getByText('Ana Airbnb')).toBeInTheDocument();
    expect(screen.queryByText('Daniel Directo')).not.toBeInTheDocument();
    expect(screen.queryByText('Valeria Directa 25')).not.toBeInTheDocument();
  });
});
