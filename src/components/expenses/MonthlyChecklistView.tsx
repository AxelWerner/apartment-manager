import React, { useState, useMemo } from 'react';
import {
  Building2,
  Zap,
  Droplets,
  Flame,
  Wifi,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wrench,
  CreditCard,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Edit2,
  Trash2,
  Info,
} from 'lucide-react';
import { formatCOP, formatMonthYear, formatDate, getColombiaDateTime, CATEGORY_LABELS } from '@/lib/formatters';
import type { Expense, ExpenseCategory, ExpenseType } from '@/types/database';
import { useExpenses, useUpdateExpense, useDeleteExpense } from '@/hooks/use-expenses';
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

const CHECKLIST_ITEMS: ExpenseCategory[] = [
  'hoa_administration',
  'internet_cable',
  'electricity',
  'water',
  'gas',
];

function getCategoryIcon(cat: ExpenseCategory): React.ComponentType<{ className?: string }> {
  switch (cat) {
    case 'hoa_administration':
      return Building2;
    case 'electricity':
      return Zap;
    case 'water':
      return Droplets;
    case 'gas':
      return Flame;
    case 'internet_cable':
      return Wifi;
    case 'insurance_annual':
      return ShieldCheck;
    case 'cleaning_laundry':
      return Sparkles;
    case 'supplies_restock':
      return ShoppingBag;
    case 'maintenance_repairs':
      return Wrench;
    case 'platform_fees':
      return CreditCard;
    default:
      return MoreHorizontal;
  }
}

