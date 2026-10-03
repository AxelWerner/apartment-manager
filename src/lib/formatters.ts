import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExpenseCategory, ExpenseType, DamageSeverity, ClaimStatus, BookingStatus } from '@/types/database';

/**
 * Format a number into Colombian Pesos with 2 decimal places:
 * e.g., 1500000 -> "$ 1.500.000,00 COP"
 */
export function formatCOP(amount: number | null | undefined, includeCurrencySuffix = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return includeCurrencySuffix ? '$ 0,00 COP' : '$ 0,00';
  }
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return includeCurrencySuffix ? `${formatted} COP` : formatted;
}

/**
 * Parse a formatted COP string back into raw number:
 * e.g., "$ 1.500.000,00" -> 1500000
 * e.g., "$ 1.500.000" -> 1500000
 */
export function parseCOP(value: string | number): number {
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  if (!trimmed) return 0;

  // Handle decimal comma if present, e.g. "1.500.000,50" -> 1500000.5
  if (trimmed.includes(',')) {
    const [intPart, decPart] = trimmed.split(',');
    const cleanInt = intPart.replace(/\D/g, '') || '0';
    const cleanDec = decPart.replace(/\D/g, '');
    const num = parseFloat(`${cleanInt}.${cleanDec}`);
    return isNaN(num) ? 0 : num;
  }

  const digits = trimmed.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Format ISO date string into readable Spanish date:
 * e.g., "2026-09-15" -> "15 Sep 2026"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = parseISO(dateString);
    return format(d, 'd MMM yyyy', { locale: es });
  } catch {
    return dateString;
  }
}

/**
 * Extract the 4-digit calendar year (YYYY) from any booking date string (ISO, US, or European formatted).
 * Returns null if not determinable.
 */
export function getBookingYear(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const trimmed = dateString.trim();
  if (!trimmed) return null;

  // 1. ISO format: "2026-09-15" or "2026/09/15"
  const isoMatch = trimmed.match(/^(\d{4})[-/.]/);
  if (isoMatch) return isoMatch[1];

  // 2. Trailing year: "15/09/2026", "09-15-2026", "15.09.2026"
  const trailingMatch = trimmed.match(/[-/.](\d{4})$/);
  if (trailingMatch) return trailingMatch[1];

  // 3. Fallback: search for any 4-digit token starting with 19 or 20
  const anyYearMatch = trimmed.match(/\b(19\d{2}|20\d{2})\b/);
  if (anyYearMatch) return anyYearMatch[1];

  return null;
}

/**
 * Format month 'YYYY-MM' into readable Spanish month:
 * e.g., "2026-09" -> "Septiembre 2026"
 */
export function formatMonthYear(monthStr: string | null | undefined): string {
  if (!monthStr) return '—';
  try {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = format(date, 'MMMM yyyy', { locale: es });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  } catch {
    return monthStr;
  }
}

export const CATEGORY_LABELS: Record<ExpenseCategory, { label: string; icon: string }> = {
  hoa_administration: { label: 'Administración', icon: 'Building2' },
  electricity: { label: 'Energía / Luz', icon: 'Zap' },
  water: { label: 'Agua / Acueducto', icon: 'Droplets' },
  gas: { label: 'Gas Natural', icon: 'Flame' },
  internet_cable: { label: 'Internet y TV', icon: 'Wifi' },
  insurance_annual: { label: 'Seguro Anual', icon: 'ShieldCheck' },
  cleaning_laundry: { label: 'Limpieza y Blancos', icon: 'Sparkles' },
  supplies_restock: { label: 'Insumos y Reposición', icon: 'ShoppingBag' },
  maintenance_repairs: { label: 'Mantenimiento y Reparación', icon: 'Wrench' },
  platform_fees: { label: 'Comisiones y Software', icon: 'CreditCard' },
  other: { label: 'Otros Gastos', icon: 'MoreHorizontal' },
};

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  fixed_monthly: 'Fijo Mensual',
  utility_monthly: 'Servicio Público',
  annual: 'Póliza Anual',
  per_stay: 'Por Estadía',
  occasional: 'Insumo Ocasional',
};

