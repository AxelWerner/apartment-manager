import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Receipt,
  Sparkles,
  Camera,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { CurrencyInput } from '@/components/ui/currency-input';
import { uploadMedia } from '@/lib/storage';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import { usePropertyContext } from '@/context/PropertyContext';
import type { Expense, ExpenseCategory, ExpenseType, PaymentStatus, RecurrencePeriod } from '@/types/database';
import { useCreateExpense, useUpdateExpense } from '@/hooks/use-expenses';
import { useBookings } from '@/hooks/use-bookings';
import { CATEGORY_LABELS, getDefaultExpenseDescription, formatCOP } from '@/lib/formatters';
import { scanReceipt, type ReceiptExtractionResult } from '@/lib/ai/receipt-scanner';
import { toast } from 'sonner';

export interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: Expense | null;
  defaultCategory?: ExpenseCategory;
  defaultBillingMonth?: string;
  defaultType?: ExpenseType;
  initialScanTrigger?: boolean;
}

interface ExpenseFormContentProps {
  expenseToEdit?: Expense | null;
  defaultCategory: ExpenseCategory;
  defaultBillingMonth?: string;
  defaultType: ExpenseType;
  initialScanTrigger?: boolean;
  onClose: () => void;
}

function ExpenseFormContent({
  expenseToEdit,
  defaultCategory,
  defaultBillingMonth,
  defaultType,
  initialScanTrigger,
  onClose,
}: ExpenseFormContentProps) {
  const propertyCtx = usePropertyContext();
  const activePropertyId = propertyCtx?.activePropertyId || DEFAULT_PROPERTY_ID;
  const createExpenseMutation = useCreateExpense();
  const updateExpenseMutation = useUpdateExpense();
  const { data: bookings = [] } = useBookings(activePropertyId);

  const initialBillingMonth =
    expenseToEdit?.billing_month ?? defaultBillingMonth ?? new Date().toISOString().substring(0, 7);
  const initialCategory = expenseToEdit?.category ?? defaultCategory;

  const [category, setCategory] = useState<ExpenseCategory>(initialCategory);
  const [expenseType, setExpenseType] = useState<ExpenseType>(
    expenseToEdit?.expense_type ?? defaultType
  );
  const [billingMonth, setBillingMonth] = useState(initialBillingMonth);
  const [description, setDescription] = useState(
    expenseToEdit?.description ?? getDefaultExpenseDescription(initialCategory, initialBillingMonth)
  );
  const [isManualDescription, setIsManualDescription] = useState(Boolean(expenseToEdit?.description));
  const [amount, setAmount] = useState<number>(expenseToEdit?.amount ?? 0);
  const [date, setDate] = useState(
    expenseToEdit?.date ?? new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(expenseToEdit?.due_date ?? '');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    expenseToEdit?.payment_status ?? 'paid'
  );
  const [isRecurring, setIsRecurring] = useState(expenseToEdit?.is_recurring ?? false);
  const [recurrencePeriod, setRecurrencePeriod] = useState<RecurrencePeriod>(
    expenseToEdit?.recurrence_period ?? 'monthly'
  );
  const [linkedBookingId, setLinkedBookingId] = useState<string>(
    expenseToEdit?.linked_booking_id ?? ''
  );
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(expenseToEdit?.invoice_url ?? null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expenseToEdit?.receipt_url ?? null);
  const [notes, setNotes] = useState(expenseToEdit?.notes ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null);
  const [aiExtraction, setAiExtraction] = useState<ReceiptExtractionResult | null>(null);
  const [aiExtractedFields, setAiExtractedFields] = useState<Set<string>>(new Set());

  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Auto-trigger file picker if opened with initialScanTrigger
  useEffect(() => {
    if (initialScanTrigger && !expenseToEdit) {
      const timer = setTimeout(() => {
        scannerInputRef.current?.click();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [initialScanTrigger, expenseToEdit]);

  const suggestedDescription = getDefaultExpenseDescription(category, billingMonth);

  const handleCategoryChange = (newCat: ExpenseCategory) => {
    setCategory(newCat);
    if (!isManualDescription || !description.trim()) {
      setDescription(getDefaultExpenseDescription(newCat, billingMonth));
    }
  };

  const handleBillingMonthChange = (newMonth: string) => {
    setBillingMonth(newMonth);
    if (!isManualDescription || !description.trim()) {
      setDescription(getDefaultExpenseDescription(category, newMonth));
    }
  };

  const handleProcessReceipt = async (file: File) => {
    setIsScanning(true);
    setIsUploading(true);
    try {
      // 1. Subir imagen a storage y 2. Escanearla con AI SDK
      const uploadPromise = uploadMedia(file, 'receipts');
      const scanPromise = scanReceipt({
        file,
        activePropertyId,
      });

      const [uploadedUrl, extraction] = await Promise.all([uploadPromise, scanPromise]);

      setInvoiceUrl(uploadedUrl);
      setAiExtraction(extraction);

      const modifiedFields = new Set<string>();

      if (typeof extraction.amount === 'number' && extraction.amount > 0) {
        setAmount(extraction.amount);
        modifiedFields.add('amount');
      }
      if (extraction.date) {
        setDate(extraction.date);
        modifiedFields.add('date');
      }
      if (extraction.dueDate) {
        setDueDate(extraction.dueDate);
        modifiedFields.add('dueDate');
      }
      if (extraction.billingMonth) {
        setBillingMonth(extraction.billingMonth);
        modifiedFields.add('billingMonth');
      }
      if (extraction.category) {
        setCategory(extraction.category);
        modifiedFields.add('category');
      }
      if (extraction.expenseType) {
        setExpenseType(extraction.expenseType);
        modifiedFields.add('expenseType');
      }
      if (extraction.description) {
        setDescription(extraction.description);
        setIsManualDescription(true);
        modifiedFields.add('description');
      }
      if (extraction.notes) {
        setNotes((prev) => (prev ? `${prev}\n${extraction.notes}` : (extraction.notes ?? '')));
        modifiedFields.add('notes');
      }

      setAiExtractedFields(modifiedFields);
      toast.success(
        `Factura detectada (${extraction.merchant || 'Comprobante'}). Total: ${formatCOP(extraction.amount)} ✨`
      );
    } catch (err: unknown) {
      console.error('Scan receipt error:', err);
      const errMsg =
        err instanceof Error ? err.message : 'No se pudo escanear el comprobante con IA';
      toast.error(errMsg);
    } finally {
      setIsScanning(false);
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleProcessReceipt(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Por favor escribe una descripción del gasto');
      return;
    }
    if (amount <= 0) {
      toast.error('El monto debe ser mayor a $0 COP');
      return;
    }

    try {
      const payload = {
        property_id: expenseToEdit?.property_id || activePropertyId || DEFAULT_PROPERTY_ID,
        category,
        expense_type: expenseType,
        description: description.trim(),
        amount,
        date,
        due_date: dueDate || null,
        billing_month: billingMonth || null,
        payment_status: paymentStatus,
        is_recurring: isRecurring,
        recurrence_period: isRecurring ? recurrencePeriod : null,
        linked_booking_id: linkedBookingId || null,
        invoice_url: invoiceUrl || null,
        receipt_url: receiptUrl || null,
        notes: notes.trim() || null,
      };

      if (expenseToEdit) {
        await updateExpenseMutation.mutateAsync({
          id: expenseToEdit.id,
          updates: payload,
        });
        toast.success('Gasto actualizado');
      } else {
        await createExpenseMutation.mutateAsync(payload);
        toast.success('Gasto registrado con éxito');
      }
      onClose();
    } catch {
      toast.error('Error al guardar el gasto');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* AI Receipt Scanner Dropzone */}
      {!expenseToEdit && (
        <div className="rounded-2xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-gradient-to-r from-amber-500/5 via-rose-500/5 to-indigo-500/5 p-3.5 transition-all">
          <input
            ref={scannerInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />

          {isScanning ? (
            <div className="flex items-center gap-3 py-2 px-1">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 dark:text-amber-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Analizando factura con IA...</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Extrayendo monto total, fecha, emisor y categoría contable
                </p>
              </div>
            </div>
          ) : aiExtraction ? (
            <div className="flex items-center justify-between gap-2 py-1 px-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white truncate">
                    <span>{aiExtraction.merchant || 'Comprobante escaneado'}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      Confianza {aiExtraction.confidence}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Revisa los campos autocompletados a continuación ✨
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => scannerInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shrink-0 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                <span>Cambiar</span>
              </button>
            </div>
          ) : (
            <div
              onClick={() => scannerInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessReceipt(file);
              }}
              className="flex items-center justify-between gap-3 cursor-pointer group py-1"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                    <span>Escanear factura con IA</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                      PDF o Foto
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    Arrastra tu factura en PDF o imagen aquí, o haz clic para subir
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:bg-amber-50 dark:group-hover:bg-amber-950/40 group-hover:border-amber-300 dark:group-hover:border-amber-700 transition-colors">
                <Camera className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Escanear</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category & Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="expense-category-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Categoría *
            </label>
            {aiExtractedFields.has('category') && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            )}
          </div>
          <select
            id="expense-category-select"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as ExpenseCategory)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
          >
            {Object.entries(CATEGORY_LABELS).map(([catKey, { label }]) => (
              <option key={catKey} value={catKey}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="expense-type-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tipo de Gasto
            </label>
            {aiExtractedFields.has('expenseType') && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            )}
          </div>
          <select
            id="expense-type-select"
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value as ExpenseType)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="fixed_monthly">Fijo Mensual (Administración, Internet)</option>
            <option value="utility_monthly">Servicio Público (Luz, Gas, Agua)</option>
            <option value="annual">Póliza Anual (Seguro)</option>
            <option value="per_stay">Por Estadía (Limpieza/Lavandería)</option>
            <option value="occasional">Insumo Ocasional / Reposición</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="expense-description-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Descripción del Gasto *
          </label>
          <div className="flex items-center gap-2">
            {aiExtractedFields.has('description') && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            )}
            {description !== suggestedDescription && (
              <button
                type="button"
                onClick={() => {
                  setDescription(suggestedDescription);
                  setIsManualDescription(false);
                }}
                className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                Usar sugerida: &quot;{suggestedDescription}&quot;
              </button>
            )}
          </div>
        </div>
        <input
          id="expense-description-input"
          type="text"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setIsManualDescription(true);
          }}
          placeholder="Ej: Mantenimiento aire acondicionado, Pago EPM mayo..."
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
        />
      </div>

      {/* Amount & Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="expense-amount-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Monto en COP *
            </label>
            {aiExtractedFields.has('amount') && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            )}
          </div>
          <CurrencyInput
            id="expense-amount-input"
            value={amount}
            onChange={(val) => setAmount(val || 0)}
            placeholder="0"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="expense-date-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fecha del Gasto / Pago *
            </label>
            {aiExtractedFields.has('date') && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            )}
          </div>
          <input
            id="expense-date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Due Date & Billing Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="expense-due-date-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fecha Límite de Pago
            </label>
            {aiExtractedFields.has('dueDate') && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            )}
          </div>
          <input
            id="expense-due-date-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="expense-billing-month-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mes de Facturación
            </label>
            {aiExtractedFields.has('billingMonth') && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            )}
          </div>
          <input
            id="expense-billing-month-input"
            type="month"
            value={billingMonth}
            onChange={(e) => handleBillingMonthChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
          />
        </div>
      </div>

      {/* Payment Status & Recurrence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <div>
          <label htmlFor="expense-payment-status-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Estado de Pago
          </label>
          <select
            id="expense-payment-status-select"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="paid">Pagado</option>
            <option value="pending">Pendiente</option>
            <option value="scheduled">Programado</option>
          </select>
        </div>

        <div className="pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700"
            />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              ¿Es un gasto recurrente?
            </span>
          </label>

          {isRecurring && (
            <div className="mt-2">
              <select
                value={recurrencePeriod}
                onChange={(e) => setRecurrencePeriod(e.target.value as RecurrencePeriod)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                <option value="monthly">Mensual</option>
                <option value="bimonthly">Bimestral</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Linked Booking (Only for cleaning or per_stay) */}
      {(category === 'cleaning_laundry' || expenseType === 'per_stay') && bookings.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Vincular a Reserva (Opcional)
          </label>
          <select
            value={linkedBookingId}
            onChange={(e) => setLinkedBookingId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="">Sin vincular a reserva</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.guest_name} ({b.check_in} al {b.check_out})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Document Attachments: Factura y Comprobante */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Documentos y Soportes (Factura y Comprobante de Pago)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Factura o Cuenta de Cobro */}
          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Factura o Cuenta</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Cobro emitido por la empresa</p>
                </div>
              </div>
            </div>

            {invoiceUrl ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/70 text-xs">
                <span className="truncate font-semibold text-indigo-950 dark:text-indigo-200 text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  Factura adjunta
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc({ url: invoiceUrl, title: 'Factura o Cuenta de Cobro' })}
                    className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                    title="Ver Factura"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {!receiptUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptUrl(invoiceUrl);
                        setInvoiceUrl(null);
                        toast.info('Documento asignado como Comprobante de Pago');
                      }}
                      className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-[11px] font-medium underline px-1 cursor-pointer"
                      title="Mover este archivo a Comprobante de Pago"
                    >
                      Mover a Comprobante
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInvoiceUrl(null)}
                    className="text-slate-400 hover:text-rose-500 text-[11px] font-medium underline px-1 cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  id="expense-invoice-input"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    setIsUploadingInvoice(true);
                    try {
                      const url = await uploadMedia(file, 'receipts');
                      setInvoiceUrl(url);
                      toast.success('Factura subida con éxito');
                    } catch {
                      toast.error('Error al subir la factura');
                    } finally {
                      setIsUploadingInvoice(false);
                    }
                  }}
                />
                <label
                  htmlFor="expense-invoice-input"
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700/80 bg-white dark:bg-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors shadow-2xs"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isUploadingInvoice ? 'Subiendo...' : 'Subir Factura'}</span>
                </label>
              </div>
            )}
          </div>

          {/* Comprobante de Pago */}
          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-800/60">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Comprobante de Pago</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Transferencia, Nequi o PSE</p>
                </div>
              </div>
            </div>

            {receiptUrl ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/70 text-xs">
                <span className="truncate font-semibold text-emerald-950 dark:text-emerald-200 text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Comprobante adjunto
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc({ url: receiptUrl, title: 'Comprobante de Pago' })}
                    className="p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                    title="Ver Comprobante"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {!invoiceUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceUrl(receiptUrl);
                        setReceiptUrl(null);
                        toast.info('Documento asignado como Factura o Cuenta');
                      }}
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] font-medium underline px-1 cursor-pointer"
                      title="Mover este archivo a Factura o Cuenta"
                    >
                      Mover a Factura
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setReceiptUrl(null)}
                    className="text-slate-400 hover:text-rose-500 text-[11px] font-medium underline px-1 cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  id="expense-receipt-input"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    setIsUploadingReceipt(true);
                    try {
                      const url = await uploadMedia(file, 'receipts');
                      setReceiptUrl(url);
                      toast.success('Comprobante subido con éxito');
                    } catch {
                      toast.error('Error al subir el comprobante');
                    } finally {
                      setIsUploadingReceipt(false);
                    }
                  }}
                />
                <label
                  htmlFor="expense-receipt-input"
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700/80 bg-white dark:bg-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 cursor-pointer transition-colors shadow-2xs"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isUploadingReceipt ? 'Subiendo...' : 'Subir Comprobante'}</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Notas u Observaciones
          </label>
          {aiExtractedFields.has('notes') && (
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> IA
            </span>
          )}
        </div>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Detalles adicionales, número de factura..."
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending || isUploading || isScanning || isUploadingInvoice || isUploadingReceipt}
          className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all disabled:opacity-50 cursor-pointer"
        >
          {expenseToEdit ? 'Guardar Cambios' : 'Registrar Gasto'}
        </button>
      </div>

      {/* Quick Document Viewer Modal */}
      {previewDoc && (
        <Modal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          maxWidth="lg"
        >
          <div className="p-2 text-center">
            {previewDoc.url.toLowerCase().includes('.pdf') || previewDoc.url.startsWith('data:application/pdf') ? (
              <iframe
                src={previewDoc.url}
                title={previewDoc.title}
                className="w-full h-[65vh] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
              />
            ) : (
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                className="max-h-[65vh] mx-auto rounded-xl object-contain border border-slate-200 dark:border-slate-700 shadow-md"
              />
            )}
            <div className="mt-3 flex justify-end">
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir en pestaña nueva
              </a>
            </div>
          </div>
        </Modal>
      )}
    </form>
  );
}

export function ExpenseModal({
  isOpen,
  onClose,
  expenseToEdit,
  defaultCategory = 'other',
  defaultBillingMonth,
  defaultType = 'occasional',
  initialScanTrigger = false,
}: ExpenseModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={expenseToEdit ? 'Editar Gasto' : 'Registrar Gasto o Servicio'}
      subtitle="Ingresa el costo, categoría y comprobante en COP"
      maxWidth="xl"
    >
      <ExpenseFormContent
        key={expenseToEdit?.id ?? `new-expense-${defaultCategory}-${defaultBillingMonth}`}
        expenseToEdit={expenseToEdit}
        defaultCategory={defaultCategory}
        defaultBillingMonth={defaultBillingMonth}
        defaultType={defaultType}
        initialScanTrigger={initialScanTrigger}
        onClose={onClose}
      />
    </Modal>
  );
}
