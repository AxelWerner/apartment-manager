import process from 'node:process';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// Types
// ==============================================================================

export interface ChatRequestBody {
  messages: Array<{
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    parts?: Array<{ type: string; text?: string }>;
  }>;
  activePropertyId?: string;
}

interface RawBooking {
  id: string;
  property_id?: string | null;
  check_in: string;
  check_out: string;
  number_of_nights?: number | null;
  guest_name?: string | null;
  airbnb_confirmation_code?: string | null;
  gross_amount?: number | null;
  net_payout?: number | null;
  cleaning_fee_collected?: number | null;
  owner_payout?: number | null;
  management_fee?: number | null;
  nightly_rate?: number | null;
  status?: string | null;
  source?: string | null;
  booking_date?: string | null;
}

interface RawExpense {
  id: string;
  property_id?: string | null;
  description: string;
  amount: number;
  category?: string | null;
  expense_type?: string | null;
  date?: string | null;
  billing_month?: string | null;
}

interface RawProperty {
  id: string;
  name: string;
  city?: string | null;
  currency?: string | null;
}

// ==============================================================================
// Supabase Client Helper
// ==============================================================================

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
  return createClient(url, key);
}

// ==============================================================================
// Formatting & Calculation Helpers (100% self-contained)
// ==============================================================================

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function formatMonthYear(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  if (!y || !m || m < 1 || m > 12) return monthKey;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function resolveBookingStatus(b: { status?: string | null }): string {
  if (b.status === 'cancelled') return 'cancelled';
  return b.status || 'confirmed';
}

function getBookingSourceInfo(source?: string | null): { ownerRate: number; commissionRate: number } {
  const s = (source || '').toLowerCase().trim();
  if (s === 'direct' || s === 'directo') {
    return { ownerRate: 0.9, commissionRate: 0.1 };
  }
  return { ownerRate: 0.8, commissionRate: 0.2 };
}

function calculateMonthAnalytics(bookings: RawBooking[], monthKey: string) {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  const validBookings = bookings.filter((b) => resolveBookingStatus(b) !== 'cancelled');

  let occupiedNights = 0;
  let totalAccommodationRevenue = 0;
  let airbnbNights = 0;
  let airbnbRevenue = 0;
  let directNights = 0;
  let directRevenue = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${monthKey}-${dayStr}`;

    const occupyingBooking = validBookings.find(
      (b) => b.check_in && b.check_out && b.check_in <= dateStr && dateStr < b.check_out
    );

    if (occupyingBooking) {
      occupiedNights++;
      const nights = Number(occupyingBooking.number_of_nights) || 1;
      const baseAmount = Math.max(
        0,
        (Number(occupyingBooking.net_payout) || Number(occupyingBooking.gross_amount) || 0) -
          (Number(occupyingBooking.cleaning_fee_collected) || 0)
      );
      const effectiveRate = Number(occupyingBooking.nightly_rate) || (nights > 0 ? Math.round(baseAmount / nights) : 0);

      totalAccommodationRevenue += effectiveRate;
      if (occupyingBooking.source === 'airbnb') {
        airbnbNights++;
        airbnbRevenue += effectiveRate;
      } else {
        directNights++;
        directRevenue += effectiveRate;
      }
    }
  }

  const occupancyRate = daysInMonth > 0 ? (occupiedNights / daysInMonth) * 100 : 0;
  const adr = occupiedNights > 0 ? Math.round(totalAccommodationRevenue / occupiedNights) : 0;
  const revPar = daysInMonth > 0 ? Math.round(totalAccommodationRevenue / daysInMonth) : 0;

  return {
    daysInMonth,
    occupiedNights,
    occupancyRate,
    adr,
    revPar,
    totalBookings: validBookings.length,
    totalAccommodationRevenue,
    airbnbNights,
    airbnbRevenue,
    directNights,
    directRevenue,
  };
}

// ==============================================================================
// Financial Fetchers (Deterministic Metrics)
// ==============================================================================

async function fetchMonthlyFinancialData(params: {
  year: number;
  month: number;
  propertyId?: string;
}) {
  const { year, month, propertyId } = params;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthLabel = formatMonthYear(monthKey);
  const supabase = getSupabase();

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
      console.warn('[API/CHAT] Error fetching property:', err);
    }
  }

  if ((!targetPropertyId || propertyName === 'Apartamento') && targetPropertyId !== 'all') {
    try {
      const { data: firstProp } = await supabase.from('properties').select('id, name, currency').limit(1).maybeSingle();
      if (firstProp) {
        if (!targetPropertyId) targetPropertyId = firstProp.id;
        propertyName = firstProp.name;
        currency = firstProp.currency || 'COP';
      }
    } catch (err) {
      console.warn('[API/CHAT] Error fetching default property:', err);
    }
  } else if (targetPropertyId === 'all') {
    propertyName = 'Todas las propiedades';
  }

  // 1. Fetch Bookings
  let allBookings: RawBooking[] = [];
  try {
    let query = supabase.from('bookings').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data, error } = await query;
    if (!error && data) allBookings = data as RawBooking[];
  } catch (err) {
    console.warn('[API/CHAT] Error fetching bookings:', err);
  }

  const analytics = calculateMonthAnalytics(allBookings, monthKey);
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

    const op =
      b.owner_payout !== undefined && b.owner_payout !== null
        ? Number(b.owner_payout)
        : Math.round(
            Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) *
              getBookingSourceInfo(b.source).ownerRate
          );
    ownerPayout += op;

    const mf =
      b.management_fee !== undefined && b.management_fee !== null
        ? Number(b.management_fee)
        : Math.round(
            Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) *
              getBookingSourceInfo(b.source).commissionRate
          );
    managementFee += mf;
  }

  const accommodationRevenue = ownerPayout + managementFee;

  // 2. Fetch Expenses
  let allExpenses: RawExpense[] = [];
  try {
    let query = supabase.from('expenses').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data, error } = await query;
    if (!error && data) allExpenses = data as RawExpense[];
  } catch (err) {
    console.warn('[API/CHAT] Error fetching expenses:', err);
  }

  const monthExpenses = allExpenses.filter((e) =>
    e.billing_month ? e.billing_month === monthKey : Boolean(e.date && e.date.startsWith(monthKey))
  );

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
    categoryPercentages[cat] = totalExpenses > 0 ? `${((amt / totalExpenses) * 100).toFixed(1)}%` : '0%';
  }

  const highestExpenses = [...monthExpenses]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5)
    .map((e) => ({
      description: e.description,
      amount: Number(e.amount) || 0,
      category: e.category || 'other',
      date: e.date || '',
    }));

  const baseRevenue = ownerPayout > 0 ? ownerPayout : accommodationRevenue;
  const netProfit = baseRevenue - totalExpenses;
  const profitMarginPercent =
    baseRevenue > 0 ? `${((netProfit / baseRevenue) * 100).toFixed(1)}%` : totalExpenses > 0 ? '-100%' : '0%';

  const airbnbShare =
    analytics.occupiedNights > 0 ? `${((analytics.airbnbNights / analytics.occupiedNights) * 100).toFixed(1)}%` : '0%';
  const directShare =
    analytics.occupiedNights > 0 ? `${((analytics.directNights / analytics.occupiedNights) * 100).toFixed(1)}%` : '0%';

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
      operationalProfit: accommodationRevenue - totalExpenses,
      operationalMarginPercent:
        accommodationRevenue > 0
          ? `${(((accommodationRevenue - totalExpenses) / accommodationRevenue) * 100).toFixed(1)}%`
          : totalExpenses > 0
            ? '-100%'
            : '0%',
      isProfitable: netProfit > 0,
    },
  };
}

async function fetchAnnualFinancialData(params: { year: number; propertyId?: string }) {
  const { year, propertyId } = params;
  const yearPrefix = `${year}-`;
  const supabase = getSupabase();

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
      console.warn('[API/CHAT] Error fetching property:', err);
    }
  }

  let allBookings: RawBooking[] = [];
  try {
    let query = supabase.from('bookings').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data } = await query;
    if (data) allBookings = data as RawBooking[];
  } catch (err) {
    console.warn('[API/CHAT] Error fetching annual bookings:', err);
  }

  let allExpenses: RawExpense[] = [];
  try {
    let query = supabase.from('expenses').select('*');
    if (targetPropertyId && targetPropertyId !== 'all') {
      query = query.eq('property_id', targetPropertyId);
    }
    const { data } = await query;
    if (data) allExpenses = data as RawExpense[];
  } catch (err) {
    console.warn('[API/CHAT] Error fetching annual expenses:', err);
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

    const op =
      b.owner_payout !== undefined && b.owner_payout !== null
        ? Number(b.owner_payout)
        : Math.round(
            Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) *
              getBookingSourceInfo(b.source).ownerRate
          );
    ownerPayout += op;

    const mf =
      b.management_fee !== undefined && b.management_fee !== null
        ? Number(b.management_fee)
        : Math.round(
            Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0)) *
              getBookingSourceInfo(b.source).commissionRate
          );
    managementFee += mf;
  }

  const yearExpenses = allExpenses.filter((e) =>
    e.billing_month ? e.billing_month.startsWith(yearPrefix) : Boolean(e.date && e.date.startsWith(yearPrefix))
  );

  const totalExpenses = yearExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = ownerPayout - totalExpenses;

  const monthlyBreakdown = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    const monthLabel = formatMonthYear(monthKey);
    const mBookings = yearBookings.filter((b) => b.check_in.startsWith(monthKey));
    const mExpenses = yearExpenses.filter((e) =>
      e.billing_month ? e.billing_month === monthKey : Boolean(e.date && e.date.startsWith(monthKey))
    );

    const mGross = mBookings.reduce((s, b) => s + (Number(b.gross_amount) || 0), 0);
    const mOwnerPayout = mBookings.reduce((s, b) => {
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
    const mAnalytics = calculateMonthAnalytics(yearBookings, monthKey);

    monthlyBreakdown.push({
      monthKey,
      monthLabel,
      grossTotal: mGross,
      ownerPayout: mOwnerPayout,
      expensesTotal: mExp,
      netProfit: mOwnerPayout - mExp,
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
      accommodationRevenue: ownerPayout + managementFee,
      platformNetPayout,
      cleaningFeeCollected,
      managementFee,
      ownerPayout,
      totalExpenses,
      netProfit,
      profitMarginPercent:
        ownerPayout > 0 ? `${((netProfit / ownerPayout) * 100).toFixed(1)}%` : totalExpenses > 0 ? '-100%' : '0%',
      totalBookings: yearBookings.length,
    },
    monthlyBreakdown,
  };
}

// ==============================================================================
// Financial Tools Definition
// ==============================================================================

function createFinancialTools(defaultPropertyId?: string) {
  const supabase = getSupabase();

  return {
    getMonthlyFinancials: tool({
      description:
        'Obtiene el resumen financiero determinístico (ingresos facturados, pago a dueños, ocupación, gastos por categoría y ganancia neta) de un mes y año específicos.',
      inputSchema: z.object({
        year: z.number().describe('Año de la consulta, ej: 2026'),
        month: z
          .number()
          .min(1)
          .max(12)
          .describe('Mes numérico de la consulta (1 para Enero, 9 para Septiembre, etc.)'),
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
          return data as Array<Pick<RawProperty, 'id' | 'name' | 'city' | 'currency'>>;
        } catch {
          return [];
        }
      },
    }),
  };
}

// ==============================================================================
// Main Chat Stream Handler
// ==============================================================================

export async function handleChatStream(body: ChatRequestBody) {
  const baseURL = process.env.CUSTOM_LLM_BASE_URL || 'https://cephei.ai/api/v1';
  const apiKey = process.env.CUSTOM_LLM_API_KEY || '';
  const modelName = process.env.CUSTOM_LLM_MODEL || 'galahad.qwen3.6-35b';

  console.log('[API/CHAT] Invocation config:', {
    hasCustomBaseUrl: Boolean(process.env.CUSTOM_LLM_BASE_URL),
    baseURL,
    hasCustomModel: Boolean(process.env.CUSTOM_LLM_MODEL),
    modelName,
    hasApiKey: Boolean(process.env.CUSTOM_LLM_API_KEY),
    apiKeyPrefix: apiKey ? `${apiKey.slice(0, 6)}...` : '(empty)',
    hasSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
    hasSupabaseKey: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
  });

  const provider = createOpenAICompatible({
    name: 'custom-llm',
    baseURL,
    apiKey,
  });

  const model = provider(modelName);

  const coreMessages = (body.messages || []).map((m) => {
    let textContent = m.content || '';
    if (!textContent && Array.isArray(m.parts)) {
      textContent = m.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text || '')
        .join('');
    }
    return {
      role: m.role,
      content: textContent,
    };
  });

  const systemPrompt = `Eres el Asistente Financiero y de Gestión para Apartment Manager (gestión inmobiliaria de alojamientos turísticos y Airbnb).
Tu rol es responder preguntas de negocio, ingresos, gastos, ocupación y rentabilidad a los administradores y dueños.

REGLAS CRÍTICAS DE PRECISIÓN Y DATOS:
1. SIEMPRE que te pregunten por ingresos, finanzas, cómo nos fue en un mes, ocupación o gastos de un mes específico, DEBES ejecutar la herramienta "getMonthlyFinancials" para ese mes y año. NUNCA inventes números.
2. Si te preguntan por el consolidado de todo el año, balance anual o totales acumulados, ejecuta la herramienta "getAnnualFinancials".
3. Si te preguntan por cuáles propiedades o departamentos tienen, usa la herramienta "getUserProperties".
4. AISLAMIENTO MENSUAL VS ANUAL:
   - Al responder sobre un mes específico (ej: Septiembre 2026), reporta ÚNICAMENTE las cifras de ese mes retornadas por "getMonthlyFinancials".
   - NUNCA mezcles los ingresos o gastos del mes con los totales acumulados del año ni del histórico.
5. DEFINICIONES FINANCIERAS Y CASCADA DE LIQUIDACIÓN:
   - **Total Facturado a Huéspedes (Gross)**: El total cobrado a los huéspedes en plataformas en las reservas del mes (revenue.grossTotal).
   - **Tarifas de Limpieza Cobradas (Aseo)**: Lo cobrado para cubrir el servicio de aseo y lavandería (revenue.cleaningFeeCollected).
   - **Ingreso de Alojamiento (Noches)**: Ingreso de tarifas por noche excluyendo el aseo (revenue.accommodationRevenue).
   - **Comisión de Administración**: La tarifa de gestión cobrada por el administrador (revenue.managementFee).
   - **Pago Neto al Propietario (Owner Payout)**: El monto neto que le queda al dueño por los alojamientos tras comisiones (revenue.ownerPayout).
   - **Gastos Totales del Mes**: Total de facturas operativas del apartamento en ese mes (expenses.total). Cita las principales categorías y sus porcentajes exactos de expenses.categoryPercentages.
   - **Ganancia Neta Oficial (Utilidad Real)**: La Ganancia Neta oficial es SIEMPRE profitability.netProfit (Pago neto al propietario menos gastos totales del mes). NUNCA presentes el beneficio antes de comisión como la ganancia neta. Si es negativa o positiva, explica la relación exacta entre el pago al dueño y los gastos.
   - **Margen de Ganancia**: Usa SIEMPRE el porcentaje oficial provisto en profitability.profitMarginPercent (netProfit / ownerPayout). NUNCA inventes ni recalcules porcentajes manualmente.
   - **Tasa de Ocupación**: Usa SIEMPRE el porcentaje exacto provisto en revenue.occupancyRate (ej: "66.7%", correspondiente a revenue.occupiedNights noches ocupadas de revenue.daysInMonth días).
6. Al presentar cifras numéricas, formatea los montos de forma clara con el signo monetario ($) y separador de miles (ej: $2.926.460 COP).
7. Estructura tus respuestas de forma visual, ejecutiva y ordenada:
   - Resumen del mes (Balance general y Ganancia Neta final con su margen)
   - Desglose de ingresos (Facturación bruta, aseo, comisión admin y pago neto al dueño)
   - Ocupación (Noches ocupadas y Tasa de ocupación)
   - Gastos del mes (Total y principales conceptos con sus %)
   - Conclusión ejecutiva clara y concisa
8. Si no especifican el año, asume el año actual (2026).
9. Sé conciso, profesional y directo.`;

  return streamText({
    model,
    system: systemPrompt,
    messages: coreMessages,
    tools: createFinancialTools(body.activePropertyId),
    stopWhen: isStepCount(5),
  });
}

// ==============================================================================
// Vercel Serverless Handlers
// ==============================================================================

// Diagnostic GET endpoint to verify environment variables in production via browser
export async function GET() {
  const envStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      CUSTOM_LLM_BASE_URL: process.env.CUSTOM_LLM_BASE_URL || '(NOT SET - using default fallback)',
      CUSTOM_LLM_MODEL: process.env.CUSTOM_LLM_MODEL || '(NOT SET - using default fallback)',
      CUSTOM_LLM_API_KEY_CONFIGURED: Boolean(process.env.CUSTOM_LLM_API_KEY),
      VITE_SUPABASE_URL_CONFIGURED: Boolean(process.env.VITE_SUPABASE_URL),
      VITE_SUPABASE_ANON_KEY_CONFIGURED: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
    },
  };

  return new Response(JSON.stringify(envStatus, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// Standard Web Handler for Vercel Serverless Functions
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const result = await handleChatStream(body);
    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error('[API/CHAT] Endpoint error:', error);
    const message = error instanceof Error ? error.message : 'Error al conectar con el servidor LLM.';
    return new Response(
      JSON.stringify({
        error: message,
        env: {
          hasBaseUrl: Boolean(process.env.CUSTOM_LLM_BASE_URL),
          hasModel: Boolean(process.env.CUSTOM_LLM_MODEL),
          hasApiKey: Boolean(process.env.CUSTOM_LLM_API_KEY),
        },
        hint: 'Verifica que CUSTOM_LLM_BASE_URL y CUSTOM_LLM_MODEL en Vercel sean accesibles y respondan.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
