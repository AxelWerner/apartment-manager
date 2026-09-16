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
 * Hospitality turnover schedule:
 * - Check-out: hasta las 12:00 del mediodía del día de salida (el huésped sigue "En el Apto")
 * - Limpieza / Entrega: 12:00 a 14:00 (el saliente ya completó, el nuevo aún no ingresa)
 * - Check-in: a partir de las 14:00 del día de entrada (el nuevo huésped pasa a "En el Apto")
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

  // Día de check-in: a partir de las 14:00 rige "En el Apto"
  if (todayStr === booking.check_in) {
    return hours >= 14 ? 'checked_in' : 'confirmed';
  }

  // Días intermedios entre check-in y check-out
  if (todayStr > booking.check_in && todayStr < booking.check_out) {
    return 'checked_in';
  }

  // Día de check-out: hasta las 12:00 del mediodía sigue "En el Apto", luego "Completada"
  if (todayStr === booking.check_out) {
    return hours < 12 ? 'checked_in' : 'completed';
  }

  // Fecha posterior al día de check-out
  return 'completed';
}

