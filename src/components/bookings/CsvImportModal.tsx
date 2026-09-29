import { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileSpreadsheet, Check, Trash2, RefreshCw, Plus, Moon, Files, Sparkles, AlertTriangle, Calendar } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { formatCOP, formatDate, resolveBookingStatus, getBookingYear } from '@/lib/formatters';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import type { Booking, BookingStatus } from '@/types/database';
import { useBookings, useCreateBookingsBatch } from '@/hooks/use-bookings';
import { toast } from 'sonner';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedBookingRow {
  airbnb_confirmation_code: string | null;
  guest_name: string;
  booking_date?: string | null;
  check_in: string;
  check_out: string;
  number_of_nights: number;
  gross_amount: number;
  net_payout: number;
  management_fee: number;
  owner_payout: number;
  cleaning_fee_collected: number;
  airbnb_service_fee: number;
  nightly_rate: number;
  importStatus: 'new' | 'updated' | 'unchanged';
  changeSummary?: string;
  previousPayout?: number;
  sourceFile: string;
  isPendingFile: boolean;
}

interface LoadedFileInfo {
  name: string;
  count: number;
}

// Helper to parse European or standard formatted Airbnb currencies
const parseAirbnbAmount = (val: string | number | undefined | null): number => {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  let str = String(val).trim().replace(/[^\d.,-]/g, '');
  if (!str) return 0;

  // Case 1: European format with dot as thousand and comma as decimal (e.g. "71.992,68")
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      str = parts[0] + '.' + parts[1];
    } else {
      str = str.replace(/,/g, '');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num);
};

// Helper to parse dates into ISO YYYY-MM-DD
const parseDate = (dStr: string) => {
  if (!dStr) return '';
  const trimmed = dStr.trim();
  if (trimmed.includes('-') && trimmed.length === 10) return trimmed;
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    if (parts[2].length === 4) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      if (p0 > 12 && p1 <= 12) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      // MM/DD/YYYY from Airbnb exports
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  return trimmed;
};

