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

    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Buchungsdatum,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2026,Buchung,HMTEST01,09/09/2026,09/11/2026,09/14/2026,3,Juan Perez,300000,60000,360000,60000`;

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
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          bookings: expect.arrayContaining([
            expect.objectContaining({
              guest_name: 'Juan Perez',
              booking_date: '2026-09-09',
            }),
          ]),
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('rejects files with multiple different years and displays an error alert', async () => {
    const user = userEvent.setup();

    // Multi-year sample: one row in 2025 and one row in 2026
    const multiYearCsv = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2025,Buchung,HMYEAR2025,09/11/2025,09/14/2025,3,Past Guest,300000,60000,360000,60000
09/12/2026,Buchung,HMYEAR2026,09/11/2026,09/14/2026,3,Current Guest,300000,60000,360000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(multiYearCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    const sampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Archivo rechazado: Múltiples años detectados/i)).toBeInTheDocument();
      expect(screen.getByText(/2 años diferentes/i)).toBeInTheDocument();
      expect(screen.queryByText(/Total 2 reservas/i)).not.toBeInTheDocument();
    });
  });

  it('detects existing bookings in the database missing from the full-year CSV and marks them for deletion', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    // Mock existing booking in DB for 2026
    const { useBookings } = await import('@/hooks/use-bookings');
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'b-old-2026',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HMOLD_DELETE',
          guest_name: 'Antiguo Huésped',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-05-01',
          check_out: '2026-05-04',
          number_of_nights: 3,
          nightly_rate: 100000,
          gross_amount: 360000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 50000,
          taxes_withheld: 0,
          net_payout: 310000,
          status: 'confirmed' as const,
          payout_status: 'paid' as const,
          payout_date: null,
          source: 'airbnb',
          notes: null,
        },
      ],
    } as unknown as ReturnType<typeof useBookings>);

    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2026,Buchung,HMNEW2026,09/11/2026,09/14/2026,3,Nuevo Huésped,300000,60000,360000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={handleClose} />);

    const sampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Año 2026 \(Año Completo\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/1 reserva\(s\) de Airbnb en la base de datos se eliminarán porque ya no están en este archivo del año 2026/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/A eliminar de la BD:/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirmar e Importar.*1 a eliminar/i });
    expect(confirmButton).toBeInTheDocument();

    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            syncYear: '2026',
            deleteMissing: true,
          }),
        })
      );
    });
  });

  it('does NOT mark direct bookings for deletion or update when importing an Airbnb CSV', async () => {
    const user = userEvent.setup();

    // Mock existing bookings: 1 direct booking and 1 airbnb booking
    const { useBookings } = await import('@/hooks/use-bookings');
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'b-direct-stay',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'DIR-2026-X',
          guest_name: 'Huésped Reserva Directa',
          guest_phone: '+57 300 123 4567',
          number_of_guests: 2,
          check_in: '2026-06-10',
          check_out: '2026-06-15',
          number_of_nights: 5,
          nightly_rate: 180000,
          gross_amount: 960000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 0,
          taxes_withheld: 0,
          net_payout: 960000,
          status: 'confirmed' as const,
          payout_status: 'paid' as const,
          payout_date: null,
          source: 'direct_10',
          notes: 'Reserva directa teléfono',
        },
        {
          id: 'b-airbnb-stay',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HM_AIRBNB_OLD',
          guest_name: 'Antiguo Airbnb',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-07-01',
          check_out: '2026-07-04',
          number_of_nights: 3,
          nightly_rate: 100000,
          gross_amount: 360000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 50000,
          taxes_withheld: 0,
          net_payout: 310000,
          status: 'confirmed' as const,
          payout_status: 'paid' as const,
          payout_date: null,
          source: 'airbnb',
          notes: null,
        },
      ],
    } as unknown as ReturnType<typeof useBookings>);

    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2026,Buchung,HM_NEW_CSV,09/11/2026,09/14/2026,3,Nuevo Huésped Airbnb,300000,60000,360000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    const sampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(sampleBtn);

    await waitFor(() => {
      // Only 1 booking should be marked for deletion (the old Airbnb booking), NOT the direct booking!
      expect(
        screen.getByText(/1 reserva\(s\) de Airbnb en la base de datos se eliminarán/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/Huésped Reserva Directa/i)).not.toBeInTheDocument();
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

