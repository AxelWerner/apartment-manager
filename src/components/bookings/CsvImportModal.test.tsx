import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { CsvImportModal } from './CsvImportModal';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn(() => ({ data: [] })),
  useCreateBookingsBatch: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

describe('CsvImportModal Component', () => {
  it('does not render when isOpen is false', () => {
    renderWithProviders(<CsvImportModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/Importar Reservas de Airbnb/i)).not.toBeInTheDocument();
  });

  it('renders modal header, instructions, and file upload zone when isOpen is true', () => {
    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Importador de Reservas CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/arrastra tu archivo CSV aquí/i)).toBeInTheDocument();
    expect(screen.getByText(/airbnb_\.csv/i)).toBeInTheDocument();
  });
});
