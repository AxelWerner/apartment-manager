import process from 'node:process';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, isStepCount } from 'ai';
import { createFinancialTools } from '../src/lib/ai/financial-tools';

export interface ChatRequestBody {
  messages: Array<{
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    parts?: Array<{ type: string; text?: string }>;
  }>;
  activePropertyId?: string;
}

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

  // Normalize message history
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

export default POST;
