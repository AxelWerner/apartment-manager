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
  const baseURL = process.env.CUSTOM_LLM_BASE_URL || 'http://127.0.0.1:11434/v1';
  const apiKey = process.env.CUSTOM_LLM_API_KEY || '';
  const modelName = process.env.CUSTOM_LLM_MODEL || 'qwen3.8:27b';

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

REGLAS CRÍTICAS:
1. SIEMPRE que te pregunten por ingresos, finanzas, cómo nos fue en un mes, ocupación o gastos, DEBES ejecutar la herramienta "getMonthlyFinancials". NUNCA inventes números.
2. Si te preguntan por cuáles propiedades o departamentos tienen, usa la herramienta "getUserProperties".
3. Al presentar cifras numéricas, formatea los montos de forma clara con el signo monetario correspondiente ($).
4. Estructura tus respuestas de forma visual y ejecutiva:
   - Resumen del mes (Balance general)
   - Ingresos y tasa de ocupación
   - Gastos totales y principales conceptos
   - Beneficio Neto (Utilidad) y Margen
5. Si no especifican el año, asume el año actual (2026).
6. Sé conciso, profesional y directo.`;

  return streamText({
    model,
    system: systemPrompt,
    messages: coreMessages,
    tools: createFinancialTools(body.activePropertyId),
    stopWhen: isStepCount(5),
  });
}

// Standard Web Handler for Vercel Serverless Functions
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const result = await handleChatStream(body);
    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error('Chat endpoint error:', error);
    const message = error instanceof Error ? error.message : 'Error al conectar con el servidor LLM.';
    return new Response(
      JSON.stringify({
        error: message,
        hint: 'Verifica que CUSTOM_LLM_BASE_URL en tu .env.local sea accesible y esté respondiendo.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export default POST;
