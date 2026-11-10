import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CsvImportModal } from './CsvImportModal';
import { renderWithProviders } from '@/test/test-utils';
import { AuthContext, type AuthContextType } from '@/context/auth-context-def';

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
    localStorage.clear();
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

  it('imports all rows even if the confirmation code or guest name is repeated', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    // Sample CSV with repeated confirmation code and repeated guest name
    const duplicateCsv = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2026,Buchung,HM_REPEAT,09/11/2026,09/14/2026,3,Juan Perez,300000,60000,360000,60000
09/20/2026,Buchung,HM_REPEAT,09/18/2026,09/21/2026,3,Juan Perez,250000,60000,310000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(duplicateCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={handleClose} />);

    const singleSampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(singleSampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Total 2 reservas/i)).toBeInTheDocument();
      expect(screen.getAllByText('Juan Perez').length).toBe(2);
      expect(screen.getAllByText('HM_REPEAT').length).toBe(2);
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar e Importar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          bookings: expect.arrayContaining([
            expect.objectContaining({ airbnb_confirmation_code: 'HM_REPEAT', guest_name: 'Juan Perez' }),
          ]),
        })
      );
      const callArg = mockMutateAsync.mock.calls[0][0];
      expect(callArg.bookings.length).toBe(2);
    });
  });

  it('accepts files with multiple different years and displays all reservations', async () => {
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
      expect(screen.getByText(/Total 2 reservas/i)).toBeInTheDocument();
      expect(screen.getByText(/Past Guest/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Guest/i)).toBeInTheDocument();
      expect(screen.getByText(/Años: 2025, 2026/i)).toBeInTheDocument();
    });
  });

  it('detects existing bookings in the database and marks all existing Airbnb bookings for deletion', async () => {
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
          check_in: '2026-09-01',
          check_out: '2026-09-04',
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
      expect(screen.getByText(/Año 2026/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Se reemplazarán las reservas de Airbnb de los meses a importar \(1 en la base de datos/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/A borrar en BD \(Airbnb\):/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirmar e Importar.*1 a eliminar/i });
    expect(confirmButton).toBeInTheDocument();

    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            deleteMonths: ['2026-09'],
          }),
        })
      );
    });
  });

  it('does NOT mark direct bookings for deletion or update when importing an Airbnb CSV', async () => {
    const user = userEvent.setup();

    // Mock existing bookings: 1 direct booking and 1 airbnb booking in the same month (September)
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
          check_in: '2026-09-01',
          check_out: '2026-09-04',
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
      // Only 1 booking should be marked for deletion (the old Airbnb booking from September), NOT the direct booking!
      expect(
        screen.getByText(/Se reemplazarán las reservas de Airbnb de los meses a importar \(1 en la base de datos/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/Huésped Reserva Directa/i)).not.toBeInTheDocument();
    });
  });

  it('only marks Airbnb bookings for deletion if they belong to the months present in the imported file (e.g. April & June, leaving May untouched)', async () => {
    const user = userEvent.setup();

    const { useBookings } = await import('@/hooks/use-bookings');
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'b-april',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HM-APRIL',
          guest_name: 'Huésped Abril',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-04-10',
          check_out: '2026-04-15',
          number_of_nights: 5,
          nightly_rate: 100000,
          gross_amount: 500000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 50000,
          taxes_withheld: 0,
          net_payout: 450000,
          status: 'completed',
          payout_status: 'paid',
          payout_date: '2026-04-10',
          source: 'airbnb',
          notes: null,
        },
        {
          id: 'b-may',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HM-MAY',
          guest_name: 'Huésped Mayo',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-05-10',
          check_out: '2026-05-15',
          number_of_nights: 5,
          nightly_rate: 100000,
          gross_amount: 500000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 50000,
          taxes_withheld: 0,
          net_payout: 450000,
          status: 'completed',
          payout_status: 'paid',
          payout_date: '2026-05-10',
          source: 'airbnb',
          notes: null,
        },
        {
          id: 'b-june',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HM-JUNE',
          guest_name: 'Huésped Junio',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-06-10',
          check_out: '2026-06-15',
          number_of_nights: 5,
          nightly_rate: 100000,
          gross_amount: 500000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 50000,
          taxes_withheld: 0,
          net_payout: 450000,
          status: 'completed',
          payout_status: 'paid',
          payout_date: '2026-06-10',
          source: 'airbnb',
          notes: null,
        },
      ],
    } as unknown as ReturnType<typeof useBookings>);

    // Import file contains April and June bookings only
    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
