import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingModal } from './BookingModal';
import * as apiService from '@/lib/api-service';

vi.mock('@/lib/api-service', () => ({
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
  fetchBookings: vi.fn().mockResolvedValue([]),
  fetchProperty: vi.fn().mockResolvedValue({
    default_cleaning_fee: 60000,
    default_nightly_rate: 280000,
  }),
}));

describe('BookingModal Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderModal = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BookingModal isOpen={true} onClose={vi.fn()} {...props} />
      </QueryClientProvider>
    );
  };

  it('renders Airbnb, Directa 10% and Directa 25% modes with proper commission rates', () => {
    renderModal();

    expect(screen.getByText(/Airbnb \(20%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Directa \(10%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Directa \(25%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Comisión Admin: 20%/i)).toBeInTheDocument();
    expect(screen.getByText(/Comisión Airbnb \(~3%\)/i)).toBeInTheDocument();
  });

  it('switches to Direct 10% mode with 10% commission and $0 platform fee', async () => {
    renderModal();

    const direct10Btn = screen.getByRole('button', { name: /Directa \(10%\)/i });
    fireEvent.click(direct10Btn);

    expect(screen.getByText(/Comisión Admin: 10%/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\$ 0 \(Directa sin comisión Airbnb\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Registrar Reserva Directa \(10%\)/i)).toBeInTheDocument();
  });

  it('switches to Direct 25% mode with 25% commission and $0 platform fee', async () => {
    renderModal();

    const direct25Btn = screen.getByRole('button', { name: /Directa \(25%\)/i });
    fireEvent.click(direct25Btn);

    expect(screen.getByText(/Comisión Admin: 25%/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\$ 0 \(Directa sin comisión Airbnb\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Registrar Reserva Directa \(25%\)/i)).toBeInTheDocument();
  });

  it('calculates 10% administration fee and 90% owner payout when filling direct 10% booking form', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'b-new' });
    (apiService.createBooking as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockCreate);

    renderModal();

    // Switch to Direct 10%
    fireEvent.click(screen.getByRole('button', { name: /Directa \(10%\)/i }));

    // Fill guest name
    const guestInput = screen.getByPlaceholderText(/Ej\. Juan Pérez/i);
    fireEvent.change(guestInput, { target: { value: 'Carlos Mendoza' } });

    // Dates
    const checkInInput = screen.getByLabelText(/Check-in \*/i);
    const checkOutInput = screen.getByLabelText(/Check-out \*/i);
    fireEvent.change(checkInInput, { target: { value: '2026-10-10' } });
    fireEvent.change(checkOutInput, { target: { value: '2026-10-12' } }); // 2 nights

    // Total received
    const netPayoutInput = screen.getByLabelText(/Pago Total Recibido/i);
    fireEvent.change(netPayoutInput, { target: { value: '1.060.000' } });

    // Cleaning fee defaults to 60.000 from configuration
    // Base accommodation = 1.060.000 - 60.000 = 1.000.000
    // Admin fee (10%) = 100.000
    // Owner payout (90%) = 900.000
    expect(screen.getByText(/100\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/900\.000/i)).toBeInTheDocument();

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Registrar Reserva Directa \(10%\)/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          guest_name: 'Carlos Mendoza',
          source: 'direct_10',
          net_payout: 1060000,
          cleaning_fee_collected: 60000,
          management_fee: 100000,
          owner_payout: 900000,
          airbnb_service_fee: 0,
          number_of_nights: 2,
        })
      );
    });
  });

  it('calculates 25% administration fee and 75% owner payout when filling direct 25% booking form', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'b-new-25' });
    (apiService.createBooking as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockCreate);

    renderModal();

    // Switch to Direct 25%
    fireEvent.click(screen.getByRole('button', { name: /Directa \(25%\)/i }));

    // Fill guest name
    const guestInput = screen.getByPlaceholderText(/Ej\. Juan Pérez/i);
    fireEvent.change(guestInput, { target: { value: 'Marta Gomez' } });

    // Dates
    const checkInInput = screen.getByLabelText(/Check-in \*/i);
    const checkOutInput = screen.getByLabelText(/Check-out \*/i);
    fireEvent.change(checkInInput, { target: { value: '2026-10-15' } });
    fireEvent.change(checkOutInput, { target: { value: '2026-10-17' } }); // 2 nights

    // Total received
    const netPayoutInput = screen.getByLabelText(/Pago Total Recibido/i);
    fireEvent.change(netPayoutInput, { target: { value: '1.060.000' } });

    // Base accommodation = 1.060.000 - 60.000 = 1.000.000
    // Admin fee (25%) = 250.000
    // Owner payout (75%) = 750.000
    expect(screen.getByText(/250\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/750\.000/i)).toBeInTheDocument();

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Registrar Reserva Directa \(25%\)/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          guest_name: 'Marta Gomez',
          source: 'direct_25',
          net_payout: 1060000,
          cleaning_fee_collected: 60000,
          management_fee: 250000,
          owner_payout: 750000,
          airbnb_service_fee: 0,
          number_of_nights: 2,
        })
      );
    });
  });
});
