import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { z } from 'zod';
import { extractText } from 'unpdf';

export const ReceiptExtractionSchema = z.object({
  amount: z.number().describe('Monto total a pagar en Pesos Colombianos (COP)'),
  date: z.string().describe('Fecha de emisión o pago en formato YYYY-MM-DD'),
  dueDate: z.string().nullable().optional().describe('Fecha límite de pago (YYYY-MM-DD)'),
  billingMonth: z.string().nullable().optional().describe('Periodo o mes facturado (YYYY-MM)'),
  category: z.enum([
    'electricity',
    'water',
    'gas',
    'hoa_administration',
    'internet_cable',
    'insurance_annual',
    'cleaning_laundry',
    'supplies_restock',
    'maintenance_repairs',
    'platform_fees',
    'other',
  ]),
  expenseType: z.enum(['fixed_monthly', 'utility_monthly', 'annual', 'per_stay', 'occasional']),
  merchant: z.string().describe('Nombre del comercio, empresa o entidad prestadora'),
  description: z.string().describe('Descripción profesional para el sistema'),
  notes: z.string().nullable().optional().describe('Número de factura, contrato o desglose breve'),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type ReceiptExtractionResult = z.infer<typeof ReceiptExtractionSchema>;

export interface ScanReceiptRequestBody {
  image?: string; // base64 data URL (e.g. data:image/jpeg;base64,... or data:application/pdf;base64,...) or remote URL
  file?: string;
  pdfText?: string;
  activePropertyId?: string;
  propertyName?: string;
}

export function isPdfDocument(doc: string): boolean {
  if (!doc || typeof doc !== 'string') return false;
  return (
    doc.startsWith('data:application/pdf') ||
    doc.includes('application/pdf') ||
    doc.toLowerCase().endsWith('.pdf') ||
    doc.toLowerCase().includes('.pdf?')
  );
}

export async function parsePdfContent(doc: string): Promise<{ text?: string; image?: string }> {
  let pdfBuffer: Uint8Array;
  if (doc.startsWith('data:')) {
    const base64Part = doc.split(',')[1] || '';
    pdfBuffer = new Uint8Array(Buffer.from(base64Part, 'base64'));
  } else if (doc.startsWith('http://') || doc.startsWith('https://')) {
    const res = await fetch(doc);
    const arrayBuffer = await res.arrayBuffer();
    pdfBuffer = new Uint8Array(arrayBuffer);
  } else {
    pdfBuffer = new Uint8Array(Buffer.from(doc, 'base64'));
  }

  try {
    const textResult = await extractText(pdfBuffer, { mergePages: true });
    if (textResult.text && textResult.text.trim().length > 10) {
      return { text: textResult.text.trim() };
    }
  } catch (textErr) {
    console.warn('extractText failed or yielded empty result:', textErr);
  }

  throw new Error(
    'No se pudo extraer texto legible de este archivo PDF. Verifica que el documento no esté protegido con contraseña o sube una imagen de la factura.'
  );
}

export function parseAmount(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (typeof val !== 'string') return 0;

  const str = val.trim();
  const clean = str.replace(/[^0-9.,]/g, '');
  if (!clean) return 0;

  // 85,410.00 (comma thousands, dot decimals)
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
    return Math.round(parseFloat(clean.replace(/,/g, '')));
  }
  // 85.410,00 (dot thousands, comma decimals)
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
    return Math.round(parseFloat(clean.replace(/\./g, '').replace(',', '.')));
  }

  const num = parseFloat(clean.replace(',', '.'));
  return isNaN(num) ? 0 : Math.round(num);
}

export function normalizeDate(val: unknown): string {
  if (!val || typeof val !== 'string') {
    return new Date().toISOString().split('T')[0];
  }
  const str = val.trim();
  // DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str.substring(0, 10);
}

export function normalizeBillingMonth(val: unknown): string | null {
  if (!val || typeof val !== 'string') return null;
  const str = val.trim();
  if (/^\d{4}-\d{2}$/.test(str)) return str;

  const monthMap: Record<string, string> = {
    ene: '01',
    feb: '02',
    mar: '03',
    abr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    ago: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dic: '12',
    jan: '01',
    apr: '04',
    aug: '08',
    dec: '12',
  };

  // SEP-2026 or SEP/2026 or SEP 2026
  const matchMonthFirst = str.match(/([a-zA-Z]{3,4})[\s/_+-]+(\d{4})/i);
  if (matchMonthFirst) {
    const key = matchMonthFirst[1].substring(0, 3).toLowerCase();
    const year = matchMonthFirst[2];
    if (monthMap[key]) return `${year}-${monthMap[key]}`;
  }

  // 2026-SEP or 2026/SEP
  const matchYearFirst = str.match(/(\d{4})[\s/_+-]+([a-zA-Z]{3,4})/i);
  if (matchYearFirst) {
    const year = matchYearFirst[1];
    const key = matchYearFirst[2].substring(0, 3).toLowerCase();
    if (monthMap[key]) return `${year}-${monthMap[key]}`;
  }

  return str.substring(0, 7);
}

