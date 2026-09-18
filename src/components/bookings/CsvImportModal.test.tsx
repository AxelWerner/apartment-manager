import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CsvImportModal } from './CsvImportModal';
import { renderWithProviders } from '@/test/test-utils';

const mockMutateAsync = vi.fn().mockResolvedValue({ inserted: 2, updated: 0, unchanged: 0, total: 2 });

vi.mock('@/hooks/use-bookings', () => ({
  useBookings: vi.fn(() => ({ data: [] })),
  useCreateBookingsBatch: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

describe('CsvImportModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderWithProviders(<CsvImportModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/Importador de Reservas CSV/i)).not.toBeInTheDocument();
  });

  it('renders modal header, instructions, multiple file upload zone, and dual sample button when isOpen is true', () => {
    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Importador de Reservas CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/arrastra tus archivos CSV aquí/i)).toBeInTheDocument();
    expect(screen.getByText(/Cargar ambos archivos a la vez/i)).toBeInTheDocument();
    expect(screen.getAllByText(/airbnb_\.csv/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/airbnb_pending\.csv/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows loading both sample CSV files simultaneously and displays aggregated preview', async () => {
    const user = userEvent.setup();

    const sampleCsv1 = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2026,Buchung,HMTEST01,09/11/2026,09/14/2026,3,Juan Perez,300000,60000,360000,60000`;

    const sampleCsv2 = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
10/01/2026,Buchung,HMTEST02,10/01/2026,10/05/2026,4,Maria Gomez,400000,60000,460000,60000`;

    // Mock global fetch for samples
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('airbnb_.csv')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sampleCsv1),
        });
      }
      if (url.includes('airbnb_pending.csv')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sampleCsv2),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    const loadBothButton = screen.getByText(/Cargar ambos archivos a la vez/i);
    await user.click(loadBothButton);

    await waitFor(() => {
      expect(screen.getByText(/2 archivo\(s\) procesado\(s\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Juan Perez/i)).toBeInTheDocument();
      expect(screen.getByText(/Maria Gomez/i)).toBeInTheDocument();
      expect(screen.getByText(/Total 2 reservas/i)).toBeInTheDocument();
    });
  });

  it('imports merged batch when user clicks confirm', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2026,Buchung,HMTEST01,09/11/2026,09/14/2026,3,Juan Perez,300000,60000,360000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={handleClose} />);

    const singleSampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(singleSampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Juan Perez/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirmar e Importar/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('does not render test sample shortcut buttons when in production mode (import.meta.env.DEV = false)', () => {
    const originalDev = import.meta.env.DEV;
    try {
      (import.meta.env as Record<string, unknown>).DEV = false;
      renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.queryByText(/Prueba Rápida/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Cargar ambos archivos a la vez/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^airbnb_\.csv$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^airbnb_pending\.csv$/i)).not.toBeInTheDocument();
    } finally {
      (import.meta.env as Record<string, unknown>).DEV = originalDev;
    }
  });
});