export function MonthlyChecklistView({ onViewReceipt }: MonthlyChecklistViewProps) {
  const { data: expenses = [] } = useExpenses();
  const updateExpenseMutation = useUpdateExpense();
  const deleteExpenseMutation = useDeleteExpense();

  // Current month state 'YYYY-MM' (Colombia timezone)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => getColombiaDateTime().dateStr.substring(0, 7)
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ExpenseCategory>('hoa_administration');
  const [activeType, setActiveType] = useState<ExpenseType>('fixed_monthly');
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Navigate between months
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
  const monthExpenses = useMemo(() => {
    return expenses.filter(
      (e) =>
        e.billing_month === selectedMonth ||
        (!e.billing_month && e.date.startsWith(selectedMonth))
    );
  }, [expenses, selectedMonth]);

  // Annual Insurance logic for this month
  const activeAnnualPolicy = useMemo(() => {
    const insuranceList = expenses
      .filter((e) => e.category === 'insurance_annual' || e.expense_type === 'annual')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return insuranceList[0] as Expense | undefined;
  }, [expenses]);

  const insurancePaymentMonth = activeAnnualPolicy
    ? (activeAnnualPolicy.billing_month || activeAnnualPolicy.date.substring(0, 7))
    : null;

  const isInsurancePaymentMonth = Boolean(activeAnnualPolicy && insurancePaymentMonth === selectedMonth);

  const isInsuranceCoveredMonth = useMemo(() => {
    if (!activeAnnualPolicy || !insurancePaymentMonth) return false;
    const [pYear, pM] = insurancePaymentMonth.split('-').map(Number);
    const [sYear, sM] = selectedMonth.split('-').map(Number);
    const diffMonths = (sYear - pYear) * 12 + (sM - pM);
    // Covered for 12 months (month 0 to 11)
    return diffMonths >= 0 && diffMonths < 12;
  }, [activeAnnualPolicy, insurancePaymentMonth, selectedMonth]);

  const monthlyAmortizedInsurance = activeAnnualPolicy
    ? Math.round(Number(activeAnnualPolicy.amount) / 12)
    : 0;

  // Additional / Occasional / Variable expenses logged in this month
  const additionalExpenses = useMemo(() => {
    return monthExpenses.filter(
      (e) =>
        !CHECKLIST_ITEMS.includes(e.category) &&
        e.category !== 'insurance_annual' &&
        e.expense_type !== 'annual'
    );
  }, [monthExpenses]);

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

  const handleDeleteExpense = async (id: string, description: string) => {
    if (confirm(`¿Estás seguro de eliminar el gasto "${description}"?`)) {
      try {
        await deleteExpenseMutation.mutateAsync(id);
        toast.success('Gasto eliminado');
      } catch {
        toast.error('No se pudo eliminar el gasto');
      }
    }
  };

  // Financial aggregates for this month
  const totalMonthlyBilled = useMemo(() => {
    return monthExpenses.reduce((sum, e) => {
      // If it's the annual insurance, only sum it in the actual payment month
      if (e.category === 'insurance_annual' || e.expense_type === 'annual') {
        return sum + (isInsurancePaymentMonth ? Number(e.amount) || 0 : 0);
      }
      return sum + (Number(e.amount) || 0);
    }, 0);
  }, [monthExpenses, isInsurancePaymentMonth]);

  const totalMonthlyPaid = useMemo(() => {
    return monthExpenses
      .filter((e) => e.payment_status === 'paid')
      .reduce((sum, e) => {
        if (e.category === 'insurance_annual' || e.expense_type === 'annual') {
          return sum + (isInsurancePaymentMonth ? Number(e.amount) || 0 : 0);
        }
        return sum + (Number(e.amount) || 0);
      }, 0);
  }, [monthExpenses, isInsurancePaymentMonth]);

  return (
    <div className="space-y-6">
      {/* Month Navigator Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Planilla Mensual de Costos y Servicios
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Seguimiento de facturas de Administración, EPM, Seguro Anual, Insumos y Gastos del ciclo mensual
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
            <p className="text-xs font-semibold text-slate-500">Total Operativo del Mes</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {formatCOP(totalMonthlyBilled)} COP
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {monthExpenses.length} movimientos registrados
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Pagado / Cubierto</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCOP(totalMonthlyPaid)} COP
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-rose-500">
              Pendiente: {formatCOP(Math.max(0, totalMonthlyBilled - totalMonthlyPaid))}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Standard Recurring Utilities, HOA & Annual Insurance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Costos Fijos, Servicios Públicos y Seguro Anual
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHECKLIST_ITEMS.map((catKey) => {
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
                          setActiveCategory(config.category);
                          setActiveType(
                            config.category === 'hoa_administration' || config.category === 'internet_cable'
                              ? 'fixed_monthly'
                              : 'utility_monthly'
                          );
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
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
                        setActiveType(
                          config.category === 'hoa_administration' || config.category === 'internet_cable'
                            ? 'fixed_monthly'
                            : 'utility_monthly'
                        );
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

          {/* Card 6: Seguro Anual Card */}
          {activeAnnualPolicy && isInsurancePaymentMonth ? (
            // A. Month in which the policy was paid
            <div className="p-5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        Seguro Todo Riesgo
                      </h3>
                      <p className="text-[11px] text-slate-400">Póliza Anual (Mes de Pago)</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    {activeAnnualPolicy.payment_status === 'paid' ? 'Pagado Anual' : 'Pendiente'}
                  </span>
                </div>

                <div className="my-3 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500">Prima Anual Pagada:</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {formatCOP(activeAnnualPolicy.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span>Impacto Mensual:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {formatCOP(monthlyAmortizedInsurance)} / mes
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setExpenseToEdit(activeAnnualPolicy);
                    setActiveCategory('insurance_annual');
                    setActiveType('annual');
                    setModalOpen(true);
                  }}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Editar Póliza Anual
                </button>
                {activeAnnualPolicy.receipt_url && (
                  <button
                    type="button"
                    onClick={() => onViewReceipt(activeAnnualPolicy.receipt_url!)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600"
                    title="Ver Carátula de Póliza"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : activeAnnualPolicy && isInsuranceCoveredMonth ? (
            // B. Month is covered by the annual policy (Disabled / Protected appearance)
            <div className="p-5 rounded-2xl border bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 flex flex-col justify-between opacity-90 transition-opacity hover:opacity-100">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">
                        Seguro Todo Riesgo
                      </h3>
                      <p className="text-[11px] text-slate-400">Póliza Anual (Cobertura Vigente)</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                    <ShieldCheck className="w-3 h-3" />
                    Cubierto este mes
                  </span>
                </div>

                <div className="my-3 py-2 px-3 rounded-xl bg-white/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500">Costo en este mes:</span>
                    <span className="text-base font-bold text-slate-700 dark:text-slate-300">
                      {formatCOP(0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                    <span>Póliza Anual Pagada:</span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {formatCOP(activeAnnualPolicy.amount)} (Pagado en {formatMonthYear(insurancePaymentMonth)})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Seguro anual cubierto este mes
                </span>
                {activeAnnualPolicy.receipt_url && (
                  <button
                    type="button"
                    onClick={() => onViewReceipt(activeAnnualPolicy.receipt_url!)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Ver Póliza"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            // C. No active annual insurance policy registered or expired
            <div className="p-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        Seguro Todo Riesgo
                      </h3>
                      <p className="text-[11px] text-slate-400">Póliza Anual</p>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    Sin registrar
                  </span>
                </div>

                <div className="my-3 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500">Prima Estimada:</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {formatCOP(334687)} (Est.)
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setExpenseToEdit(null);
                    setActiveCategory('insurance_annual');
                    setActiveType('annual');
                    setModalOpen(true);
                  }}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Seguro Anual</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Additional & Occasional Expenses Logged this Month */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-rose-500" />
              Gastos Variables, Insumos y Servicios Adicionales ({formatMonthYear(selectedMonth)})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reposición de insumos, limpiezas por estadía, mantenimientos y compras registradas en este mes
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setExpenseToEdit(null);
              setActiveCategory('supplies_restock');
              setActiveType('occasional');
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 transition-colors w-fit shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Gasto Adicional</span>
          </button>
        </div>

        {additionalExpenses.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-1">
            <Info className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 mb-1.5" />
            <p className="font-medium text-slate-600 dark:text-slate-400">
              No hay compras de insumos, limpiezas ni reparaciones registradas en {formatMonthYear(selectedMonth)}.
            </p>
            <p className="text-[11px] text-slate-400">
              Puedes agregar insumos de supermercado o pagos de aseo con el botón &quot;Registrar Gasto Adicional&quot;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {additionalExpenses.map((exp) => {
              const catInfo = CATEGORY_LABELS[exp.category] || { label: exp.category };
              const Icon = getCategoryIcon(exp.category);
              const isPaid = exp.payment_status === 'paid';

              return (
                <div
                  key={exp.id}
                  className={`p-5 rounded-2xl border transition-all duration-150 flex flex-col justify-between ${
                    isPaid
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                      : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {catInfo.label}
                          </span>
                        </div>
                      </div>

                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {exp.description}
                    </p>

                    {exp.linked_booking_id && (
                      <span className="inline-block mt-1 text-[10px] text-slate-400 font-medium">
                        Vinculado a reserva de huésped
                      </span>
                    )}

                    <div className="my-2.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                      <span className="text-[11px] text-slate-500">Monto:</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatCOP(exp.amount)}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 mb-2">
                      Fecha: {formatDate(exp.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTogglePaid(exp)}
                      className={`flex-1 py-1 px-2.5 text-xs font-semibold rounded-xl border transition-colors ${
                        isPaid
                          ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                      }`}
                    >
                      {isPaid ? 'Cambiar a Pendiente' : 'Marcar Pagado'}
                    </button>

                    {exp.receipt_url && (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(exp.receipt_url!)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600"
                        title="Ver Recibo"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setExpenseToEdit(exp);
                        setActiveCategory(exp.category);
                        setActiveType(exp.expense_type);
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id, exp.description)}
                      className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setExpenseToEdit(null);
        }}
        expenseToEdit={expenseToEdit}
        defaultCategory={activeCategory}
        defaultBillingMonth={selectedMonth}
        defaultType={activeType}
      />
    </div>
  );
}
