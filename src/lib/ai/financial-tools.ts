import { tool } from 'ai';
import { z } from 'zod';
import { supabase } from '../supabase';
import { calculateMonthAnalytics } from '../analytics-utils';
import { getBookingSourceInfo, formatMonthYear, resolveBookingStatus } from '../formatters';
import type { Booking, Expense, Property } from '../../types/database';

export interface FinancialStatsResult {
  monthKey: string;
  monthLabel: string;
  propertyId?: string;
  propertyName?: string;
  currency: string;
  revenue: {
    grossTotal: number;
    accommodationRevenue: number;
    cleaningFeeCollected: number;
    platformNetPayout: number;
    managementFee: number;
    ownerPayout: number;
    adr: number;
    revPar: number;
    totalBookings: number;
    occupiedNights: number;
    daysInMonth: number;
    occupancyRate: string;
    channels: {
      airbnbRevenue: number;
      airbnbNights: number;
      airbnbSharePercent: string;
      directRevenue: number;
      directNights: number;
      directSharePercent: string;
    };
  };
  expenses: {
    total: number;
    count: number;
    byCategory: Record<string, number>;
    categoryPercentages: Record<string, string>;
    highestExpenses: Array<{ description: string; amount: number; category: string; date: string }>;
  };
  profitability: {
    netProfit: number; // Ganancia Neta oficial del Propietario (ownerPayout - totalExpenses)
    profitMarginPercent: string; // Margen neto del propietario (netProfit / ownerPayout)
    operationalProfit: number; // Beneficio operativo antes de comisión (accommodationRevenue - totalExpenses)
    operationalMarginPercent: string; // Margen operativo (operationalProfit / accommodationRevenue)
    ownerNetProfit: number; // Alias retrocompatible
    ownerProfitMarginPercent: string; // Alias retrocompatible
    isProfitable: boolean;
  };
}

export interface AnnualStatsResult {
  year: number;
  propertyId?: string;
  propertyName?: string;
  currency: string;
  totals: {
    grossTotal: number;
    accommodationRevenue: number;
    platformNetPayout: number;
    cleaningFeeCollected: number;
    managementFee: number;
    ownerPayout: number;
    totalExpenses: number;
    netProfit: number;
    ownerNetProfit: number;
    profitMarginPercent: string;
    ownerProfitMarginPercent: string;
    totalBookings: number;
    occupiedNights: number;
  };
  monthlyBreakdown: Array<{
    monthKey: string;
    monthLabel: string;
    grossTotal: number;
    ownerPayout: number;
    expensesTotal: number;
    netProfit: number;
    occupancyRate: string;
  }>;
}