export function normalizeCategory(val: unknown, merchant = '', desc = ''): ReceiptExtractionResult['category'] {
  const combined = `${val || ''} ${merchant} ${desc}`.toLowerCase();
  if (
    combined.includes('agua') ||
    combined.includes('acueducto') ||
    combined.includes('alcantarillado') ||
    combined.includes('essmar') ||
    combined.includes('water')
  ) {
    return 'water';
  }
  if (
    combined.includes('energia') ||
    combined.includes('energía') ||
    combined.includes('luz') ||
    combined.includes('electric') ||
    combined.includes('epm') ||
    combined.includes('aire')
  ) {
    return 'electricity';
  }
  if (combined.includes('gas') || combined.includes('gases')) {
    return 'gas';
  }
  if (
    combined.includes('admin') ||
    combined.includes('hoa') ||
    combined.includes('copropiedad') ||
    combined.includes('edificio')
  ) {
    return 'hoa_administration';
  }
  if (
    combined.includes('internet') ||
    combined.includes('wifi') ||
    combined.includes('fibra') ||
    combined.includes('claro') ||
    combined.includes('tigo') ||
    combined.includes('movistar')
  ) {
    return 'internet_cable';
  }
  if (
    combined.includes('limpieza') ||
    combined.includes('aseo') ||
    combined.includes('lavander') ||
    combined.includes('clean')
  ) {
    return 'cleaning_laundry';
  }
  if (
    combined.includes('insumo') ||
    combined.includes('supermercado') ||
    combined.includes('exito') ||
    combined.includes('éxito') ||
    combined.includes('carulla') ||
    combined.includes('d1') ||
    combined.includes('ara') ||
    combined.includes('dollarcity') ||
    combined.includes('supplies')
  ) {
    return 'supplies_restock';
  }
  if (
    combined.includes('mantenimiento') ||
    combined.includes('repar') ||
    combined.includes('homecenter') ||
    combined.includes('ferreter') ||
    combined.includes('plomer') ||
    combined.includes('cerraj')
  ) {
    return 'maintenance_repairs';
  }
  if (
    combined.includes('seguro') ||
    combined.includes('poliza') ||
    combined.includes('póliza') ||
    combined.includes('insurance')
  ) {
    return 'insurance_annual';
  }
  if (combined.includes('comision') || combined.includes('comisión') || combined.includes('fee')) {
    return 'platform_fees';
  }
  return 'other';
}

export function normalizeExpenseType(
  val: unknown,
  category: ReceiptExtractionResult['category']
): ReceiptExtractionResult['expenseType'] {
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower.includes('utility') || lower.includes('servicio')) return 'utility_monthly';
    if (lower.includes('fixed') || lower.includes('fijo')) return 'fixed_monthly';
    if (lower.includes('annual') || lower.includes('anual')) return 'annual';
    if (lower.includes('stay') || lower.includes('estadia')) return 'per_stay';
    if (lower.includes('occasional') || lower.includes('ocasional')) return 'occasional';
  }
  if (category === 'water' || category === 'electricity' || category === 'gas') {
    return 'utility_monthly';
  }
  if (category === 'hoa_administration' || category === 'internet_cable') {
    return 'fixed_monthly';
  }
  if (category === 'insurance_annual') {
    return 'annual';
  }
  return 'occasional';
}

