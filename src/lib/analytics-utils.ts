import {
  formatMonthYear,
  resolveBookingStatus,
  getColombiaDateTime,
  isBookingReal,
  isBookingFuture,
  groupBookingsByStay,
} from './formatters';
import type { Booking } from '@/types/database';

export interface DailyOccupancyStatus {
  dayNumber: number; // 1..31
  dateStr: string; // 'YYYY-MM-DD'
  dayOfWeek: string; // 'Lun', 'Mar', 'Mié', etc.
  dayOfWeekShort: string; // 'L', 'M', 'X', 'J', 'V', 'S', 'D'
  isWeekend: boolean;
  isOccupied: boolean;
  guestName?: string;
  bookingId?: string;
  confirmationCode?: string | null;
  nightlyRate?: number;
  source?: string;
}

export interface MonthBookingDetail {
  booking: Booking;
  nightsInMonth: number;
  totalReservationNights: number;
  effectiveNightlyRate: number;
  accommodationRevenueInMonth: number;
  leadTimeDays: number | null;
}

export interface LeadTimeBucket {
  label: string;
  count: number;
  percentage: number;
  description: string;
}

export interface LosBucket {
  label: string;
  count: number;
  percentage: number;
  description: string;
}

export interface MonthAnalytics {
  monthKey: string; // 'YYYY-MM'
  monthLabel: string; // 'Septiembre 2026'
  year: number;
  month: number; // 1-12
  daysInMonth: number;

  // Occupancy metrics
  occupiedNights: number;
  availableNights: number;
  vacantNights: number;
  occupancyRate: number; // 0 to 100 percentage

  // Revenue & Rate metrics
  totalAccommodationRevenue: number; // Total nightly revenue in the month
  adr: number; // Average Daily Rate = totalAccommodationRevenue / occupiedNights
  revPar: number; // Revenue Per Available Room = totalAccommodationRevenue / daysInMonth = adr * (occupiedNights / daysInMonth)

  // Channel breakdowns
  airbnbNights: number;
  airbnbRevenue: number;
  airbnbAdr: number;
  directNights: number;
  directRevenue: number;
  directAdr: number;

  // Length of Stay (LOS)
  totalBookings: number;
  averageLos: number;
  minLos: number;
  maxLos: number;
  losBuckets: LosBucket[];

  // Lead Time (Ventana de Reserva)
  averageLeadTime: number | null;
  minLeadTime: number | null;
  maxLeadTime: number | null;
  bookingsWithLeadTimeCount: number;
  leadTimeBuckets: LeadTimeBucket[];

  // Day by day timeline (1..daysInMonth)
  dailyStatus: DailyOccupancyStatus[];

  // Contributing bookings detail
  monthBookings: MonthBookingDetail[];
}

export interface MomComparison {
  adrDelta: number;
  adrDeltaPercent: number;
  occupancyDelta: number; // percentage points
  revParDelta: number;
  revParDeltaPercent: number;
  revenueDelta: number;
  revenueDeltaPercent: number;
  losDelta: number;
  leadTimeDelta: number | null;
}

export interface AnalyticsFilterOptions {
  channelFilter?: 'all' | 'airbnb' | 'direct';
  horizonFilter?: 'all' | 'real' | 'future';
  referenceDateStr?: string;
}

const SPANISH_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SPANISH_DAYS_SINGLE = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/**
 * Calculate lead time in days between when the booking was made and the check-in date.
 * Returns null if bookingDate is missing or invalid.
 */
export function calculateLeadTimeDays(checkIn: string, bookingDate: string | null | undefined): number | null {
  if (!bookingDate || !checkIn) return null;

  const checkInParts = checkIn.trim().split('-');
  const bookingParts = bookingDate.trim().split('-');

  if (checkInParts.length !== 3 || bookingParts.length !== 3) return null;

  const [cy, cm, cd] = checkInParts.map((n) => parseInt(n, 10));
  const [by, bm, bd] = bookingParts.map((n) => parseInt(n, 10));

  if (isNaN(cy) || isNaN(cm) || isNaN(cd) || isNaN(by) || isNaN(bm) || isNaN(bd)) return null;

  const checkInUtc = Date.UTC(cy, cm - 1, cd);
  const bookingUtc = Date.UTC(by, bm - 1, bd);

  const diffMs = checkInUtc - bookingUtc;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Clamped at 0 if booking was on or after check-in (same-day booking)
  return Math.max(0, diffDays);
}

/**
 * Get effective nightly rate for a booking.
 * Favors `nightly_rate` if > 0, otherwise computes accommodation base / number_of_nights.
 */