export async function fetchMonthlyFinancialData(params: {
  year: number;
  month: number;
  propertyId?: string;
}): Promise<FinancialStatsResult> {
  const { year, month, propertyId } = params;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthLabel = formatMonthYear(monthKey);

  // 1. Resolve Property Info (for currency and name)
  let targetPropertyId = propertyId;
  let propertyName = 'Apartamento';
  let currency = 'COP';

  if (targetPropertyId && targetPropertyId !== 'all') {
    try {
      const { data: propData } = await supabase
        .from('properties')
        .select('id, name, currency')
        .eq('id', targetPropertyId)
        .maybeSingle();

      if (propData) {
        propertyName = propData.name;
        currency = propData.currency || 'COP';
      }
    } catch (err) {
      console.warn('Could not fetch property metadata:', err);
    }
  }

  // If no property found or no propertyId given, try fallback to the first property
  if ((!targetPropertyId || propertyName === 'Apartamento') && targetPropertyId !== 'all') {
    try {
      let query = supabase.from('properties').select('id, name, currency');
      if (typeof (query as unknown as { order?: unknown }).order === 'function') {
        query = query.order('created_at', { ascending: true });
      }
      const { data: firstProp } = await query.limit(1).maybeSingle();

      if (firstProp) {
        if (!targetPropertyId) targetPropertyId = firstProp.id;
        propertyName = firstProp.name;
        currency = firstProp.currency || 'COP';
      }
    } catch (err) {
      console.warn('Could not fetch default property metadata:', err);
    }
  } else if (targetPropertyId === 'all') {
    propertyName = 'Todas las propiedades';
  }

  // 2. Fetch Bookings for property
  let allBookings: Booking[] = [];
  try {
    let query = supabase.from('bookings').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data, error } = await query;
    if (!error && data) {
      allBookings = data as Booking[];
    }
  } catch (err) {
    console.warn('Error fetching bookings for AI stats:', err);
  }

  // Calculate hospitality analytics strictly for this month
  const analytics = calculateMonthAnalytics(allBookings, monthKey);

  // Filter valid bookings checking in this month (not cancelled)
  const monthBookings = allBookings.filter(
    (b) => b.check_in && b.check_in.startsWith(monthKey) && resolveBookingStatus(b) !== 'cancelled'
  );

  let grossTotal = 0;
  let platformNetPayout = 0;
  let cleaningFeeCollected = 0;
  let ownerPayout = 0;
  let managementFee = 0;

  for (const b of monthBookings) {
    grossTotal += Number(b.gross_amount) || 0;
    platformNetPayout += Number(b.net_payout) || 0;
    cleaningFeeCollected += Number(b.cleaning_fee_collected) || 0;

    const extra = Number(b.extra_amount) || 0;
    const op =
      b.owner_payout !== undefined && b.owner_payout !== null
        ? Number(b.owner_payout)
        : Math.round(
          (Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) + extra) *
          getBookingSourceInfo(b.source).ownerRate
        );
    ownerPayout += op;

    const mf =
      b.management_fee !== undefined && b.management_fee !== null
        ? Number(b.management_fee)
        : Math.round(
          (Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) + extra) *
          getBookingSourceInfo(b.source).commissionRate
        );
    managementFee += mf;
  }

  // Accommodation revenue: prefer exact bookings sum; fallback to daily calculated rate
  const accommodationRevenue =
    ownerPayout + managementFee > 0
      ? ownerPayout + managementFee
      : analytics.totalAccommodationRevenue || 0;

  // 3. Fetch Expenses for the property
  let allExpenses: Expense[] = [];
  try {
    let query = supabase.from('expenses').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data, error } = await query;
    if (!error && data) {
      allExpenses = data as Expense[];
    }
  } catch (err) {
    console.warn('Error fetching expenses for AI stats:', err);
  }

  // Filter expenses strictly for this month (billing_month takes precedence, fallback to date)
  const monthExpenses = allExpenses.filter((e) => {
    return e.billing_month ? e.billing_month === monthKey : Boolean(e.date && e.date.startsWith(monthKey));
  });

  // Aggregate expenses
  let totalExpenses = 0;
  const byCategory: Record<string, number> = {};

  for (const exp of monthExpenses) {
    const amount = Number(exp.amount) || 0;
    totalExpenses += amount;
    const cat = exp.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + amount;
  }

  const categoryPercentages: Record<string, string> = {};
  for (const [cat, amt] of Object.entries(byCategory)) {
    categoryPercentages[cat] =
      totalExpenses > 0 ? `${((amt / totalExpenses) * 100).toFixed(1)}%` : '0%';
  }

  // Top 5 highest expenses
  const highestExpenses = [...monthExpenses]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5)
    .map((e) => ({
      description: e.description,
      amount: Number(e.amount) || 0,
      category: e.category,
      date: e.date,
    }));

  // Profitability calculations
  // netProfit = Ganancia Neta oficial del Propietario (Owner Cash Flow = ownerPayout - totalExpenses)
  const baseRevenue = ownerPayout > 0 ? ownerPayout : accommodationRevenue;
  const netProfit = baseRevenue - totalExpenses;
  const profitMarginPercent =
    baseRevenue > 0
      ? `${((netProfit / baseRevenue) * 100).toFixed(1)}%`
      : totalExpenses > 0
        ? '-100%'
        : '0%';

  // operationalProfit = Beneficio operativo antes de comisión de administración (accommodationRevenue - totalExpenses)
  const operationalProfit = accommodationRevenue - totalExpenses;
  const operationalMarginPercent =
    accommodationRevenue > 0
      ? `${((operationalProfit / accommodationRevenue) * 100).toFixed(1)}%`
      : totalExpenses > 0
        ? '-100%'
        : '0%';

  const airbnbShare =
    analytics.occupiedNights > 0
      ? `${((analytics.airbnbNights / analytics.occupiedNights) * 100).toFixed(1)}%`
      : '0%';
  const directShare =
    analytics.occupiedNights > 0
      ? `${((analytics.directNights / analytics.occupiedNights) * 100).toFixed(1)}%`
      : '0%';

  return {
    monthKey,
    monthLabel,
    propertyId: targetPropertyId,
    propertyName,
    currency,
    revenue: {
      grossTotal,
      accommodationRevenue,
      cleaningFeeCollected,
      platformNetPayout,
      managementFee,
      ownerPayout,
      adr: analytics.adr,
      revPar: analytics.revPar,
      totalBookings: monthBookings.length > 0 ? monthBookings.length : analytics.totalBookings,
      occupiedNights: analytics.occupiedNights,
      daysInMonth: analytics.daysInMonth,
      occupancyRate: `${analytics.occupancyRate.toFixed(1)}%`,
      channels: {
        airbnbRevenue: analytics.airbnbRevenue,
        airbnbNights: analytics.airbnbNights,
        airbnbSharePercent: airbnbShare,
        directRevenue: analytics.directRevenue,
        directNights: analytics.directNights,
        directSharePercent: directShare,
      },
    },
    expenses: {
      total: totalExpenses,
      count: monthExpenses.length,
      byCategory,
      categoryPercentages,
      highestExpenses,
    },
    profitability: {
      netProfit,
      profitMarginPercent,
      operationalProfit,
      operationalMarginPercent,
      ownerNetProfit: netProfit,
      ownerProfitMarginPercent: profitMarginPercent,
      isProfitable: netProfit > 0,
    },
  };
}