export function CsvImportModal({ isOpen, onClose }: CsvImportModalProps) {
  const { data: existingBookings = [] } = useBookings();
  const createBatchMutation = useCreateBookingsBatch();

  const [parsedRows, setParsedRows] = useState<ParsedBookingRow[]>([]);
  const [loadedFiles, setLoadedFiles] = useState<LoadedFileInfo[]>([]);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [detectedYear, setDetectedYear] = useState<string | null>(null);
  const [yearError, setYearError] = useState<string | null>(null);
  const [rowsToDelete, setRowsToDelete] = useState<Booking[]>([]);
  const [showDeletedRows, setShowDeletedRows] = useState(false);

  const parseRawCsvFile = (file: File): Promise<{ fileName: string; rows: ParsedBookingRow[] }> => {
    return new Promise((resolve) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const fileRows: ParsedBookingRow[] = [];
          const isPending = file.name.toLowerCase().includes('pending');

          for (const raw of results.data) {
            // Normalize column lookups (case-insensitive & accent-agnostic across German, Spanish, English)
            const getVal = (...aliases: string[]): string => {
              for (const alias of aliases) {
                for (const [key, val] of Object.entries(raw)) {
                  if (key.trim().toLowerCase() === alias.toLowerCase()) {
                    return (val || '').trim();
                  }
                }
              }
              return '';
            };

            const type = getVal('Typ', 'Type', 'Tipo');
            // Skip payout summary rows (which don't represent a booking)
            if (type.toLowerCase() === 'payout' || type.toLowerCase() === 'auszahlung') {
              continue;
            }

            const code = getVal(
              'Bestätigungs-Code',
              'Bestätigungscode',
              'Confirmation code',
              'Código de confirmación',
              'Reservation code',
              'Código'
            );
            const name = getVal('Gast', 'Guest name', 'Nombre del huésped', 'Huésped', 'Guest');
            const bookedDateStr = getVal(
              'Buchungsdatum',
              'Booked date',
              'Booking date',
              'Fecha de reserva',
              'Fecha de la reserva',
              'Reservation date',
              'Date of reservation'
            );
            const checkIn = getVal('Startdatum', 'Start date', 'Fecha de inicio', 'Check-in', 'Arrival date');
            const checkOut = getVal('Enddatum', 'End date', 'Fecha de finalización', 'Check-out', 'Departure date');
            const nightsStr = getVal('Nächte', 'Nights', 'Noches', '# of nights');
            const amountStr = getVal(
              'Betrag',
              'Ausgezahlt',
              'Earnings',
              'Amount',
              'Total payout',
              'Importe',
              'Ganancias',
              'Cobro neto'
            );
            const grossStr = getVal('Bruttoeinkünfte', 'Gross earnings', 'Ingreso bruto');
            const cleanFeeStr = getVal('Reinigungsgebühr', 'Cleaning fee', 'Tarifa de limpieza', 'Limpieza');
            const serviceFeeStr = getVal('Servicegebühr', 'Service fee', 'Tarifa de servicio', 'Comisión');

            if (!name && !code) continue;

            const nights = nightsStr ? parseInt(nightsStr, 10) : 1;
            const validNights = nights > 0 ? nights : 1;
            const payout = parseAirbnbAmount(amountStr);
            const parsedCleanFee = parseAirbnbAmount(cleanFeeStr);
            const cleanFee = parsedCleanFee > 0 ? parsedCleanFee : 60000;
            let serviceFee = parseAirbnbAmount(serviceFeeStr);
            let gross = parseAirbnbAmount(grossStr);

            if (gross <= 0 && payout > 0) {
              gross = payout + serviceFee;
            }
            if (serviceFee <= 0 && gross > payout) {
              serviceFee = Math.max(0, gross - payout);
            }

            const accommodationBase = Math.max(0, payout - cleanFee);
            const managementFee = Math.round(accommodationBase * 0.20);
            const ownerAccommodation = Math.max(0, accommodationBase - managementFee);
            const ownerPayout = ownerAccommodation;
            const rate = Math.round(ownerAccommodation / validNights);

            const normalizedIn = parseDate(checkIn);
            const normalizedOut = parseDate(checkOut);
            const normalizedBookedDate = parseDate(bookedDateStr) || null;

            fileRows.push({
              airbnb_confirmation_code: code || null,
              guest_name: name || 'Huésped Airbnb',
              booking_date: normalizedBookedDate,
              check_in: normalizedIn,
              check_out: normalizedOut,
              number_of_nights: validNights,
              gross_amount: gross,
              net_payout: payout,
              management_fee: managementFee,
              owner_payout: ownerPayout,
              cleaning_fee_collected: cleanFee,
              airbnb_service_fee: serviceFee,
              nightly_rate: rate > 0 ? rate : ownerPayout,
              importStatus: 'new',
              sourceFile: file.name,
              isPendingFile: isPending,
            });
          }

          resolve({ fileName: file.name, rows: fileRows });
        },
        error: (err) => {
          toast.error(`Error al leer archivo ${file.name}: ${err.message}`);
          resolve({ fileName: file.name, rows: [] });
        },
      });
    });
  };

  const processAndMergeFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    try {
      setYearError(null);
      const results = await Promise.all(files.map((file) => parseRawCsvFile(file)));

      // Collect all rows and deduplicate across files
      // If a confirmation code exists in multiple files, prioritize completed (non-pending) row
      const combinedByCode = new Map<string, ParsedBookingRow>();
      const rowsWithoutCode: ParsedBookingRow[] = [];
      const fileSummaries: LoadedFileInfo[] = [];

      for (const res of results) {
        if (res.rows.length === 0) continue;
        fileSummaries.push({
          name: res.fileName,
          count: res.rows.length,
        });

        for (const row of res.rows) {
          const codeKey = row.airbnb_confirmation_code?.trim().toUpperCase();
          if (codeKey) {
            const existingInBatch = combinedByCode.get(codeKey);
            if (!existingInBatch) {
              combinedByCode.set(codeKey, row);
            } else {
              // Prioritize non-pending or row with higher net_payout
              if (existingInBatch.isPendingFile && !row.isPendingFile) {
                combinedByCode.set(codeKey, row);
              } else if (row.net_payout > existingInBatch.net_payout) {
                combinedByCode.set(codeKey, row);
              }
            }
          } else {
            rowsWithoutCode.push(row);
          }
        }
      }

      const mergedRows = [...Array.from(combinedByCode.values()), ...rowsWithoutCode];

      if (mergedRows.length === 0) {
        toast.error('No se encontraron registros de reservaciones válidos en los archivos seleccionados');
        return;
      }

      // Check year of each row
      const distinctYears = new Set<string>();
      for (const r of mergedRows) {
        const y = getBookingYear(r.check_in);
        if (y) distinctYears.add(y);
      }

      if (distinctYears.size > 1) {
        const yearsArr = Array.from(distinctYears).sort();
        const errorMsg = `El archivo o lote contiene reservas de ${distinctYears.size} años diferentes (${yearsArr.join(', ')}). Cada importación debe corresponder exclusivamente a la información de un único AÑO COMPLETO de reservas.`;
        setYearError(errorMsg);
        toast.error(errorMsg, { duration: 6000 });
        setParsedRows([]);
        setLoadedFiles([]);
        setRowsToDelete([]);
        setDetectedYear(null);
        return;
      }

      if (distinctYears.size === 0) {
        const errorMsg = 'No se pudieron identificar las fechas de inicio (check-in) para determinar el año del archivo.';
        setYearError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      const singleYear = Array.from(distinctYears)[0];
      setDetectedYear(singleYear);
      setYearError(null);

      // Sort chronologically by check-in date
      mergedRows.sort((a, b) => (b.check_in || '').localeCompare(a.check_in || ''));

      // Incoming confirmation codes set
      const incomingCodes = new Set<string>();
      mergedRows.forEach((r) => {
        if (r.airbnb_confirmation_code) {
          incomingCodes.add(r.airbnb_confirmation_code.trim().toUpperCase());
        }
      });

      // Compare against existing bookings in the database
      const finalRows: ParsedBookingRow[] = mergedRows.map((row) => {
        const codeUpper = row.airbnb_confirmation_code?.trim().toUpperCase();
        const existing = codeUpper
          ? existingBookings.find(
              (b) => b.airbnb_confirmation_code?.trim().toUpperCase() === codeUpper
            )
          : undefined;

        let importStatus: 'new' | 'updated' | 'unchanged' = 'new';
        let changeSummary = '';
        let previousPayout: number | undefined;

        if (existing) {
          const diffs: string[] = [];
          if (Number(existing.net_payout) !== row.net_payout) {
            diffs.push(`Pago: ${formatCOP(existing.net_payout)} → ${formatCOP(row.net_payout)}`);
            previousPayout = Number(existing.net_payout);
          }
          if (Number(existing.gross_amount) !== row.gross_amount) diffs.push('Bruto');
          if (Number(existing.cleaning_fee_collected) !== row.cleaning_fee_collected) diffs.push('Limpieza');
          if (existing.check_in !== row.check_in || existing.check_out !== row.check_out) diffs.push('Fechas');
          if (Number(existing.number_of_nights) !== row.number_of_nights) diffs.push('Noches');
          if (existing.guest_name !== row.guest_name) diffs.push('Nombre');

          if (diffs.length > 0) {
            importStatus = 'updated';
            changeSummary = diffs.join(', ');
          } else {
            importStatus = 'unchanged';
          }
        }

        return {
          ...row,
          importStatus,
          changeSummary,
          previousPayout,
        };
      });

      // DEDUCE WHICH BOOKINGS IN DB FOR singleYear ARE MISSING FROM CSV:
      // If DB has reservations A, B, C for singleYear, and we import C, D:
      // A and B must be deleted!
      const missingFromDb = existingBookings.filter((b) => {
        const bYear = getBookingYear(b.check_in);
        if (bYear !== singleYear) return false;

        const isAirbnbOrCoded = Boolean(b.airbnb_confirmation_code) || b.source === 'airbnb' || !b.source;
        if (!isAirbnbOrCoded) return false;

        const code = b.airbnb_confirmation_code?.trim().toUpperCase();
        if (code && incomingCodes.has(code)) {
          return false;
        }
        return true;
      });

      setLoadedFiles(fileSummaries);
      setParsedRows(finalRows);
      setRowsToDelete(missingFromDb);

      toast.success(
        `Se procesaron ${finalRows.length} reservas del año ${singleYear}${
          missingFromDb.length > 0 ? ` (${missingFromDb.length} se eliminarán de la BD)` : ''
        }`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Error al procesar archivos: ${message}`);
    }
  };

  const loadBothSamples = async () => {
    try {
      setLoadingSample('all');
      const [res1, res2] = await Promise.all([
        fetch('/samples/airbnb_.csv'),
        fetch('/samples/airbnb_pending.csv'),
      ]);

      if (!res1.ok || !res2.ok) throw new Error('No se pudieron cargar los archivos de prueba');

      const text1 = await res1.text();
      const text2 = await res2.text();

      const file1 = new File([text1], 'airbnb_.csv', { type: 'text/csv' });
      const file2 = new File([text2], 'airbnb_pending.csv', { type: 'text/csv' });

      await processAndMergeFiles([file1, file2]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Error al cargar muestras: ${message}`);
    } finally {
      setLoadingSample(null);
    }
  };

  const loadSampleCsv = async (sampleName: 'airbnb_.csv' | 'airbnb_pending.csv') => {
    try {
      setLoadingSample(sampleName);
      const res = await fetch(`/samples/${sampleName}`);
      if (!res.ok) throw new Error('No se pudo encontrar el archivo de prueba');
      const text = await res.text();
      const file = new File([text], sampleName, { type: 'text/csv' });
      await processAndMergeFiles([file]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Error al cargar muestra: ${message}`);
    } finally {
      setLoadingSample(null);
    }
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.check_in && r.check_out);
    if (validRows.length === 0) {
      toast.error('No hay reservas válidas para procesar');
      return;
    }
    if (!detectedYear) {
      toast.error('No se pudo identificar el año de las reservas para importar');
      return;
    }

    try {
      const bookingsToInsert: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[] = validRows.map((r) => {
        const status: BookingStatus = resolveBookingStatus(r);
        const isPendingPayout = status === 'confirmed' || r.isPendingFile;
        return {
          property_id: DEFAULT_PROPERTY_ID,
          airbnb_confirmation_code: r.airbnb_confirmation_code,
          guest_name: r.guest_name,
          guest_phone: null,
          number_of_guests: 2,
          booking_date: r.booking_date || null,
          check_in: r.check_in,
          check_out: r.check_out,
          number_of_nights: r.number_of_nights,
          nightly_rate: r.nightly_rate,
          gross_amount: r.gross_amount,
          cleaning_fee_collected: r.cleaning_fee_collected,
          airbnb_service_fee:
            r.airbnb_service_fee > 0 ? r.airbnb_service_fee : Math.max(0, r.gross_amount - r.net_payout),
          taxes_withheld: 0,
          net_payout: r.net_payout,
          management_fee: r.management_fee,
          owner_payout: r.owner_payout,
          status,
          payout_status: isPendingPayout ? 'pending' : 'paid',
          payout_date: isPendingPayout ? null : r.check_in,
          source: 'airbnb',
          notes: r.sourceFile
            ? `Importado vía CSV Airbnb (${r.sourceFile})`
            : 'Importado vía archivo CSV de Airbnb',
        };
      });

      const res = await createBatchMutation.mutateAsync({
        bookings: bookingsToInsert,
        options: {
          syncYear: detectedYear,
          deleteMissing: true,
        },
      });

      const details: string[] = [];
      if (res.inserted > 0) details.push(`${res.inserted} nuevas`);
      if (res.updated > 0) details.push(`${res.updated} actualizadas`);
      if (res.deleted > 0) details.push(`${res.deleted} eliminadas`);

      if (details.length > 0) {
        toast.success(`Año ${detectedYear}: Sincronización exitosa (${details.join(', ')})`);
      } else {
        toast.info(`Año ${detectedYear}: Todas las reservas ya estaban al día (sin cambios)`);
      }

      handleReset();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Error al procesar las reservas: ${message}`);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setLoadedFiles([]);
    setRowsToDelete([]);
    setDetectedYear(null);
    setYearError(null);
    setShowDeletedRows(false);
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importador de Reservas CSV (Airbnb)"
      subtitle="Sube uno o varios archivos CSV de Airbnb (reservas completadas y pendientes)"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {parsedRows.length === 0 ? (
          <div className="space-y-4">
            {yearError && (
              <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/90 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  Archivo rechazado: Múltiples años detectados
                </div>
                <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                  {yearError}
                </p>
                <div className="text-[11px] text-rose-700/90 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-900/30 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-800/40">
                  💡 <strong>Condición de importación:</strong> Cada archivo debe contener exclusivamente las reservas de un <em>único año completo</em>. Si necesitas importar reservas de años distintos, impórtalas en archivos separados por cada año.
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
                >
                  Descartar y seleccionar otro archivo
                </button>
              </div>
            )}

            {/* Drag and drop zone for multiple files */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) {
                  processAndMergeFiles(Array.from(e.dataTransfer.files));
                }
              }}
              className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-800/30 transition-all cursor-pointer group"
            >
              <input
                type="file"
                accept=".csv"
                multiple
                id="csv-file-input"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    processAndMergeFiles(Array.from(e.target.files));
                  }
                }}
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Haz clic para subir o arrastra tus archivos CSV aquí
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
                  💡 Puedes seleccionar o arrastrar múltiples archivos a la vez (completadas + pendientes)
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Compatible con exportaciones de "Reservaciones" e "Historial de transacciones" de Airbnb
                </p>
              </label>
            </div>

            {/* Quick test buttons (Only available in development mode) */}
            {import.meta.env.DEV && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Archivos detectados en <code className="text-rose-600 dark:text-rose-400 font-mono font-bold">data/</code> (Prueba Rápida - Solo DEV):
                </p>

                {/* Combined test button */}
                <button
                  type="button"
                  onClick={loadBothSamples}
                  disabled={loadingSample !== null}
                  className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/50 dark:hover:bg-rose-950/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                        Cargar ambos archivos a la vez (Completadas + Pendientes)
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-semibold">
                          DEV
                        </span>
                      </p>
                      <p className="text-[11px] text-rose-700/80 dark:text-rose-400">
                        Importa simultáneamente airbnb_.csv (6) y airbnb_pending.csv (8) — Total 14 reservas
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 group-hover:translate-x-0.5 transition-transform">
                    {loadingSample === 'all' ? 'Cargando...' : 'Cargar ambos →'}
                  </div>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => loadSampleCsv('airbnb_.csv')}
                    disabled={loadingSample !== null}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 truncate">
                        airbnb_.csv
                      </p>
                      <p className="text-[11px] text-slate-400">6 reservas finalizadas / cobros</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadSampleCsv('airbnb_pending.csv')}
                    disabled={loadingSample !== null}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 text-left transition-all group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 truncate">
                        airbnb_pending.csv
                      </p>
                      <p className="text-[11px] text-slate-400">8 reservas pendientes / futuras</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Preview table */
          <div className="space-y-3">
            {/* Loaded files banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Files className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {loadedFiles.length} archivo(s) procesado(s):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {loadedFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono text-[11px] text-slate-700 dark:text-slate-200"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-emerald-500" />
                      {file.name}
                      <span className="text-slate-400 font-sans">({file.count})</span>
                    </span>
                  ))}
                </div>
                {detectedYear && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-800 text-[11px]">
                    <Calendar className="w-3 h-3" />
                    Año {detectedYear} (Año Completo)
                  </span>
                )}
                <span className="text-slate-500 font-bold ml-1">
                  • Total {parsedRows.length} reservas
                </span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-slate-500 hover:text-rose-600 flex items-center gap-1 font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Cambiar / Limpiar
              </button>
            </div>

            {/* Warning when existing bookings from that year are missing and will be deleted */}
            {rowsToDelete.length > 0 && (
              <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-bold">
                    <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {rowsToDelete.length} reserva(s) en la base de datos se eliminarán porque ya no están en este archivo del año {detectedYear}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeletedRows(!showDeletedRows)}
                    className="text-rose-700 dark:text-rose-300 font-semibold underline hover:text-rose-900 cursor-pointer text-[11px]"
                  >
                    {showDeletedRows ? 'Ocultar lista' : `Ver cuáles (${rowsToDelete.length})`}
                  </button>
                </div>
                <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80">
                  Dado que la importación corresponde al año completo {detectedYear}, cualquier reserva de este año que no figure en este archivo será eliminada para mantener la sincronización exacta.
                </p>
                {showDeletedRows && (
                  <div className="max-h-36 overflow-y-auto border border-rose-200 dark:border-rose-900/60 rounded-lg bg-white dark:bg-slate-900">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-rose-100/60 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-semibold sticky top-0">
                        <tr>
                          <th className="p-1.5">Código</th>
                          <th className="p-1.5">Huésped</th>
                          <th className="p-1.5">Fechas</th>
                          <th className="p-1.5 text-right">Pago</th>
                          <th className="p-1.5 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 dark:divide-slate-800">
                        {rowsToDelete.map((b) => (
                          <tr key={b.id} className="text-slate-700 dark:text-slate-300">
                            <td className="p-1.5 font-mono text-[10px]">{b.airbnb_confirmation_code || '—'}</td>
                            <td className="p-1.5 font-medium">{b.guest_name}</td>
                            <td className="p-1.5 text-slate-500 whitespace-nowrap">
                              {formatDate(b.check_in)} - {formatDate(b.check_out)}
                            </td>
                            <td className="p-1.5 text-right font-medium">{formatCOP(b.net_payout)}</td>
                            <td className="p-1.5 text-center">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                <Trash2 className="w-2.5 h-2.5" /> Se eliminará
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Aggregate summary of batch */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pago Airbnb (100%)</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatCOP(parsedRows.reduce((sum, r) => sum + (r.net_payout || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Adm. Inmueble (20%)</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  -{formatCOP(parsedRows.reduce((sum, r) => sum + (r.management_fee || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Ingresos de Alojamiento</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCOP(parsedRows.reduce((sum, r) => sum + (r.owner_payout || 0), 0))}
                </p>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5 font-semibold text-slate-600 dark:text-slate-300">Código</th>
                    <th className="p-2.5 font-semibold text-slate-600 dark:text-slate-300">Huésped</th>
                    <th className="p-2.5 font-semibold text-slate-600 dark:text-slate-300">Fechas</th>
                    <th className="p-2.5 font-semibold text-slate-600 dark:text-slate-300 text-right">Airbnb (Betrag)</th>
                    <th className="p-2.5 font-semibold text-amber-600 dark:text-amber-400 text-right">Adm. (20%)</th>
                    <th className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400 text-right">Ingresos Alojamiento</th>
                    <th className="p-2.5 font-semibold text-slate-600 dark:text-slate-300 text-right">Tarifa / Noche</th>
                    <th className="p-2.5 font-semibold text-slate-600 dark:text-slate-300 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        row.importStatus === 'updated'
                          ? 'bg-amber-50/60 dark:bg-amber-950/30'
                          : row.importStatus === 'unchanged'
                            ? 'opacity-70 dark:opacity-60'
                            : ''
                      }
                    >
                      <td className="p-2.5 font-mono text-[11px]">
                        <div>{row.airbnb_confirmation_code || '—'}</div>
                        {loadedFiles.length > 1 && (
                          <div className="text-[9px] text-slate-400 truncate max-w-[100px] font-sans">
                            {row.sourceFile}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 font-medium text-slate-900 dark:text-white">{row.guest_name}</td>
                      <td className="p-2.5 text-slate-500 whitespace-nowrap">
                        {formatDate(row.check_in)} - {formatDate(row.check_out)}{' '}
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          ({row.number_of_nights} <Moon className="w-3 h-3 text-amber-500 fill-amber-500/30" />)
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatCOP(row.net_payout)}
                        {row.previousPayout !== undefined && row.previousPayout !== row.net_payout && (
                          <span className="block text-[10px] text-slate-400 line-through">
                            {formatCOP(row.previousPayout)}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-medium text-amber-600 dark:text-amber-400">
                        -{formatCOP(row.management_fee)}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCOP(row.owner_payout)}
                      </td>
                      <td className="p-2.5 text-right font-medium text-slate-700 dark:text-slate-300" title="Tarifa neta por noche">
                        {formatCOP(row.nightly_rate)}
                      </td>
                      <td className="p-2.5 text-center">
                        {row.importStatus === 'new' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Plus className="w-3 h-3" />
                            Nueva
                          </span>
                        )}
                        {row.importStatus === 'updated' && (
                          <div>
                            <span
                              title={row.changeSummary}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Actualizar
                            </span>
                            {row.changeSummary && (
                              <p
                                className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 max-w-[130px] truncate mx-auto font-medium"
                                title={row.changeSummary}
                              >
                                {row.changeSummary}
                              </p>
                            )}
                          </div>
                        )}
                        {row.importStatus === 'unchanged' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            <Check className="w-3 h-3" />
                            Al día
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary statistics */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Nuevas: <strong className="text-emerald-600 font-bold">{parsedRows.filter((r) => r.importStatus === 'new').length}</strong>
                </span>
                <span>
                  Por actualizar: <strong className="text-amber-600 font-bold">{parsedRows.filter((r) => r.importStatus === 'updated').length}</strong>
                </span>
                <span>
                  Sin cambios: <strong className="text-slate-500 font-bold">{parsedRows.filter((r) => r.importStatus === 'unchanged').length}</strong>
                </span>
                {rowsToDelete.length > 0 && (
                  <span>
                    A eliminar de la BD: <strong className="text-rose-600 font-bold">{rowsToDelete.length}</strong>
                  </span>
                )}
              </div>
              {detectedYear && (
                <span className="text-[11px] text-slate-400 font-medium">
                  Sincronización Año Completo {detectedYear}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          {parsedRows.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={createBatchMutation.isPending || parsedRows.length === 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {createBatchMutation.isPending
                ? 'Procesando...'
                : rowsToDelete.length > 0
                  ? `Confirmar e Importar (${parsedRows.filter((r) => r.importStatus === 'new').length} nuevas, ${parsedRows.filter((r) => r.importStatus === 'updated').length} cambios, ${rowsToDelete.length} a eliminar)`
                  : parsedRows.filter((r) => r.importStatus === 'updated').length > 0
                    ? `Confirmar e Importar (${parsedRows.filter((r) => r.importStatus === 'new').length} nuevas, ${parsedRows.filter((r) => r.importStatus === 'updated').length} cambios)`
                    : parsedRows.filter((r) => r.importStatus === 'new').length > 0
                      ? `Confirmar e Importar (${parsedRows.filter((r) => r.importStatus === 'new').length} nuevas)`
                      : 'Re-sincronizar Reservas (Al día)'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