export function getBookingEffectiveNightlyRate(b: Booking): number {
  if (b.nightly_rate && Number(b.nightly_rate) > 0) {
    return Math.round(Number(b.nightly_rate));
  }

  const accommodationBase = Math.max(
    0,
    (Number(b.net_payout) || Number(b.gross_amount) || 0) - (Number(b.cleaning_fee_collected) || 0)
  );

  const nights = Number(b.number_of_nights) || 1;
  return nights > 0 ? Math.round(accommodationBase / nights) : 0;
}

/**
 * Extracts and sorts all unique available months (YYYY-MM) present in the bookings list,
 * including current and surrounding months so the user always has rich navigation.
 */
export function getAvailableMonths(bookings: Booking[], referenceDateStr?: string): string[] {
  const monthsSet = new Set<string>();

  // Include current month
  const todayStr = referenceDateStr || getColombiaDateTime().dateStr;
  const currentMonthKey = todayStr.substring(0, 7);
  monthsSet.add(currentMonthKey);

  bookings.forEach((b) => {
    if (b.check_in && b.check_in.length >= 7) {
      monthsSet.add(b.check_in.substring(0, 7));
    }
    if (b.check_out && b.check_out.length >= 7) {
      monthsSet.add(b.check_out.substring(0, 7));
    }
    if (b.booking_date && b.booking_date.length >= 7) {
      monthsSet.add(b.booking_date.substring(0, 7));
    }
  });

  return Array.from(monthsSet).sort().reverse();
}

/**
 * Compute detailed hospitality analytics for a specific month.
 */
