import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanReceipt, fileToDataUrl } from './receipt-scanner';

describe('fileToDataUrl', () => {
  it('converts a Blob / File to a data URL', async () => {
    const file = new File(['dummy invoice content'], 'invoice.jpg', { type: 'image/jpeg' });
    const dataUrl = await fileToDataUrl(file);
    expect(dataUrl).toContain('data:image/jpeg;base64,');
  });
});

describe('scanReceipt client service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws an error if neither file nor imageUrl is provided', async () => {
    await expect(scanReceipt({})).rejects.toThrow('Debes proporcionar un archivo (imagen o PDF) o una URL de comprobante.');
  });

  it('calls /api/scan-receipt with correct payload and returns extracted data', async () => {
    const mockExtraction = {
      amount: 145000,
      date: '2026-05-10',
      dueDate: '2026-05-22',
      billingMonth: '2026-05',
      category: 'electricity',
      expenseType: 'utility_monthly',
      merchant: 'EPM',
      description: 'Servicios Públicos EPM - Mayo 2026',
      notes: 'Contrato 123456',
      confidence: 'high',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExtraction,
    });

    const result = await scanReceipt({
      imageUrl: 'data:image/jpeg;base64,samplebase64',
      activePropertyId: 'prop-123',
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/scan-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: 'data:image/jpeg;base64,samplebase64',
        file: 'data:image/jpeg;base64,samplebase64',
        activePropertyId: 'prop-123',
        propertyName: undefined,
      }),
    });

    expect(result).toEqual(mockExtraction);
  });

  it('supports scanning PDF files and sends them to /api/scan-receipt', async () => {
    const mockExtraction = {
      amount: 85000,
      date: '2026-05-10',
      dueDate: '2026-05-20',
      billingMonth: '2026-05',
      category: 'water',
      expenseType: 'utility_monthly',
      merchant: 'ESSMAR E.S.P.',
      description: 'Factura Acueducto - Mayo 2026',
      notes: 'Referencia 123',
      confidence: 'high',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExtraction,
    });

    const pdfFile = new File(['fake pdf bytes'], 'factura-epm.pdf', { type: 'application/pdf' });
    const result = await scanReceipt({
      file: pdfFile,
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/scan-receipt', expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toEqual(mockExtraction);
  });

  it('throws custom error when API returns non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Error del modelo LLM de visión' }),
    });

    await expect(
      scanReceipt({
        imageUrl: 'data:image/jpeg;base64,samplebase64',
      })
    ).rejects.toThrow('Error del modelo LLM de visión');
  });
});
