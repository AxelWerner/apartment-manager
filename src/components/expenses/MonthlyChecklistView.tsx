import React, { useState } from 'react';
import {
  Building2,
  Zap,
  Droplets,
  Flame,
  Wifi,
  CheckCircle2,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { formatCOP, formatMonthYear, formatDate, getColombiaDateTime } from '@/lib/formatters';
import type { Expense, ExpenseCategory } from '@/types/database';
import { useExpenses, useUpdateExpense } from '@/hooks/use-expenses';
import { ExpenseModal } from './ExpenseModal';
import { toast } from 'sonner';

interface MonthlyChecklistViewProps {
  onViewReceipt: (url: string) => void;
}

const BILL_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; category: ExpenseCategory; defaultAmount: number }
> = {
  hoa_administration: { label: 'Administración', icon: Building2, category: 'hoa_administration', defaultAmount: 380000 },
  internet_cable: { label: 'Internet y TV', icon: Wifi, category: 'internet_cable', defaultAmount: 125000 },
  electricity: { label: 'Energía / Luz (EPM)', icon: Zap, category: 'electricity', defaultAmount: 290000 },
  water: { label: 'Agua / Acueducto (EPM)', icon: Droplets, category: 'water', defaultAmount: 110000 },
  gas: { label: 'Gas Natural (EPM)', icon: Flame, category: 'gas', defaultAmount: 35000 },
};

export function MonthlyChecklistView({ onViewReceipt }: MonthlyChecklistViewProps) {
  const { data: expenses = [] } = useExpenses();
  const updateExpenseMutation = useUpdateExpense();

  // Current month state 'YYYY-MM' (Colombia timezone)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => getColombiaDateTime().dateStr.substring(0, 7)
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ExpenseCategory>('hoa_administration');
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Navigate between months (timezone-agnostic pure arithmetic)
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    if (month === 1) {
      setSelectedMonth(`${year - 1}-12`);
    } else {
      setSelectedMonth(`${year}-${String(month - 1).padStart(2, '0')}`);
    }
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    if (month === 12) {
      setSelectedMonth(`${year + 1}-01`);
    } else {
      setSelectedMonth(`${year}-${String(month + 1).padStart(2, '0')}`);
    }
  };

  // Get expenses logged for this month
  const monthExpenses = expenses.filter((e) => e.billing_month === selectedMonth);

  // Quick toggle payment status
  const handleTogglePaid = async (exp: Expense) => {
    const nextStatus = exp.payment_status === 'paid' ? 'pending' : 'paid';
    try {
      await updateExpenseMutation.mutateAsync({
        id: exp.id,
        updates: { payment_status: nextStatus },
      });
      toast.success(nextStatus === 'paid' ? 'Marcado como pagado' : 'Marcado como pendiente');
    } catch {
      toast.error('Error al actualizar estado');
    }
  };

  // Standard items in checklist
  const checklistItems = [
    'hoa_administration',
    'internet_cable',
    'electricity',
    'water',
    'gas',
  ];

  const totalMonthlyBilled = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalMonthlyPaid = monthExpenses
    .filter((e) => e.payment_status === 'paid')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Month Navigator Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Planilla Mensual de Costos Fijos y Servicios
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Seguimiento de facturas de Administración, EPM e Internet para cada ciclo mensual
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-3 min-w-[130px] text-center">
            {formatMonthYear(selectedMonth)}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Mes siguiente"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Monthly Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Facturado en el Mes</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {formatCOP(totalMonthlyBilled)} COP
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {monthExpenses.length} facturas registradas
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Ya Pagado</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCOP(totalMonthlyPaid)} COP
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-rose-500">
              Pendiente: {formatCOP(totalMonthlyBilled - totalMonthlyPaid)}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Checklist Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checklistItems.map((catKey) => {
          const config = BILL_CONFIG[catKey];
          const Icon = config.icon;

          // Find if an expense for this category already exists in this billing month
          const existing = monthExpenses.find((e) => e.category === config.category);

          const isPaid = existing?.payment_status === 'paid';
          const isPending = existing && existing.payment_status !== 'paid';

          return (
            <div
              key={catKey}
              className={`p-5 rounded-2xl border transition-all duration-150 flex flex-col justify-between ${
                isPaid
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                  : isPending
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-xs'
                  : 'bg-slate-50/80 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                          : isPending
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {config.label}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {catKey === 'hoa_administration' || catKey === 'internet_cable'
                          ? 'Monto Fijo Mensual'
                          : 'Consumo Variable Mensual'}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Pagado
                    </span>
                  ) : isPending ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      Pendiente
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      Sin registrar
                    </span>
                  )}
                </div>

                {/* Amount & Due Date */}
                <div className="my-3 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500">Valor Factura:</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {existing ? formatCOP(existing.amount) : formatCOP(config.defaultAmount) + ' (Est.)'}
                    </span>
                  </div>

                  {existing?.due_date && (
                    <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span>Vence:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatDate(existing.due_date)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Bottom Bar */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {existing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTogglePaid(existing)}
                      className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-xl border transition-colors ${
                        isPaid
                          ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                      }`}
                    >
                      {isPaid ? 'Cambiar a Pendiente' : 'Marcar Pagado'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExpenseToEdit(existing);
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      title="Editar"
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>

                    {existing.receipt_url && (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(existing.receipt_url!)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600"
                        title="Ver Comprobante"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseToEdit(null);
                      setActiveCategory(config.category);
                      setModalOpen(true);
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registrar Factura {config.label}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <ExpenseModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setExpenseToEdit(null);
        }}
        expenseToEdit={expenseToEdit}
        defaultCategory={activeCategory}
        defaultBillingMonth={selectedMonth}
        defaultType={
          activeCategory === 'hoa_administration' || activeCategory === 'internet_cable'
            ? 'fixed_monthly'
            : 'utility_monthly'
        }
      />
    </div>
  );
}