export function getDefaultExpenseDescription(cat: ExpenseCategory, monthStr?: string | null): string {
  const catInfo = CATEGORY_LABELS[cat];
  const catLabel = catInfo?.label || 'Gasto';
  const monthFormatted = monthStr ? formatMonthYear(monthStr) : '';

  if (!monthFormatted) return catLabel;

  switch (cat) {
    case 'hoa_administration':
      return `Administración Edificio - ${monthFormatted}`;
    case 'electricity':
      return `Factura Energía / Luz (EPM) - ${monthFormatted}`;
    case 'water':
      return `Factura Agua y Alcantarillado (EPM) - ${monthFormatted}`;
    case 'gas':
      return `Factura Gas Natural (EPM) - ${monthFormatted}`;
    case 'internet_cable':
      return `Internet Fibra Óptica - ${monthFormatted}`;
    case 'insurance_annual':
      return `Póliza Seguro Todo Riesgo - ${monthFormatted}`;
    case 'cleaning_laundry':
      return `Limpieza y Lavandería - ${monthFormatted}`;
    case 'supplies_restock':
      return `Insumos y Reposición - ${monthFormatted}`;
    case 'maintenance_repairs':
      return `Mantenimiento y Reparaciones - ${monthFormatted}`;
    case 'platform_fees':
      return `Comisiones y Tasas - ${monthFormatted}`;
    default:
      return `${catLabel} - ${monthFormatted}`;
  }
}

