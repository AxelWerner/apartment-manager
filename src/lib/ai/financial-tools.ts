import { tool } from 'ai';
import { z } from 'zod';
import { supabase, DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import { calculateMonthAnalytics } from '@/lib/analytics-utils';
import type { Booking, Expense, Property } from '@/types/database';

export interface FinancialStatsResult {
  monthKey: string;
  propertyId?: string;
  propertyName?: string;
  currency: string;
  revenue: {
    grossTotal: number;
    accommodationRevenue: number;
    adr: number;
    revPar: number;
    totalBookings: number;
    occupiedNights: number;
    occupancyRate: string;
    channels: {
      airbnbRevenue: number;
      airbnbNights: number;
      directRevenue: number;
      directNights: number;
    };
  };
  expenses: {
    total: number;
    byCategory: Record<string, number>;
    highestExpenses: Array<{ description: string; amount: number; category: string; date: string }>;
  };
  profitability: {
    netProfit: number;
    profitMarginPercent: string;
  };
}

export async function fetchMonthlyFinancialData(params: {
  year: number;
  month: number;
  propertyId?: string;
}): Promise<FinancialStatsResult> {
  const { year, month, propertyId } = params;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const targetPropertyId = propertyId || DEFAULT_PROPERTY_ID;

  // 1. Fetch Property Info (for currency and name)
  let propertyName = 'Apartamento';
  let currency = 'COP';

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

  // 2. Fetch Bookings for property
  let bookings: Booking[] = [];
  try {
    let query = supabase.from('bookings').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data, error } = await query;
    if (!error && data) {
      bookings = data as Booking[];
    }
  } catch (err) {
    console.warn('Error fetching bookings for AI stats:', err);
  }

  // Calculate analytics using existing analytics utility
  const analytics = calculateMonthAnalytics(bookings, monthKey);

  // 3. Fetch Expenses for the month
  let expenses: Expense[] = [];
  try {
    let query = supabase.from('expenses').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data, error } = await query;
    if (!error && data) {
      const allExpenses = data as Expense[];
      // Filter expenses for this month
      expenses = allExpenses.filter((e) => {
        if (e.billing_month === monthKey) return true;
        if (e.date && e.date.startsWith(monthKey)) return true;
        return false;
      });
    }
  } catch (err) {
    console.warn('Error fetching expenses for AI stats:', err);
  }

  // Aggregate expenses
  let totalExpenses = 0;
  const byCategory: Record<string, number> = {};

  for (const exp of expenses) {
    const amount = Number(exp.amount) || 0;
    totalExpenses += amount;
    const cat = exp.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + amount;
  }

  // Top 5 highest expenses
  const highestExpenses = [...expenses]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5)
    .map((e) => ({
      description: e.description,
      amount: Number(e.amount) || 0,
      category: e.category,
      date: e.date,
    }));

  const totalRevenue = analytics.totalAccommodationRevenue || 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) + '%' : '0%';

  return {
    monthKey,
    propertyId: targetPropertyId,
    propertyName,
    currency,
    revenue: {
      grossTotal: bookings.reduce((sum, b) => sum + (Number(b.gross_amount) || 0), 0),
      accommodationRevenue: totalRevenue,
      adr: analytics.adr,
      revPar: analytics.revPar,
      totalBookings: analytics.totalBookings,
      occupiedNights: analytics.occupiedNights,
      occupancyRate: `${analytics.occupancyRate.toFixed(1)}%`,
      channels: {
        airbnbRevenue: analytics.airbnbRevenue,
        airbnbNights: analytics.airbnbNights,
        directRevenue: analytics.directRevenue,
        directNights: analytics.directNights,
      },
    },
    expenses: {
      total: totalExpenses,
      byCategory,
      highestExpenses,
    },
    profitability: {
      netProfit,
      profitMarginPercent,
    },
  };
}

/**
 * AI Tool definitions to be passed to streamText
 */
export function createFinancialTools(defaultPropertyId?: string) {
  return {
    getMonthlyFinancials: tool({
      description:
        'Obtiene el resumen financiero determinístico (ingresos, ocupación, gastos y utilidad neta) de un mes y año específicos.',
      inputSchema: z.object({
        year: z.number().describe('Año de la consulta, ej: 2026'),
        month: z.number().min(1).max(12).describe('Mes numérico de la consulta (1 para Enero, 9 para Septiembre, etc.)'),
        propertyId: z
          .string()
          .optional()
          .describe('ID de la propiedad a consultar. Si no se especifica, usa la propiedad activa.'),
      }),
      execute: async ({ year, month, propertyId }) => {
        const targetId = propertyId || defaultPropertyId;
        return await fetchMonthlyFinancialData({ year, month, propertyId: targetId });
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