export async function processReceiptExtraction(
  body: ScanReceiptRequestBody
): Promise<ReceiptExtractionResult> {
  const baseURL = process.env.CUSTOM_LLM_BASE_URL || 'https://cephei.ai/api/v1';
  const apiKey = process.env.CUSTOM_LLM_API_KEY || '';
  const modelName = process.env.CUSTOM_LLM_VISION_MODEL || 'glm-5.3-flash:cloud';

  const provider = createOpenAICompatible({
    name: 'custom-llm',
    baseURL,
    apiKey,
  });

  const model = provider(modelName);

  const systemPrompt = `Eres un asistente contable de alta precisión para propiedades turísticas y apartamentos en Colombia.
Tu misión es extraer los datos clave de la imagen de la factura o recibo.
Debes responder ÚNICAMENTE con un bloque JSON válido, sin texto adicional, sin introducciones y sin explicaciones.

CAMPOS A EXTRAER:
- amount: número con el "Valor a pagar" o "Total a pagar" (ej: si dice "$ 85,410.00" pon 85410).
- date: fecha de emisión o de expedición en formato YYYY-MM-DD.
- dueDate: fecha límite o "pago oportuno" en formato YYYY-MM-DD.
- billingMonth: mes o periodo facturado en formato YYYY-MM (ej: si dice "SEP-2026" pon "2026-09").
- category: una de las siguientes opciones según el tipo de servicio:
  "water" (agua, acueducto y alcantarillado, ESSMAR, EPM agua),
  "electricity" (energía, luz, EPM, Aire),
  "gas" (gas natural),
  "hoa_administration" (administración edificio),
  "internet_cable" (Claro, Tigo, Movistar),
  "cleaning_laundry" (aseo, lavandería),
  "supplies_restock" (supermercado, insumos),
  "maintenance_repairs" (reparaciones, ferretería),
  "insurance_annual" (seguro),
  "other" (otros).
- expenseType: "utility_monthly", "fixed_monthly", "occasional", "per_stay" o "annual".
- merchant: nombre de la empresa o emisor (ej: "ESSMAR E.S.P.", "EPM", "Éxito").
- description: descripción profesional (ej: "Factura Acueducto y Alcantarillado (ESSMAR) - Septiembre 2026").
- notes: detalles útiles como referencia de pago, número de contrato o suscriptor.
- confidence: "high", "medium" o "low".`;

  const docPayload = body.image || body.file;
  if (!docPayload) {
    throw new Error('Falta el archivo (imagen o PDF) en la petición.');
  }

  let userContent: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>;

  if (isPdfDocument(docPayload)) {
    const parsed = await parsePdfContent(docPayload);
    if (parsed.text) {
      userContent = [
        {
          type: 'text',
          text: `A continuación se encuentra el texto extraído íntegramente del archivo PDF de la factura:
====================
${parsed.text.slice(0, 15000)}
====================
Analiza detenidamente este documento y devuelve ÚNICAMENTE el bloque JSON estructurado con los datos de esta factura:`,
        },
      ];
    } else if (parsed.image) {
      userContent = [
        {
          type: 'text',
          text: 'Analiza la imagen adjunta de esta factura en PDF y devuelve ÚNICAMENTE el JSON estructurado con los datos:',
        },
        {
          type: 'image',
          image: parsed.image,
        },
      ];
    } else {
      throw new Error('No se pudo procesar el contenido del archivo PDF.');
    }
  } else {
    userContent = [
      {
        type: 'text',
        text: 'Analiza la imagen adjunta y devuelve ÚNICAMENTE el JSON estructurado con los datos de esta factura:',
      },
      {
        type: 'image',
        image: docPayload,
      },
    ];
  }

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  let rawText = result.text.trim();

  // Eliminar etiquetas de razonamiento <think>...</think> de modelos como Qwen o DeepSeek
  rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Extraer JSON dentro de bloques markdown ```json ... ``` o entre llaves { ... }
  const jsonMatch =
    rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) ||
    rawText.match(/(\{[\s\S]*\})/);

  const jsonString = jsonMatch ? jsonMatch[1].trim() : rawText;

  let rawParsed: Record<string, unknown>;
  try {
    rawParsed = JSON.parse(jsonString) as Record<string, unknown>;
  } catch (parseError) {
    console.error('Error al parsear JSON del LLM:', rawText);
    throw new Error('El modelo de visión no devolvió un JSON legible: ' + rawText.slice(0, 100), {
      cause: parseError,
    });
  }

  // Sanitización y normalización de campos para que NUNCA falle por variaciones tipográficas
  const amount = parseAmount(rawParsed.amount);
  const date = normalizeDate(rawParsed.date);
  const dueDate = rawParsed.dueDate ? normalizeDate(rawParsed.dueDate) : null;
  const billingMonth = rawParsed.billingMonth ? normalizeBillingMonth(rawParsed.billingMonth) : null;
  const merchant = typeof rawParsed.merchant === 'string' && rawParsed.merchant.trim() ? rawParsed.merchant.trim() : 'Proveedor';
  const category = normalizeCategory(rawParsed.category, merchant, typeof rawParsed.description === 'string' ? rawParsed.description : '');
  const expenseType = normalizeExpenseType(rawParsed.expenseType, category);
  const description =
    typeof rawParsed.description === 'string' && rawParsed.description.trim()
      ? rawParsed.description.trim()
      : `Gasto ${category} - ${merchant}`;
  const notes = typeof rawParsed.notes === 'string' && rawParsed.notes.trim() ? rawParsed.notes.trim() : null;
  const confidence =
    rawParsed.confidence === 'high' || rawParsed.confidence === 'low' ? rawParsed.confidence : 'medium';

  const normalized = {
    amount,
    date,
    dueDate,
    billingMonth,
    category,
    expenseType,
    merchant,
    description,
    notes,
    confidence,
  };

  return ReceiptExtractionSchema.parse(normalized);
}

// Handler para Vercel Serverless Functions
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ScanReceiptRequestBody;
    const docPayload = body?.image || body?.file;
    if (!docPayload) {
      return new Response(
        JSON.stringify({ error: 'Falta la imagen o archivo PDF del comprobante en la petición' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const extraction = await processReceiptExtraction(body);
    return new Response(JSON.stringify(extraction), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Receipt scan error:', error);
    const message =
      error instanceof Error ? error.message : 'Error al procesar el comprobante con IA';
    return new Response(
      JSON.stringify({
        error: message,
        hint: 'Verifica que CUSTOM_LLM_BASE_URL esté activo y el modelo soporte visión.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default POST;
