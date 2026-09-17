import React, { useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { CurrencyInput } from '@/components/ui/currency-input';
import { uploadMedia } from '@/lib/storage';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import type { Expense, ExpenseCategory, ExpenseType, PaymentStatus, RecurrencePeriod } from '@/types/database';
import { useCreateExpense, useUpdateExpense } from '@/hooks/use-expenses';
import { useBookings } from '@/hooks/use-bookings';
import { CATEGORY_LABELS, formatMonthYear } from '@/lib/formatters';
import { toast } from 'sonner';

export function getDefaultExpenseDescription(cat: ExpenseCategory, monthStr?: string | null): string {
  const catInfo = CATEGORY_LABELS[cat];
  const catLabel = catInfo?.label || 'Gasto';
  const monthFormatted = monthStr ? formatMonthYear(monthStr) : '';

  if (!monthFormatted) return catLabel;

  switch (cat) {
    case 'hoa_administration':
      return `Administración Edificio - ${monthFormatted}`;
    case 'electricity':
      return `Factura Energía / Luz (EPM) - ${monthFormatted}`;
    case 'water':
      return `Factura Agua y Alcantarillado (EPM) - ${monthFormatted}`;
    case 'gas':
      return `Factura Gas Natural (EPM) - ${monthFormatted}`;
    case 'internet_cable':
      return `Internet Fibra Óptica - ${monthFormatted}`;
    case 'insurance_annual':
      return `Póliza Seguro Todo Riesgo - ${monthFormatted}`;
    case 'cleaning_laundry':
      return `Limpieza y Lavandería - ${monthFormatted}`;
    case 'supplies_restock':
      return `Insumos y Reposición - ${monthFormatted}`;
    case 'maintenance_repairs':
      return `Mantenimiento y Reparaciones - ${monthFormatted}`;
    case 'platform_fees':
      return `Comisiones y Tasas - ${monthFormatted}`;
    default:
      return `${catLabel} - ${monthFormatted}`;
  }
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: Expense | null;
  defaultCategory?: ExpenseCategory;
  defaultBillingMonth?: string;
  defaultType?: ExpenseType;
}

interface ExpenseFormContentProps {
  expenseToEdit?: Expense | null;
  defaultCategory: ExpenseCategory;
  defaultBillingMonth?: string;
  defaultType: ExpenseType;
  onClose: () => void;
}

function ExpenseFormContent({
  expenseToEdit,
  defaultCategory,
  defaultBillingMonth,
  defaultType,
  onClose,
}: ExpenseFormContentProps) {
  const createExpenseMutation = useCreateExpense();
  const updateExpenseMutation = useUpdateExpense();
  const { data: bookings = [] } = useBookings();

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
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expenseToEdit?.receipt_url ?? null);
  const [notes, setNotes] = useState(expenseToEdit?.notes ?? '');
  const [isUploading, setIsUploading] = useState(false);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadMedia(file, 'receipts');
      setReceiptUrl(url);
      toast.success('Comprobante cargado');
    } catch {
      toast.error('No se pudo subir la foto del comprobante');
    } finally {
      setIsUploading(false);
    }
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
        property_id: DEFAULT_PROPERTY_ID,
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
        receipt_url: receiptUrl,
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
      {/* Category & Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="expense-category-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Categoría *
          </label>
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
          <label htmlFor="expense-type-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tipo de Gasto
          </label>
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
          {description !== suggestedDescription && (
            <button
              type="button"
              onClick={() => {
                setDescription(suggestedDescription);
                setIsManualDescription(false);
              }}
              className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Usar predeterminado: {suggestedDescription}
            </button>
          )}
        </div>
        <input
          id="expense-description-input"
          type="text"
          required
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setIsManualDescription(true);
          }}
          placeholder={suggestedDescription}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
        />
      </div>

      {/* Amount & Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Monto en Pesos ($ COP) *
          </label>
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            placeholder="0"
            className="w-full px-3 py-2 text-sm font-bold text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Fecha del Gasto / Factura *
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Due Date & Billing Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Fecha de Vencimiento (Opcional)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Mes Contable (Ciclo)
          </label>
          <input
            type="month"
            value={billingMonth}
            onChange={(e) => handleBillingMonthChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Payment Status & Linked Booking */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Estado del Pago
          </label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="paid">Pagado</option>
            <option value="pending">Pendiente por Pagar</option>
            <option value="scheduled">Programado en Débito</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Vincular a Reserva (Opcional)
          </label>
          <select
            value={linkedBookingId}
            onChange={(e) => setLinkedBookingId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="">Ninguna (Gasto general del apto)</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.guest_name} ({b.check_in})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Recurring Cost Toggle */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="w-4 h-4 rounded-sm text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700"
          />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Es un gasto recurrente (se repite periódicamente)
          </span>
        </label>

        {isRecurring && (
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Frecuencia de Repetición
            </label>
            <select
              value={recurrencePeriod}
              onChange={(e) => setRecurrencePeriod(e.target.value as RecurrencePeriod)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              <option value="monthly">Mensual</option>
              <option value="bimonthly">Bimestral</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
        )}
      </div>

      {/* Receipt Upload */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Foto del Recibo o Factura (Móvil / Computadora)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*,.pdf"
            capture="environment"
            id="expense-receipt-input"
            className="hidden"
            onChange={handleFileUpload}
          />
          <label
            htmlFor="expense-receipt-input"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-rose-500" />
            <span>{isUploading ? 'Subiendo...' : 'Cargar Comprobante'}</span>
          </label>

          {receiptUrl && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <FileText className="w-4 h-4" />
              <span>Comprobante adjunto</span>
              <button
                type="button"
                onClick={() => setReceiptUrl(null)}
                className="text-slate-400 hover:text-rose-500 text-[11px] underline ml-1"
              >
                Quitar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Notas u Observaciones
        </label>
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
          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending || isUploading}
          className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
        >
          {expenseToEdit ? 'Guardar Cambios' : 'Registrar Gasto'}
        </button>
      </div>
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
        onClose={onClose}
      />
    </Modal>
  );
}
