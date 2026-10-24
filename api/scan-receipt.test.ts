import { describe, it, expect } from 'vitest';
import {
  ReceiptExtractionSchema,
  parseAmount,
  normalizeDate,
  normalizeBillingMonth,
  normalizeCategory,
  normalizeExpenseType,
  isPdfDocument,
  parsePdfContent,
  POST,
} from './scan-receipt';

describe('Receipt Normalizers (ESSMAR / Colombia bills)', () => {
  it('parses Colombian currency formats correctly', () => {
    expect(parseAmount('$ 85,410.00')).toBe(85410);
    expect(parseAmount('$ 85.410,00')).toBe(85410);
    expect(parseAmount('85410')).toBe(85410);
    expect(parseAmount(85410)).toBe(85410);
  });

  it('normalizes Colombian date format DD/MM/YYYY to ISO YYYY-MM-DD', () => {
    expect(normalizeDate('12/10/2026')).toBe('2026-10-12');
    expect(normalizeDate('02/10/2026')).toBe('2026-10-02');
    expect(normalizeDate('2026-10-12')).toBe('2026-10-12');
  });

  it('normalizes Spanish month billing periods like SEP-2026 to YYYY-MM', () => {
    expect(normalizeBillingMonth('SEP-2026')).toBe('2026-09');
    expect(normalizeBillingMonth('oct-2026')).toBe('2026-10');
    expect(normalizeBillingMonth('2026-09')).toBe('2026-09');
  });

  it('detects water category for ESSMAR acueducto y alcantarillado', () => {
    expect(normalizeCategory('acueducto y alcantarillado', 'ESSMAR E.S.P.')).toBe('water');
    expect(normalizeCategory('luz', 'EPM')).toBe('electricity');
    expect(normalizeCategory('gas')).toBe('gas');
    expect(normalizeCategory('cuota administracion')).toBe('hoa_administration');
  });

  it('assigns utility_monthly expense type for water bills', () => {
    expect(normalizeExpenseType('servicio publico', 'water')).toBe('utility_monthly');
    expect(normalizeExpenseType(undefined, 'water')).toBe('utility_monthly');
  });
});

describe('PDF Document Detection & Text Extraction', () => {
  it('correctly identifies PDF payloads', () => {
    expect(isPdfDocument('data:application/pdf;base64,JVBERi0...')).toBe(true);
    expect(isPdfDocument('https://example.com/factura-epm.pdf')).toBe(true);
    expect(isPdfDocument('https://example.com/factura-epm.pdf?token=123')).toBe(true);
    expect(isPdfDocument('data:image/jpeg;base64,...')).toBe(false);
    expect(isPdfDocument('https://example.com/foto.jpg')).toBe(false);
  });

  it('extracts readable text from a valid PDF data URL', async () => {
    const samplePdf =
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 72 >>\nstream\nBT /F1 12 Tf 100 700 Td (EMPRESAS PUBLICAS DE MEDELLIN EPM Factura Total 185000 COP) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n335\n%%EOF';
    const base64Data = Buffer.from(samplePdf).toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Data}`;

    const parsed = await parsePdfContent(dataUrl);
    expect(parsed.text).toBeDefined();
    expect(parsed.text).toContain('EMPRESAS PUBLICAS DE MEDELLIN');
    expect(parsed.text).toContain('185000');
  });
});

describe('ReceiptExtractionSchema', () => {
  it('validates a correct receipt extraction object', () => {
    const validData = {
      amount: 85410,
      date: '2026-10-02',
      dueDate: '2026-10-12',
      billingMonth: '2026-09',
      category: 'water',
      expenseType: 'utility_monthly',
      merchant: 'ESSMAR E.S.P.',
      description: 'Factura Acueducto y Alcantarillado (ESSMAR) - Septiembre 2026',
      notes: 'Referencia de pago: 8255566. Suscriptor: 733187',
      confidence: 'high',
    };

    const parsed = ReceiptExtractionSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(85410);
      expect(parsed.data.category).toBe('water');
    }
  });
});

describe('POST /api/scan-receipt handler', () => {
  it('returns 400 when image or file is missing from request body', async () => {
    const req = new Request('http://localhost/api/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Falta la imagen o archivo PDF');
  });
});