export async function fetchAnnualFinancialData(params: {
  year: number;
  propertyId?: string;
}): Promise<AnnualStatsResult> {
  const { year, propertyId } = params;
  const yearPrefix = `${year}-`;

  let targetPropertyId = propertyId;
  let propertyName = 'Apartamento';
  let currency = 'COP';

  if (targetPropertyId && targetPropertyId !== 'all') {
    try {
      const { data: propData } = await supabase
        .from('properties')
        .select('id, name, currency')
        .eq('id', targetPropertyId)
        .maybeSingle();

      if (propData) {
        propertyName = propData.name;
        currency = propData.currency || 'COP';
      }
    } catch (err) {
      console.warn('Could not fetch property metadata:', err);
    }
  }

  // If no property found or no propertyId given, try fallback to the first property
  if ((!targetPropertyId || propertyName === 'Apartamento') && targetPropertyId !== 'all') {
    try {
      let query = supabase.from('properties').select('id, name, currency');
      if (typeof (query as unknown as { order?: unknown }).order === 'function') {
        query = query.order('created_at', { ascending: true });
      }
      const { data: firstProp } = await query.limit(1).maybeSingle();

      if (firstProp) {
        if (!targetPropertyId) targetPropertyId = firstProp.id;
        propertyName = firstProp.name;
        currency = firstProp.currency || 'COP';
      }
    } catch (err) {
      console.warn('Could not fetch default property metadata:', err);
    }
  } else if (targetPropertyId === 'all') {
    propertyName = 'Todas las propiedades';
  }

  // Fetch all bookings and expenses for the year
  let allBookings: Booking[] = [];
  try {
    let query = supabase.from('bookings').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data } = await query;
    if (data) allBookings = data as Booking[];
  } catch (err) {
    console.warn('Error fetching bookings for annual stats:', err);
  }

  let allExpenses: Expense[] = [];
  try {
    let query = supabase.from('expenses').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data } = await query;
    if (data) allExpenses = data as Expense[];
  } catch (err) {
    console.warn('Error fetching expenses for annual stats:', err);
  }

  const yearBookings = allBookings.filter(
    (b) => b.check_in && b.check_in.startsWith(yearPrefix) && resolveBookingStatus(b) !== 'cancelled'
  );

  let grossTotal = 0;
  let platformNetPayout = 0;
  let cleaningFeeCollected = 0;
  let ownerPayout = 0;
  let managementFee = 0;

  for (const b of yearBookings) {
    grossTotal += Number(b.gross_amount) || 0;
    platformNetPayout += Number(b.net_payout) || 0;
    cleaningFeeCollected += Number(b.cleaning_fee_collected) || 0;

    const extra = Number(b.extra_amount) || 0;
    const op =
      b.owner_payout !== undefined && b.owner_payout !== null
        ? Number(b.owner_payout)
        : Math.round(
          (Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) + extra) *
          getBookingSourceInfo(b.source).ownerRate
        );
    ownerPayout += op;

    const mf =
      b.management_fee !== undefined && b.management_fee !== null
        ? Number(b.management_fee)
        : Math.round(
          (Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) + extra) *
          getBookingSourceInfo(b.source).commissionRate
        );
    managementFee += mf;
  }

  const accommodationRevenue = ownerPayout + managementFee;

  const yearExpenses = allExpenses.filter((e) => {
    return e.billing_month ? e.billing_month.startsWith(yearPrefix) : Boolean(e.date && e.date.startsWith(yearPrefix));
  });

  const totalExpenses = yearExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const ownerNetProfit = ownerPayout - totalExpenses;
  const netProfit = ownerNetProfit;

  // Monthly breakdown for all 12 months
  const monthlyBreakdown: AnnualStatsResult['monthlyBreakdown'] = [];
  let totalOccupiedNights = 0;

  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    const monthLabel = formatMonthYear(monthKey);
    const mBookings = yearBookings.filter((b) => b.check_in.startsWith(monthKey));
    const mExpenses = yearExpenses.filter((e) =>
      e.billing_month ? e.billing_month === monthKey : Boolean(e.date && e.date.startsWith(monthKey))
    );

    const mGross = mBookings.reduce((s, b) => s + (Number(b.gross_amount) || 0), 0);
    const mOwner = mBookings.reduce((s, b) => {
      return (
        s +
        (b.owner_payout !== undefined && b.owner_payout !== null
          ? Number(b.owner_payout)
          : Math.round(
            Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) *
            getBookingSourceInfo(b.source).ownerRate
          ))
      );
    }, 0);
    const mExp = mExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const mAnalytics = calculateMonthAnalytics(allBookings, monthKey);
    totalOccupiedNights += mAnalytics.occupiedNights;

    monthlyBreakdown.push({
      monthKey,
      monthLabel,
      grossTotal: mGross,
      ownerPayout: mOwner,
      expensesTotal: mExp,
      netProfit: mOwner - mExp,
      occupancyRate: `${mAnalytics.occupancyRate.toFixed(1)}%`,
    });
  }

  return {
    year,
    propertyId: targetPropertyId,
    propertyName,
    currency,
    totals: {
      grossTotal,
      accommodationRevenue,
      platformNetPayout,
      cleaningFeeCollected,
      managementFee,
      ownerPayout,
      totalExpenses,
      netProfit,
      ownerNetProfit,
      profitMarginPercent:
        ownerPayout > 0 ? `${((netProfit / ownerPayout) * 100).toFixed(1)}%` : '0%',
      ownerProfitMarginPercent:
        ownerPayout > 0 ? `${((ownerNetProfit / ownerPayout) * 100).toFixed(1)}%` : '0%',
      totalBookings: yearBookings.length,
      occupiedNights: totalOccupiedNights,
    },
    monthlyBreakdown,
  };
}