export const SEVERITY_CONFIG: Record<DamageSeverity, { label: string; color: string; badgeClass: string }> = {
  low: { label: 'Leve', color: 'emerald', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  medium: { label: 'Medio', color: 'amber', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  high: { label: 'Alto', color: 'orange', badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  critical: { label: 'Crítico', color: 'red', badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
};

export const CLAIM_STATUS_CONFIG: Record<ClaimStatus, { label: string; badgeClass: string }> = {
  discovered: { label: 'Hallado', badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  guest_contacted: { label: 'Huésped Notificado', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  aircover_claim_submitted: { label: 'Reclamo AirCover', badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  approved: { label: 'Aprobado', badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' },
  reimbursed: { label: 'Reembolsado', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  written_off: { label: 'Pérdida Asumida', badgeClass: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300' },
};

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; badgeClass: string }> = {
  confirmed: { label: 'Confirmada', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  checked_in: { label: 'En el Apto', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  completed: { label: 'Completada', badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  cancelled: { label: 'Cancelada', badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
};

export interface BookingSourceConfig {
  label: string;
  shortLabel: string;
  commissionRate: number; // e.g. 0.10, 0.20, 0.25
  ownerRate: number; // e.g. 0.90, 0.80, 0.75
  badgeClass: string;
  isDirect: boolean;
}

export const BOOKING_SOURCE_CONFIG: Record<string, BookingSourceConfig> = {
  airbnb: {
    label: 'Airbnb (20%)',
    shortLabel: 'Airbnb 20%',
    commissionRate: 0.20,
    ownerRate: 0.80,
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40',
    isDirect: false,
  },
  direct: {
    label: 'Directa (10%)',
    shortLabel: 'Directa 10%',
    commissionRate: 0.10,
    ownerRate: 0.90,
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40',
    isDirect: true,
  },
  direct_10: {
    label: 'Directa (10%)',
    shortLabel: 'Directa 10%',
    commissionRate: 0.10,
    ownerRate: 0.90,
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40',
    isDirect: true,
  },
  direct_25: {
    label: 'Directa (25%)',
    shortLabel: 'Directa 25%',
    commissionRate: 0.25,
    ownerRate: 0.75,
    badgeClass: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/40',
    isDirect: true,
  },
};

export function getBookingSourceInfo(source?: string | null): BookingSourceConfig {
  if (source && BOOKING_SOURCE_CONFIG[source]) {
    return BOOKING_SOURCE_CONFIG[source];
  }
  return BOOKING_SOURCE_CONFIG.airbnb;
}

/**
 * Checks if a booking source or booking object represents a direct booking (direct, direct_10, direct_25, etc.).
 */
export function isDirectBooking(sourceOrBooking?: string | null | { source?: string | null }): boolean {
  if (!sourceOrBooking) return false;
  const source = typeof sourceOrBooking === 'string' ? sourceOrBooking : sourceOrBooking.source;
  if (!source) return false;
  return source.startsWith('direct') || Boolean(BOOKING_SOURCE_CONFIG[source]?.isDirect);
}

/**
 * Checks if a booking source or booking object represents an Airbnb booking.
 * Direct bookings are NEVER considered Airbnb bookings.
 * Unspecified or 'airbnb' sources are considered Airbnb.
 */
export function isAirbnbBooking(sourceOrBooking?: string | null | { source?: string | null }): boolean {
  return !isDirectBooking(sourceOrBooking);
}

/**
 * Get current date and time components in Colombia timezone (America/Bogota, UTC-5).
 */
export function getColombiaDateTime(): {
  dateStr: string; // 'YYYY-MM-DD'
  hours: number;   // 0-23
  minutes: number; // 0-59
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '0';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hours = parseInt(getPart('hour'), 10) || 0;
  const minutes = parseInt(getPart('minute'), 10) || 0;

  return {
    dateStr: `${year}-${month}-${day}`,
    hours,
    minutes,
  };
}

/**
 * Automatically determine the operational status of a booking based on Colombian time (America/Bogota, UTC-5):
 * - 'cancelled' -> remains cancelled
 *
 * Hospitality stay schedule:
 * - Fecha anterior al check-in: 'confirmed'
 * - Día de check-in:
 *     - Si ya fue marcado como 'checked_in' manualmente: 'checked_in'
 *     - A partir de las 14:00 (o check-in): 'checked_in'
 *     - Antes de las 14:00: 'confirmed'
 * - Días de estadía (días intermedios y día de check-out inclusive): 'checked_in' ("En el Apto")
 * - Días posteriores a la fecha de check-out: 'completed' ("Completada")
 */
export function resolveBookingStatus(booking: {
  status?: BookingStatus;
  check_in: string;
  check_out: string;
}): BookingStatus {
  if (booking.status === 'cancelled') return 'cancelled';

  const { dateStr: todayStr, hours } = getColombiaDateTime();

  // Fecha anterior al día de check-in
  if (todayStr < booking.check_in) {
    return 'confirmed';
  }

  // Día de check-in: a partir de las 14:00 rige "En el Apto" (o si ya fue marcado manualmente como ingresado)
  if (todayStr === booking.check_in) {
    if (booking.status === 'checked_in') return 'checked_in';
    return hours >= 14 ? 'checked_in' : 'confirmed';
  }

  // Rango de estadía: días intermedios y día de check-out inclusive -> "En el Apto"
  if (todayStr > booking.check_in && todayStr <= booking.check_out) {
    return 'checked_in';
  }

  // Fecha posterior al día de check-out
  return 'completed';
}

/**
 * Checks if a booking's financial revenue is realized / received in hand ("Real"):
 * - Payout has been marked as paid (money already received in bank account)
 * - OR the guest is currently in the apartment or has completed their stay
 * - OR the check-in date is today or in the past (host payout triggered by Airbnb)
 * Cancelled bookings return false.
 */
export function isBookingReal(
  booking: {
    status?: BookingStatus;
    check_in: string;
    check_out: string;
    payout_status?: string | null;
  },
  referenceDateStr?: string
): boolean {
  if (booking.status === 'cancelled') return false;
  if (booking.payout_status === 'paid') return true;
  const status = resolveBookingStatus(booking);
  if (status === 'cancelled') return false;
  if (status === 'checked_in' || status === 'completed') return true;

  const todayStr = referenceDateStr || getColombiaDateTime().dateStr;
  return booking.check_in <= todayStr;
}

/**
 * Checks if a booking's financial revenue is in the future / projected ("Futuro"):
 * - Not cancelled
 * - Check-in date is in the future AND payout has not been received yet
 */
export function isBookingFuture(
  booking: {
    status?: BookingStatus;
    check_in: string;
    check_out: string;
    payout_status?: string | null;
  },
  referenceDateStr?: string
): boolean {
  if (booking.status === 'cancelled') return false;
  return !isBookingReal(booking, referenceDateStr);
}

/**
 * Checks if an expense has been paid / disbursed ("Real"):
 * - `payment_status === 'paid'`
 */
export function isExpenseReal(expense: {
  payment_status?: string | null;
  date?: string | null;
}): boolean {
  return expense.payment_status === 'paid';
}

/**
 * Checks if an expense is pending / scheduled for future payment ("Futuro"):
 * - `payment_status !== 'paid'`
 */
export function isExpenseFuture(expense: {
  payment_status?: string | null;
  date?: string | null;
}): boolean {
  return expense.payment_status !== 'paid';
}

/**
 * Determines whether two bookings represent the same guest stay/reservation:
 * - Must share the same check_in and check_out dates.
 * - If both have property_id, they must match.
 * - Either share the same non-empty confirmation code (case-insensitive)
 *   OR share the same non-empty guest name (case-insensitive).
 */
export function isSameStay(
  a: {
    property_id?: string | null;
    check_in: string;
    check_out: string;
    airbnb_confirmation_code?: string | null;
    guest_name?: string | null;
  },
  b: {
    property_id?: string | null;
    check_in: string;
    check_out: string;
    airbnb_confirmation_code?: string | null;
    guest_name?: string | null;
  }
): boolean {
  if (!a.check_in || !b.check_in) return false;
  if (a.property_id && b.property_id && a.property_id !== b.property_id) return false;

  // Stays on the same check-in date for the same property
  // An apartment unit cannot have two distinct active stays checking in on the same day
  if (a.check_in === b.check_in) {
    const codeA = a.airbnb_confirmation_code?.trim().toUpperCase();
    const codeB = b.airbnb_confirmation_code?.trim().toUpperCase();
    if (codeA && codeB && codeA === codeB) return true;

    if (a.check_out && b.check_out && a.check_out === b.check_out) return true;

    const nameA = a.guest_name?.trim().toLowerCase();
    const nameB = b.guest_name?.trim().toLowerCase();
    if (nameA && nameB && (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA))) return true;

    // Fallback: two bookings checking in on the exact same date for the same property
    return true;
  }

  return false;
}

/**
 * Groups bookings that belong to the same stay (same confirmation code, same check-in date,
 * or same guest and dates), excluding cancelled bookings.
 */
export function groupBookingsByStay<T extends {
  property_id?: string | null;
  check_in: string;
  check_out: string;
  airbnb_confirmation_code?: string | null;
  guest_name?: string | null;
  status?: BookingStatus;
}>(bookingsList: T[]): T[][] {
  if (!bookingsList || bookingsList.length === 0) return [];

  const validBookings = bookingsList.filter(
    (b) => resolveBookingStatus(b) !== 'cancelled'
  );

  const stayGroups: T[][] = [];

  for (const b of validBookings) {
    const matchingGroup = stayGroups.find((group) =>
      group.some((existing) => isSameStay(existing, b))
    );

    if (matchingGroup) {
      matchingGroup.push(b);
    } else {
      stayGroups.push([b]);
    }
  }

  return stayGroups;
}

/**
 * Calculates total count of unique stays for a list of bookings, ensuring
 * duplicate rows representing the same stay or same check-in day are not counted twice.
 */
export function calculateUniqueStays(
  bookingsList: Array<{
    property_id?: string | null;
    check_in: string;
    check_out: string;
    airbnb_confirmation_code?: string | null;
    guest_name?: string | null;
    status?: BookingStatus;
  }>
): number {
  return groupBookingsByStay(bookingsList).length;
}

/**
 * Calculates total booked nights for a list of bookings, ensuring that
 * duplicate rows representing the same stay (same confirmation code, same check-in day,
 * or guest name) and overlapping calendar nights only count their nights once.
 */
export function calculateUniqueBookedNights(
  bookingsList: Array<{
    property_id?: string | null;
    check_in: string;
    check_out: string;
    number_of_nights?: number | null;
    airbnb_confirmation_code?: string | null;
    guest_name?: string | null;
    status?: BookingStatus;
  }>
): number {
  if (!bookingsList || bookingsList.length === 0) return 0;

  const validBookings = bookingsList.filter(
    (b) => resolveBookingStatus(b) !== 'cancelled'
  );

  const stayGroups = groupBookingsByStay(validBookings);

  const uniqueNights = new Set<string>();

  for (const group of stayGroups) {
    const first = group[0];
    const propertyPrefix = first.property_id || 'default';

    if (first.check_in && first.check_out && first.check_in < first.check_out) {
      const start = new Date(first.check_in + 'T12:00:00Z');
      const end = new Date(first.check_out + 'T12:00:00Z');
      const cur = new Date(start);
      while (cur < end) {
        const dateStr = cur.toISOString().split('T')[0];
        uniqueNights.add(`${propertyPrefix}_${dateStr}`);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    } else {
      const maxNights = Math.max(...group.map((b) => Number(b.number_of_nights) || 0));
      for (let i = 0; i < maxNights; i++) {
        uniqueNights.add(`${propertyPrefix}_synthetic_${group[0].airbnb_confirmation_code || group[0].guest_name || i}_${i}`);
      }
    }
  }

  return uniqueNights.size;
}

