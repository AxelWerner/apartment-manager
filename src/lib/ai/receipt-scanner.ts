import type { ReceiptExtractionResult } from '../../../api/scan-receipt';

export type { ReceiptExtractionResult };

export interface ScanReceiptOptions {
  file?: File;
  imageUrl?: string;
  pdfUrl?: string;
  activePropertyId?: string;
  propertyName?: string;
}

/**
 * Convierte un archivo a Data URL (base64)
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo convertir el archivo a cadena base64.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Envía la factura o comprobante (imagen o PDF) al endpoint /api/scan-receipt
 * para extraer montos, fechas, categorías y conceptos automáticamente vía AI SDK.
 */
export async function scanReceipt(
  options: ScanReceiptOptions
): Promise<ReceiptExtractionResult> {
  let docPayload = options.imageUrl || options.pdfUrl;

  if (options.file) {
    docPayload = await fileToDataUrl(options.file);
  }

  if (!docPayload) {
    throw new Error('Debes proporcionar un archivo (imagen o PDF) o una URL de comprobante.');
  }

  const response = await fetch('/api/scan-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: docPayload,
      file: docPayload,
      activePropertyId: options.activePropertyId,
      propertyName: options.propertyName,
    }),
  });

  if (!response.ok) {
    let errorMsg = 'Error al escanear el comprobante con IA';
    try {
      const errorData = (await response.json()) as { error?: string; hint?: string };
      if (errorData.error) {
        errorMsg = errorData.error;
      }
    } catch {
      // Ignorar fallback
    }
    throw new Error(errorMsg);
  }

  const result = (await response.json()) as ReceiptExtractionResult;
  return result;
}