/**
 * AI Tool definitions to be passed to streamText
 */
export function createFinancialTools(defaultPropertyId?: string) {
  return {
    getMonthlyFinancials: tool({
      description:
        'Obtiene el resumen financiero determinístico (ingresos facturados, pago a dueños, ocupación, gastos por categoría y ganancia neta) de un mes y año específicos.',
      inputSchema: z.object({
        year: z.number().describe('Año de la consulta, ej: 2026'),
        month: z.number().min(1).max(12).describe('Mes numérico de la consulta (1 para Enero, 9 para Septiembre, etc.)'),
        propertyId: z
          .string()
          .optional()
          .describe('ID de la propiedad a consultar. Si no se especifica, usa la propiedad activa.'),
      }),
      execute: async ({
        year,
        month,
        propertyId,
      }: {
        year: number;
        month: number;
        propertyId?: string;
      }) => {
        const targetId = propertyId || defaultPropertyId;
        return await fetchMonthlyFinancialData({ year, month, propertyId: targetId });
      },
    }),

    getAnnualFinancials: tool({
      description:
        'Obtiene el resumen financiero consolidado de todo un año calendario (total ingresos, total gastos, balance anual y desglose mes a mes).',
      inputSchema: z.object({
        year: z.number().describe('Año calendario de la consulta, ej: 2026'),
        propertyId: z
          .string()
          .optional()
          .describe('ID de la propiedad a consultar. Si no se especifica, usa la propiedad activa.'),
      }),
      execute: async ({
        year,
        propertyId,
      }: {
        year: number;
        propertyId?: string;
      }) => {
        const targetId = propertyId || defaultPropertyId;
        return await fetchAnnualFinancialData({ year, propertyId: targetId });
      },
    }),

    getUserProperties: tool({
      description: 'Obtiene el listado de propiedades/apartamentos disponibles del usuario.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const { data, error } = await supabase.from('properties').select('id, name, city, currency');
          if (error || !data) return [];
          return data as Array<Pick<Property, 'id' | 'name' | 'city' | 'currency'>>;
        } catch {
          return [];
        }
      },
    }),
  };
}
