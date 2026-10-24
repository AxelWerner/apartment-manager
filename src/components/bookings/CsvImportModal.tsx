import { useState, useEffect, useContext } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileSpreadsheet, Trash2, Plus, Moon, Files, Sparkles, Calendar, CheckCircle2, Clock, Filter, Cloud, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { formatCOP, formatDate, resolveBookingStatus, getBookingYear, isAirbnbBooking } from '@/lib/formatters';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import { usePropertyContext } from '@/context/PropertyContext';
import { AuthContext } from '@/context/auth-context-def';
import type { Booking, BookingStatus } from '@/types/database';
import { useBookings, useCreateBookingsBatch } from '@/hooks/use-bookings';
import {
  getLastImportTimestamps,
  fetchImportTimestamps,
  setLastImportTimestamp,
  clearLastImportTimestamp,
} from '@/lib/api-service';
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
  const propertyCtx = usePropertyContext();
  const activePropertyId = propertyCtx?.activePropertyId || DEFAULT_PROPERTY_ID;
  const { data: existingBookings = [] } = useBookings(activePropertyId);
  const createBatchMutation = useCreateBookingsBatch();

  const auth = useContext(AuthContext);
  const currentUserName =
    auth?.profile?.full_name?.trim() ||
    auth?.user?.user_metadata?.full_name?.trim() ||
    auth?.user?.user_metadata?.name?.trim() ||
    auth?.user?.email ||
    'usuario';

  const [importMode, setImportMode] = useState<'completed' | 'pending'>('completed');
  const [parsedRows, setParsedRows] = useState<ParsedBookingRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<ParsedBookingRow[]>([]);
  const [dedupedCount, setDedupedCount] = useState(0);
  const [loadedFiles, setLoadedFiles] = useState<LoadedFileInfo[]>([]);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const [detectedYears, setDetectedYears] = useState<string[]>([]);
  const [rowsToDelete, setRowsToDelete] = useState<Booking[]>([]);
  const [showDeletedRows, setShowDeletedRows] = useState(false);
  const [timestamps, setTimestamps] = useState(getLastImportTimestamps());
  const [filterByLastImport, setFilterByLastImport] = useState(true);

  // Sync latest import timestamps from Supabase whenever modal opens or property changes
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      fetchImportTimestamps(activePropertyId).then((ts) => {
        if (isMounted) {
          setTimestamps(ts);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, activePropertyId]);

  const parseRawCsvFile = async (file: File, mode?: 'completed' | 'pending'): Promise<{ fileName: string; rows: ParsedBookingRow[] }> => {
    const textContent = await file.text();
    return new Promise((resolve) => {
      Papa.parse<Record<string, string>>(textContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const fileRows: ParsedBookingRow[] = [];
          const effectiveMode = mode || importMode;
          const isPending = effectiveMode === 'pending' || file.name.toLowerCase().includes('pending');

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
            const cleanFeeStr = getVal(
              'Reinigungsgebühr',
              'Reinigungsgebuehr',
              'Cleaning fee',
              'Tarifa de limpieza',
              'Limpieza',
              'Aseo'
            );
            const serviceFeeStr = getVal('Servicegebühr', 'Service fee', 'Tarifa de servicio', 'Comisión');

            if (!name && !code) continue;

            const nights = nightsStr ? parseInt(nightsStr, 10) : 1;
            const validNights = nights > 0 ? nights : 1;
            const payout = parseAirbnbAmount(amountStr);
            // If the column Reinigungsgebühr (or alias) is present in the CSV, respect its exact value (even if 0)
            const cleanFee = cleanFeeStr !== '' ? parseAirbnbAmount(cleanFeeStr) : 60000;
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
        error: (err: Error) => {
          toast.error(`Error al leer archivo ${file.name}: ${err.message}`);
          resolve({ fileName: file.name, rows: [] });
        },
      });
    });
  };

  const [rawLoadedRows, setRawLoadedRows] = useState<ParsedBookingRow[]>([]);

  const applyFilterAndSort = (
    rawRows: ParsedBookingRow[],
    mode: 'completed' | 'pending',
    shouldFilter: boolean,
    completedTs: string | null
  ) => {
    let keptRows: ParsedBookingRow[] = [];
    const skipped: ParsedBookingRow[] = [];
    let duplicatesFound = 0;

    // 1. DEDUPLICATION FOR PENDING RESERVATIONS (handles modifications/duplicate lines with same code)
    const hasPendingRows = mode === 'pending' || rawRows.some((r) => r.isPendingFile);
    if (hasPendingRows) {
      const seenCodes = new Map<string, ParsedBookingRow>();
      for (const row of rawRows) {
        if (!row.airbnb_confirmation_code) {
          keptRows.push(row);
          continue;
        }
        if (seenCodes.has(row.airbnb_confirmation_code)) {
          duplicatesFound++;
          // Keep the row with the most complete data / highest gross amount
          const prev = seenCodes.get(row.airbnb_confirmation_code)!;
          if ((row.gross_amount || 0) >= (prev.gross_amount || 0)) {
            seenCodes.set(row.airbnb_confirmation_code, row);
          }
        } else {
          seenCodes.set(row.airbnb_confirmation_code, row);
        }
      }
      keptRows = [...keptRows, ...Array.from(seenCodes.values())];
    } else {
      keptRows = [...rawRows];
    }

    // 2. TIMESTAMP FILTERING FOR COMPLETED RESERVATIONS
    if (mode === 'completed' && shouldFilter && completedTs) {
      const cutoffDate = completedTs.slice(0, 10); // YYYY-MM-DD
      const filtered: ParsedBookingRow[] = [];

      for (const r of keptRows) {
        const checkDate = r.booking_date || r.check_in;
        if (checkDate && checkDate < cutoffDate) {
          skipped.push(r);
        } else {
          filtered.push(r);
        }
      }
      keptRows = filtered;
    }

    setDedupedCount(duplicatesFound);
    setSkippedRows(skipped);

    // Check years present for informational display
    const distinctYears = new Set<string>();
    for (const r of keptRows) {
      const y = getBookingYear(r.check_in);
      if (y) distinctYears.add(y);
    }
    setDetectedYears(Array.from(distinctYears).sort());

    // Sort chronologically by check-in date
    keptRows.sort((a, b) => (b.check_in || '').localeCompare(a.check_in || ''));

    const airbnbBookingsToDelete =
      mode === 'completed' ? existingBookings.filter((b) => isAirbnbBooking(b)) : [];

    const finalRows: ParsedBookingRow[] = keptRows.map((row) => ({
      ...row,
      importStatus: 'new' as const,
    }));

    setParsedRows(finalRows);
    setRowsToDelete(airbnbBookingsToDelete);

    return { finalRows, skipped, duplicatesFound };
  };

  const handleToggleFilter = (checked: boolean) => {
    setFilterByLastImport(checked);
    if (rawLoadedRows.length > 0) {
      applyFilterAndSort(rawLoadedRows, importMode, checked, timestamps.completed);
    }
  };

  const processAndMergeFiles = async (files: File[], targetMode?: 'completed' | 'pending') => {
    if (!files || files.length === 0) return;

    try {
      const effectiveMode = targetMode || importMode;
      const results = await Promise.all(files.map((file) => parseRawCsvFile(file, effectiveMode)));

      const rawRows: ParsedBookingRow[] = [];
      const fileSummaries: LoadedFileInfo[] = [];

      for (const res of results) {
        if (res.rows.length === 0) continue;
        fileSummaries.push({
          name: res.fileName,
          count: res.rows.length,
        });
        rawRows.push(...res.rows);
      }

      if (rawRows.length === 0) {
        toast.error('No se encontraron registros de reservaciones válidos en los archivos seleccionados');
        return;
      }

      setLoadedFiles(fileSummaries);
      setRawLoadedRows(rawRows);

      const { finalRows, skipped, duplicatesFound } = applyFilterAndSort(
        rawRows,
        effectiveMode,
        filterByLastImport,
        timestamps.completed
      );

      if (duplicatesFound > 0) {
        toast.info(`Se consolidaron ${duplicatesFound} registro(s) repetidos por modificación de reserva`);
      }
      if (skipped.length > 0) {
        if (finalRows.length === 0) {
          toast.warning(`Se omitieron todas las reservas (${skipped.length}) por tener fecha anterior a la última importación. Pulsa "Desactivar filtro" para verlas.`);
        } else {
          toast.info(`Se omitieron ${skipped.length} reserva(s) con fecha anterior al último import`);
        }
      }

      if (finalRows.length > 0) {
        toast.success(`Se procesaron ${finalRows.length} reservas listas para importar`);
      }
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
      const targetMode = sampleName.includes('pending') ? 'pending' : 'completed';
      setImportMode(targetMode);
      await processAndMergeFiles([file], targetMode);
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

    try {
      const bookingsToInsert: Omit<Booking, 'id' | 'created_at' | 'updated_at'>[] = validRows.map((r) => {
        const isPendingPayout = importMode === 'pending' || r.isPendingFile;
        const status: BookingStatus = isPendingPayout ? resolveBookingStatus(r) : 'completed';

        return {
          property_id: activePropertyId,
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
          notes: `Importado vía CSV Airbnb por ${currentUserName}`,
        };
      });

      const res = await createBatchMutation.mutateAsync({
        bookings: bookingsToInsert,
        options: {
          importMode,
          deleteAllAirbnb: importMode === 'completed' || rowsToDelete.length > 0,
        },
      });

      // Save new timestamp to Supabase & local cache
      await setLastImportTimestamp(importMode, activePropertyId);
      const updatedTs = await fetchImportTimestamps(activePropertyId);
      setTimestamps(updatedTs);

      if (res.deleted > 0) {
        toast.success(`Se importaron ${res.inserted} reservas y se eliminaron ${res.deleted} reservas anteriores de Airbnb`);
      } else if (res.updated > 0) {
        toast.success(`Se importaron ${res.inserted} reservas nuevas y se actualizaron ${res.updated} existentes`);
      } else {
        toast.success(`Se importaron ${res.inserted} reservas correctamente`);
      }

      handleReset();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Error al procesar las reservas: ${message}`);
    }
  };

  const handleReset = () => {
    setRawLoadedRows([]);
    setParsedRows([]);
    setSkippedRows([]);
    setDedupedCount(0);
    setLoadedFiles([]);
    setRowsToDelete([]);
    setDetectedYears([]);
    setShowDeletedRows(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importador de Reservas CSV (Airbnb)"
      subtitle="Importa por separado tus reservas ya hechas (completadas) o tus reservas futuras (pendientes)."
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Tabs for switching between Completed and Pending import */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              if (importMode !== 'completed') {
                setImportMode('completed');
                handleReset();
              }
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              importMode === 'completed'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Reservas ya hechas</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono">
              Completadas
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (importMode !== 'pending') {
                setImportMode('pending');
                handleReset();
              }
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              importMode === 'pending'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>Reservas futuras</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono">
              Pendientes
            </span>
          </button>
        </div>

        {/* Timestamp & configuration banner */}
        {importMode === 'completed' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">Última importación:</span>
              {timestamps.completed ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                    {formatDate(timestamps.completed.slice(0, 10))} ({new Date(timestamps.completed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-medium">
                    <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Supabase
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 italic">Sin importaciones previas</span>
              )}
            </div>
            {timestamps.completed && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={filterByLastImport}
                    onChange={(e) => handleToggleFilter(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Solo comprobar reservas desde el último import</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    await clearLastImportTimestamp('completed', activePropertyId);
                    const updatedTs = await fetchImportTimestamps(activePropertyId);
                    setTimestamps(updatedTs);
                    if (rawLoadedRows.length > 0) {
                      applyFilterAndSort(rawLoadedRows, importMode, filterByLastImport, null);
                    }
                    toast.info('Marca de tiempo reiniciada en Supabase');
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-600 underline cursor-pointer ml-1"
                >
                  Reiniciar
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">Última sincronización pendiente:</span>
              {timestamps.pending ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                    {formatDate(timestamps.pending.slice(0, 10))} ({new Date(timestamps.pending).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-medium">
                    <Cloud className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Supabase
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 italic">Sin sincronizaciones previas</span>
              )}
            </div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Deduplicación automática por código de confirmación
            </div>
          </div>
        )}

        {loadedFiles.length === 0 ? (
          <div className="space-y-4">
            {/* Drag and drop zone */}
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
                  {importMode === 'completed'
                    ? '📂 Selecciona el archivo de reservas completadas (ej: airbnb_.csv)'
                    : '📅 Selecciona el archivo de próximas reservas pendientes (ej: airbnb_pending.csv)'}
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
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-semibold">
                          DEV
                        </span>
                      </p>
                      <p className="text-[11px] text-rose-700/80 dark:text-rose-400">
                        Importa simultáneamente airbnb_.csv y airbnb_pending.csv
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
                    onClick={() => {
                      setImportMode('completed');
                      loadSampleCsv('airbnb_.csv');
                    }}
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
                      <p className="text-[11px] text-slate-400">Reservas finalizadas / cobros</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('pending');
                      loadSampleCsv('airbnb_pending.csv');
                    }}
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
                      <p className="text-[11px] text-slate-400">Reservas pendientes / futuras</p>
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
                {detectedYears.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-800 text-[11px]">
                    <Calendar className="w-3 h-3" />
                    {detectedYears.length === 1 ? `Año ${detectedYears[0]}` : `Años: ${detectedYears.join(', ')}`}
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

            {/* Notification if rows were skipped due to timestamp */}
            {skippedRows.length > 0 && parsedRows.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-medium">
                  <Filter className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Se omitieron <strong>{skippedRows.length}</strong> reservas anteriores al último import (fecha de reserva anterior a {formatDate(timestamps.completed?.slice(0, 10))}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFilter(false)}
                  className="text-[11px] font-bold text-amber-800 dark:text-amber-300 underline hover:text-amber-950 cursor-pointer"
                >
                  Incluir todas ({skippedRows.length})
                </button>
              </div>
            )}

            {/* If all rows were skipped, show a prominent empty state with one-click restore */}
            {parsedRows.length === 0 && skippedRows.length > 0 && (
              <div className="p-6 text-center rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                    Todas las reservas del archivo ({skippedRows.length}) fueron omitidas por el filtro de fecha
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 max-w-md mx-auto">
                    El filtro por fecha está activo y todas las reservas en este archivo tienen fecha anterior a tu última importación ({formatDate(timestamps.completed?.slice(0, 10))}).
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFilter(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Desactivar filtro e incluir las {skippedRows.length} reservas</span>
                  </button>
                </div>
              </div>
            )}

            {/* Notification if duplicates were consolidated */}
            {dedupedCount > 0 && (
              <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 text-xs flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Se consolidaron <strong>{dedupedCount}</strong> líneas duplicadas por modificación de reserva con el mismo código de confirmación.
                </span>
              </div>
            )}

            {/* Existing bookings in DB status */}
            {rowsToDelete.length > 0 && (
              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
                    <Trash2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Se borrarán todas las reservas de Airbnb ({rowsToDelete.length} en la base de datos) y se ingresarán las {parsedRows.length} reservas del archivo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeletedRows(!showDeletedRows)}
                    className="text-amber-700 dark:text-amber-300 font-semibold underline hover:text-amber-900 cursor-pointer text-[11px]"
                  >
                    {showDeletedRows ? 'Ocultar lista' : `Ver cuáles (${rowsToDelete.length})`}
                  </button>
                </div>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80">
                  Al importar se reemplazan por completo todas las reservas de tipo Airbnb existentes en la base de datos por las del archivo. Las reservas directas se conservan intactas.
                </p>
                {showDeletedRows && (
                  <div className="max-h-36 overflow-y-auto border border-amber-200 dark:border-amber-900/60 rounded-lg bg-white dark:bg-slate-900">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-amber-100/60 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold sticky top-0">
                        <tr>
                          <th className="p-1.5">Código</th>
                          <th className="p-1.5">Huésped</th>
                          <th className="p-1.5">Fechas</th>
                          <th className="p-1.5 text-right">Pago</th>
                          <th className="p-1.5 text-right text-sky-600 dark:text-sky-400">Aseo</th>
                          <th className="p-1.5 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 dark:divide-slate-800">
                        {rowsToDelete.map((b) => (
                          <tr key={b.id} className="text-slate-700 dark:text-slate-300">
                            <td className="p-1.5 font-mono text-[10px]">{b.airbnb_confirmation_code || '—'}</td>
                            <td className="p-1.5 font-medium">{b.guest_name}</td>
                            <td className="p-1.5 text-slate-500 whitespace-nowrap">
                              {formatDate(b.check_in)} - {formatDate(b.check_out)}
                            </td>
                            <td className="p-1.5 text-right font-medium">{formatCOP(b.net_payout)}</td>
                            <td className="p-1.5 text-right font-medium text-sky-600 dark:text-sky-400">{formatCOP(b.cleaning_fee_collected)}</td>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pago Airbnb (100%)</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatCOP(parsedRows.reduce((sum, r) => sum + (r.net_payout || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">Aseo (Reinigungsgebühr)</p>
                <p className="text-sm font-bold text-sky-600 dark:text-sky-400">
                  {formatCOP(parsedRows.reduce((sum, r) => sum + (r.cleaning_fee_collected || 0), 0))}
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
                    <th className="p-2.5 font-semibold text-sky-600 dark:text-sky-400 text-right">Aseo</th>
                    <th className="p-2.5 font-semibold text-amber-600 dark:text-amber-400 text-right">Adm. (20%)</th>
                    <th className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400 text-right">Ingresos Alojamiento</th>
                    <th className="p-2.5 font-semibold text-slate-600 dark:text-slate-300 text-right">Tarifa / Noche</th>
                    <th className="p-2.5 font-semibold text-slate-600 dark:text-slate-300 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedRows.map((row, idx) => (
                    <tr key={idx}>
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
                      </td>
                      <td className="p-2.5 text-right font-medium text-sky-600 dark:text-sky-400" title="Aseo recaudado (Reinigungsgebühr)">
                        {formatCOP(row.cleaning_fee_collected)}
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
                        {row.isPendingFile ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Plus className="w-3 h-3" />
                            A ingresar
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
                  Total a ingresar: <strong className="text-emerald-600 font-bold">{parsedRows.length}</strong>
                </span>
                {rowsToDelete.length > 0 && (
                  <span>
                    A borrar en BD (Airbnb): <strong className="text-rose-600 font-bold">{rowsToDelete.length}</strong>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {importMode === 'completed' ? 'Modo: Reservas ya hechas' : 'Modo: Reservas futuras'}
              </span>
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
                  ? `Confirmar e Importar (${parsedRows.length} a ingresar • ${rowsToDelete.length} a eliminar)`
                  : `Confirmar e Importar (${parsedRows.length} reservas)`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