export function calculateMonthAnalytics(
  bookings: Booking[],
  monthKey: string,
  options: AnalyticsFilterOptions = {}
): MonthAnalytics {
  const { channelFilter = 'all', horizonFilter = 'all', referenceDateStr } = options;
  const todayStr = referenceDateStr || getColombiaDateTime().dateStr;

  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10); // 1-12
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthLabel = formatMonthYear(monthKey);

  // Filter valid bookings
  const validBookings = bookings.filter((b) => {
    if (resolveBookingStatus(b) === 'cancelled') return false;

    // Channel filter
    if (channelFilter === 'airbnb' && b.source !== 'airbnb') return false;
    if (channelFilter === 'direct' && b.source === 'airbnb') return false;

    // Horizon filter (Real vs Futura)
    if (horizonFilter === 'real' && !isBookingReal(b, todayStr)) return false;
    if (horizonFilter === 'future' && !isBookingFuture(b, todayStr)) return false;

    return true;
  });

  // Build daily occupancy array for day 1..daysInMonth
  const dailyStatus: DailyOccupancyStatus[] = [];
  let occupiedNights = 0;
  let totalAccommodationRevenue = 0;

  let airbnbNights = 0;
  let airbnbRevenue = 0;
  let directNights = 0;
  let directRevenue = 0;

  // Track nights per booking in this month
  const bookingNightsMap = new Map<string, number>();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${monthKey}-${dayStr}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeekIdx = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeekIdx === 5 || dayOfWeekIdx === 6; // Fri or Sat night

    // Find if any booking occupies this night: check_in <= dateStr < check_out
    const occupyingBooking = validBookings.find(
      (b) => b.check_in <= dateStr && dateStr < b.check_out
    );

    if (occupyingBooking) {
      occupiedNights++;
      const effectiveRate = getBookingEffectiveNightlyRate(occupyingBooking);
      totalAccommodationRevenue += effectiveRate;

      const isAirbnb = occupyingBooking.source === 'airbnb';
      if (isAirbnb) {
        airbnbNights++;
        airbnbRevenue += effectiveRate;
      } else {
        directNights++;
        directRevenue += effectiveRate;
      }

      bookingNightsMap.set(occupyingBooking.id, (bookingNightsMap.get(occupyingBooking.id) || 0) + 1);

      dailyStatus.push({
        dayNumber: day,
        dateStr,
        dayOfWeek: SPANISH_DAYS_SHORT[dayOfWeekIdx],
        dayOfWeekShort: SPANISH_DAYS_SINGLE[dayOfWeekIdx],
        isWeekend,
        isOccupied: true,
        guestName: occupyingBooking.guest_name,
        bookingId: occupyingBooking.id,
        confirmationCode: occupyingBooking.airbnb_confirmation_code,
        nightlyRate: effectiveRate,
        source: occupyingBooking.source,
      });
    } else {
      dailyStatus.push({
        dayNumber: day,
        dateStr,
        dayOfWeek: SPANISH_DAYS_SHORT[dayOfWeekIdx],
        dayOfWeekShort: SPANISH_DAYS_SINGLE[dayOfWeekIdx],
        isWeekend,
        isOccupied: false,
      });
    }
  }

  const availableNights = daysInMonth;
  const vacantNights = Math.max(0, daysInMonth - occupiedNights);
  const occupancyRate = daysInMonth > 0 ? (occupiedNights / daysInMonth) * 100 : 0;

  // ADR & RevPAR
  const adr = occupiedNights > 0 ? Math.round(totalAccommodationRevenue / occupiedNights) : 0;
  const revPar = daysInMonth > 0 ? Math.round(totalAccommodationRevenue / daysInMonth) : 0;

  const airbnbAdr = airbnbNights > 0 ? Math.round(airbnbRevenue / airbnbNights) : 0;
  const directAdr = directNights > 0 ? Math.round(directRevenue / directNights) : 0;

  // Bookings touching this month
  const touchingBookings = validBookings.filter((b) => (bookingNightsMap.get(b.id) || 0) > 0);
  const touchingStayGroups = groupBookingsByStay(touchingBookings);
  const totalBookings = touchingStayGroups.length;

  // LOS (Length of Stay)
  let totalStayNights = 0;
  let minLos = totalBookings > 0 ? 999999 : 0;
  let maxLos = 0;

  const losBucketsCount = {
    short: 0, // 1-2 nights
    standard: 0, // 3-5 nights
    week: 0, // 6-9 nights
    long: 0, // 10+ nights
  };

  touchingStayGroups.forEach((group) => {
    const nights =
      Math.max(...group.map((b) => Number(b.number_of_nights) || 0)) ||
      (bookingNightsMap.get(group[0].id) || 1);
    totalStayNights += nights;
    if (nights < minLos) minLos = nights;
    if (nights > maxLos) maxLos = nights;

    if (nights <= 2) losBucketsCount.short++;
    else if (nights <= 5) losBucketsCount.standard++;
    else if (nights <= 9) losBucketsCount.week++;
    else losBucketsCount.long++;
  });

  if (minLos === 999999) minLos = 0;
  const averageLos = totalBookings > 0 ? parseFloat((totalStayNights / totalBookings).toFixed(1)) : 0;

  const losBuckets: LosBucket[] = [
    {
      label: '1 - 2 noches',
      count: losBucketsCount.short,
      percentage: totalBookings > 0 ? Math.round((losBucketsCount.short / totalBookings) * 100) : 0,
      description: 'Escapadas de fin de semana',
    },
    {
      label: '3 - 5 noches',
      count: losBucketsCount.standard,
      percentage: totalBookings > 0 ? Math.round((losBucketsCount.standard / totalBookings) * 100) : 0,
      description: 'Estadía promedio vacacional',
    },
    {
      label: '6 - 9 noches',
      count: losBucketsCount.week,
      percentage: totalBookings > 0 ? Math.round((losBucketsCount.week / totalBookings) * 100) : 0,
      description: 'Semana completa de descanso',
    },
    {
      label: '10+ noches',
      count: losBucketsCount.long,
      percentage: totalBookings > 0 ? Math.round((losBucketsCount.long / totalBookings) * 100) : 0,
      description: 'Larga estadía / nómadas',
    },
  ];

  // Lead Time (Ventana de Reserva)
  let totalLeadTimeDays = 0;
  let bookingsWithLeadTimeCount = 0;
  let minLeadTime: number | null = null;
  let maxLeadTime: number | null = null;

  const leadTimeBucketsCount = {
    lastMinute: 0, // 0-3 days
    shortTerm: 0, // 4-14 days
    mediumTerm: 0, // 15-30 days
    advance: 0, // 30+ days
  };

  const monthBookings: MonthBookingDetail[] = touchingStayGroups.map((group) => {
    const b = group[0];
    const nightsInMonth = Math.max(...group.map((item) => bookingNightsMap.get(item.id) || 0));

    let totalAccommodationBase = 0;
    group.forEach((item) => {
      const base = Math.max(
        0,
        (Number(item.net_payout) || Number(item.gross_amount) || 0) - (Number(item.cleaning_fee_collected) || 0)
      );
      totalAccommodationBase += base;
    });

    const totalReservationNights =
      Math.max(...group.map((item) => Number(item.number_of_nights) || 0)) || nightsInMonth || 1;
    const effectiveNightlyRate =
      b.nightly_rate && Number(b.nightly_rate) > 0
        ? Math.round(Number(b.nightly_rate))
        : Math.round(totalAccommodationBase / totalReservationNights);
    const accommodationRevenueInMonth = nightsInMonth * effectiveNightlyRate;
    const leadTimeDays = calculateLeadTimeDays(b.check_in, b.booking_date);

    if (leadTimeDays !== null) {
      bookingsWithLeadTimeCount++;
      totalLeadTimeDays += leadTimeDays;
      if (minLeadTime === null || leadTimeDays < minLeadTime) minLeadTime = leadTimeDays;
      if (maxLeadTime === null || leadTimeDays > maxLeadTime) maxLeadTime = leadTimeDays;

      if (leadTimeDays <= 3) leadTimeBucketsCount.lastMinute++;
      else if (leadTimeDays <= 14) leadTimeBucketsCount.shortTerm++;
      else if (leadTimeDays <= 30) leadTimeBucketsCount.mediumTerm++;
      else leadTimeBucketsCount.advance++;
    }

    return {
      booking: b,
      nightsInMonth,
      totalReservationNights,
      effectiveNightlyRate,
      accommodationRevenueInMonth,
      leadTimeDays,
    };
  });

  const averageLeadTime =
    bookingsWithLeadTimeCount > 0
      ? parseFloat((totalLeadTimeDays / bookingsWithLeadTimeCount).toFixed(1))
      : null;

  const leadTimeBuckets: LeadTimeBucket[] = [
    {
      label: '0 - 3 días',
      count: leadTimeBucketsCount.lastMinute,
      percentage:
        bookingsWithLeadTimeCount > 0
          ? Math.round((leadTimeBucketsCount.lastMinute / bookingsWithLeadTimeCount) * 100)
          : 0,
      description: 'Última hora / Imprevisto',
    },
    {
      label: '4 - 14 días',
      count: leadTimeBucketsCount.shortTerm,
      percentage:
        bookingsWithLeadTimeCount > 0
          ? Math.round((leadTimeBucketsCount.shortTerm / bookingsWithLeadTimeCount) * 100)
          : 0,
      description: 'Corto plazo (1 - 2 semanas)',
    },
    {
      label: '15 - 30 días',
      count: leadTimeBucketsCount.mediumTerm,
      percentage:
        bookingsWithLeadTimeCount > 0
          ? Math.round((leadTimeBucketsCount.mediumTerm / bookingsWithLeadTimeCount) * 100)
          : 0,
      description: 'Mediano plazo (2 - 4 semanas)',
    },
    {
      label: '30+ días',
      count: leadTimeBucketsCount.advance,
      percentage:
        bookingsWithLeadTimeCount > 0
          ? Math.round((leadTimeBucketsCount.advance / bookingsWithLeadTimeCount) * 100)
          : 0,
      description: 'Anticipación alta (+1 mes)',
    },
  ];

  return {
    monthKey,
    monthLabel,
    year,
    month,
    daysInMonth,
    occupiedNights,
    availableNights,
    vacantNights,
    occupancyRate,
    totalAccommodationRevenue,
    adr,
    revPar,
    airbnbNights,
    airbnbRevenue,
    airbnbAdr,
    directNights,
    directRevenue,
    directAdr,
    totalBookings,
    averageLos,
    minLos,
    maxLos,
    losBuckets,
    averageLeadTime,
    minLeadTime,
    maxLeadTime,
    bookingsWithLeadTimeCount,
    leadTimeBuckets,
    dailyStatus,
    monthBookings,
  };
}