04/10/2026,Buchung,HM-NEW-APR,04/10/2026,04/12/2026,2,Nuevo Abril,200000,60000,260000,40000
06/10/2026,Buchung,HM-NEW-JUN,06/10/2026,06/13/2026,3,Nuevo Junio,300000,60000,360000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    const sampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(sampleBtn);

    await waitFor(() => {
      // Exactly 2 bookings to delete (April and June), while May is untouched!
      expect(
        screen.getByText(/Se reemplazarán las reservas de Airbnb de los meses a importar \(2 en la base de datos/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/A borrar en BD \(Airbnb\):/i)).toBeInTheDocument();
    });
  });

  it('correctly reads Reinigungsgebühr column for cleaning fee (aseo), respecting 0 and custom fees', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    // Row 1 has Reinigungsgebühr = 0.00
    // Row 2 has Reinigungsgebühr = 80000.00
    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2026,Buchung,HM_CLEAN_0,09/11/2026,09/14/2026,3,Guest Zero Cleaning,300000,0.00,360000,60000
09/20/2026,Buchung,HM_CLEAN_80,09/18/2026,09/21/2026,3,Guest Eighty Cleaning,380000,80000.00,440000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={handleClose} />);

    const sampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Guest Zero Cleaning/i)).toBeInTheDocument();
      expect(screen.getByText(/Guest Eighty Cleaning/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar e Importar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          bookings: expect.arrayContaining([
            expect.objectContaining({
              airbnb_confirmation_code: 'HM_CLEAN_0',
              cleaning_fee_collected: 0,
            }),
            expect.objectContaining({
              airbnb_confirmation_code: 'HM_CLEAN_80',
              cleaning_fee_collected: 80000,
            }),
          ]),
        })
      );
    });
  });

  it('allows toggling between Reservas ya hechas and Reservas futuras tabs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    const completedTab = screen.getByRole('button', { name: /Reservas ya hechas/i });
    const pendingTab = screen.getByRole('button', { name: /Reservas futuras/i });

    expect(completedTab).toBeInTheDocument();
    expect(pendingTab).toBeInTheDocument();

    // Default mode is completed
    expect(screen.getByText(/Selecciona el archivo de reservas completadas/i)).toBeInTheDocument();

    // Switch to pending
    await user.click(pendingTab);
    expect(screen.getByText(/Selecciona el archivo de próximas reservas pendientes/i)).toBeInTheDocument();
    expect(screen.getByText(/Deduplicación automática por código de confirmación/i)).toBeInTheDocument();

    // Switch back to completed
    await user.click(completedTab);
    expect(screen.getByText(/Selecciona el archivo de reservas completadas/i)).toBeInTheDocument();
  });

  it('imports all reservations from CSV without skipping historical rows regardless of previous timestamp', async () => {
    const user = userEvent.setup();
    // Simulate previous import on 2026-10-01
    localStorage.setItem('apt_mgr_last_import_completed', '2026-10-01T12:00:00.000Z');

    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Buchungsdatum,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
09/12/2026,Buchung,HM_OLD,2026-09-15,09/20/2026,09/23/2026,3,Old Booking,300000,60000,360000,60000
10/05/2026,Buchung,HM_NEW,2026-10-05,10/10/2026,10/13/2026,3,New Booking,350000,60000,410000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    const sampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(sampleBtn);

    await waitFor(() => {
      // Both old and new bookings should be loaded directly without skipping
      expect(screen.getByText(/Old Booking/i)).toBeInTheDocument();
      expect(screen.getByText(/New Booking/i)).toBeInTheDocument();
      expect(screen.getByText(/Total 2 reservas/i)).toBeInTheDocument();
      expect(screen.queryByText(/Se omitieron/i)).not.toBeInTheDocument();
    });
  });

  it('deduplicates identical or modified rows in pending reservations mode', async () => {
    const user = userEvent.setup();

    // 2 rows with the SAME confirmation code (e.g. guest added before stay)
    const pendingCsvWithDuplicate = `Datum,Typ,Bestätigungs-Code,Buchungsdatum,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
10/15/2026,Buchung,HM_PENDING_DUP,10/01/2026,10/15/2026,10/18/2026,3,Guest 1,300000,60000,360000,60000
10/15/2026,Buchung,HM_PENDING_DUP,10/01/2026,10/15/2026,10/18/2026,3,Guest 1 (Modified),300000,60000,360000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(pendingCsvWithDuplicate),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    // Switch to pending tab
    const pendingTab = screen.getByRole('button', { name: /Reservas futuras/i });
    await user.click(pendingTab);

    const pendingSampleBtn = screen.getByText(/^airbnb_pending\.csv$/i);
    await user.click(pendingSampleBtn);

    await waitFor(() => {
      // Only 1 row should be in the table
      expect(screen.getByText(/Total 1 reservas/i)).toBeInTheDocument();
      expect(screen.getByText(/Se consolidaron/i)).toBeInTheDocument();
      expect(screen.getByText(/líneas duplicadas por modificación/i)).toBeInTheDocument();
    });
  });

  it('saves the timestamp upon successful import', async () => {
    const user = userEvent.setup();
    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Buchungsdatum,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
10/15/2026,Buchung,HM_TS_TEST,10/01/2026,10/15/2026,10/18/2026,3,Timestamp Guest,300000,60000,360000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleCsv),
    }) as unknown as typeof fetch;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    const sampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Timestamp Guest/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar e Importar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(localStorage.getItem('apt_mgr_last_import_completed')).toBeTruthy();
    });
  });

  it('sets booking notes with "Importado vía CSV Airbnb por <nombre usuario>"', async () => {
    const user = userEvent.setup();
    const sampleCsv = `Datum,Typ,Bestätigungs-Code,Buchungsdatum,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
10/15/2026,Buchung,HM_USER_NOTE,10/01/2026,10/15/2026,10/18/2026,3,Note Guest,300000,60000,360000,60000`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleCsv),
    }) as unknown as typeof fetch;

    const mockAuthContext: AuthContextType = {
      user: { id: 'u-1', email: 'axel@example.com' } as unknown as AuthContextType['user'],
      session: null,
      profile: {
        id: 'u-1',
        full_name: 'Axel Werner',
        phone: null,
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    };

    renderWithProviders(
      <AuthContext.Provider value={mockAuthContext}>
        <CsvImportModal isOpen={true} onClose={vi.fn()} />
      </AuthContext.Provider>
    );

    const sampleBtn = screen.getByText(/^airbnb_\.csv$/i);
    await user.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Note Guest/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar e Importar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          bookings: expect.arrayContaining([
            expect.objectContaining({
              guest_name: 'Note Guest',
              notes: 'Importado vía CSV Airbnb por Axel Werner',
            }),
          ]),
        })
      );
    });
  });

  it('imports pending reservations CSV (with BOM and mixed number formats) without passing deleteMonths', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    const { useBookings } = await import('@/hooks/use-bookings');
    vi.mocked(useBookings).mockReturnValue({
      data: [
        {
          id: 'b-nov-completed',
          property_id: 'prop-1',
          airbnb_confirmation_code: 'HMW8MWTW9H',
          guest_name: 'Daniel Alpargatero',
          guest_phone: null,
          number_of_guests: 2,
          check_in: '2026-11-08',
          check_out: '2026-11-13',
          number_of_nights: 5,
          nightly_rate: 86961.12,
          gross_amount: 740000,
          cleaning_fee_collected: 60000,
          airbnb_service_fee: 136493,
          taxes_withheld: 0,
          net_payout: 603507,
          status: 'completed',
          payout_status: 'paid',
          payout_date: '2026-11-08',
          source: 'airbnb',
          notes: null,
        },
      ],
    } as unknown as ReturnType<typeof useBookings>);

    const realPendingCsv = `\uFEFFDatum,Typ,Bestätigungs-Code,Buchungsdatum,Startdatum,Enddatum,Nächte,Gast,Inserat,Details,Referenzcode,Währung,Betrag,Servicegebühr,Reinigungsgebühr,Bruttoeinkünfte,Von Airbnb abgeführte Steuer,Ertragsjahr
11/16/2026,Buchung,HMZJ8ZB4MZ,10/26/2026,11/15/2026,11/19/2026,4,Gabriel Puentes,"Reserva del Mar II | Piscina, Jacuzzi, Wifi & BBQ",,,COP,510560.46,"115.471,61",60000.00,626032.07,0.00,
11/23/2026,Buchung,HMEQRYRKYD,09/20/2026,11/22/2026,11/28/2026,6,David Santiago Laverde Rojas,"Reserva del Mar II | Piscina, Jacuzzi, Wifi & BBQ",,,COP,724820.06,"163.929,94",60000.00,888750.00,0.00,
12/29/2026,Buchung,HM2WAEMKB3,11/03/2026,12/28/2026,12/31/2026,3,Nikcolas Vanegas Forero,"Reserva del Mar II | Piscina, Jacuzzi, Wifi & BBQ",,,COP,799235.48,"180.758,67",60000.00,980000.00,0.00,
01/05/2027,Buchung,HMZW34HH3P,10/11/2026,01/04/2027,01/08/2027,4,Juan David Navarro Najera,"Reserva del Mar II | Piscina, Jacuzzi, Wifi & BBQ",,,COP,929727.00,"210.273,00",60000.00,1140000.00,0.00,`;

    renderWithProviders(<CsvImportModal isOpen={true} onClose={handleClose} />);

    // Switch to Reservas futuras tab
    const pendingTab = screen.getByRole('button', { name: /Reservas futuras/i });
    await user.click(pendingTab);

    const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
    const pendingFile = new File([realPendingCsv], 'airbnb_pending (9).csv', { type: 'text/csv' });
    await user.upload(fileInput, pendingFile);

    await waitFor(() => {
      expect(screen.getByText(/Total 4 reservas/i)).toBeInTheDocument();
      expect(screen.getByText(/Gabriel Puentes/i)).toBeInTheDocument();
      expect(screen.getByText(/David Santiago Laverde Rojas/i)).toBeInTheDocument();
      expect(screen.getByText(/Nikcolas Vanegas Forero/i)).toBeInTheDocument();
      expect(screen.getByText(/Juan David Navarro Najera/i)).toBeInTheDocument();
      expect(screen.queryByText(/Se reemplazarán las reservas/i)).not.toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar e Importar \(4 reservas\)/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          bookings: expect.arrayContaining([
            expect.objectContaining({
              airbnb_confirmation_code: 'HMZJ8ZB4MZ',
              payout_status: 'pending',
              check_in: '2026-11-15',
            }),
            expect.objectContaining({
              airbnb_confirmation_code: 'HMZW34HH3P',
              payout_status: 'pending',
              check_in: '2027-01-04',
            }),
          ]),
          options: {
            importMode: 'pending',
            deleteAllAirbnb: false,
            deleteMonths: undefined,
          },
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('automatically switches to pending mode when uploading a *pending*.csv file on the completed tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CsvImportModal isOpen={true} onClose={vi.fn()} />);

    const pendingCsv = `Datum,Typ,Bestätigungs-Code,Buchungsdatum,Startdatum,Enddatum,Nächte,Gast,Betrag,Reinigungsgebühr,Bruttoeinkünfte,Servicegebühr
12/29/2026,Buchung,HM2WAEMKB3,11/03/2026,12/28/2026,12/31/2026,3,Nikcolas Vanegas Forero,799235.48,60000.00,980000.00,"180.758,67"`;

    const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
    const pendingFile = new File([pendingCsv], 'airbnb_pending (9).csv', { type: 'text/csv' });
    await user.upload(fileInput, pendingFile);

    await waitFor(() => {
      expect(screen.getByText(/Modo: Reservas futuras/i)).toBeInTheDocument();
      expect(screen.getByText(/Nikcolas Vanegas Forero/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar e Importar \(1 reservas\)/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          options: {
            importMode: 'pending',
            deleteAllAirbnb: false,
            deleteMonths: undefined,
          },
        })
      );
    });
  });
});