/**
 * Calculates Month-over-Month comparison between current and previous month.
 */
export function calculateMoMComparison(
  current: MonthAnalytics,
  previous: MonthAnalytics | null
): MomComparison | null {
  if (!previous) return null;

  const adrDelta = current.adr - previous.adr;
  const adrDeltaPercent = previous.adr > 0 ? (adrDelta / previous.adr) * 100 : 0;

  const occupancyDelta = current.occupancyRate - previous.occupancyRate;

  const revParDelta = current.revPar - previous.revPar;
  const revParDeltaPercent = previous.revPar > 0 ? (revParDelta / previous.revPar) * 100 : 0;

  const revenueDelta = current.totalAccommodationRevenue - previous.totalAccommodationRevenue;
  const revenueDeltaPercent =
    previous.totalAccommodationRevenue > 0
      ? (revenueDelta / previous.totalAccommodationRevenue) * 100
      : 0;

  const losDelta = current.averageLos - previous.averageLos;

  const leadTimeDelta =
    current.averageLeadTime !== null && previous.averageLeadTime !== null
      ? current.averageLeadTime - previous.averageLeadTime
      : null;

  return {
    adrDelta,
    adrDeltaPercent,
    occupancyDelta,
    revParDelta,
    revParDeltaPercent,
    revenueDelta,
    revenueDeltaPercent,
    losDelta,
    leadTimeDelta,
  };
}

/**
 * Computes multi-month trend dataset ordered chronologically.
 */
export function calculateMultiMonthTrends(
  bookings: Booking[],
  monthKeys: string[],
  options: AnalyticsFilterOptions = {}
): MonthAnalytics[] {
  // Sort chronologically ascending for trends
  const sortedKeys = [...monthKeys].sort();
  return sortedKeys.map((key) => calculateMonthAnalytics(bookings, key, options));
}
