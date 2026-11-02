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
  FileText,
  Receipt,
  Calendar,
  History,
} from 'lucide-react';
import { formatCOP, formatMonthYear, formatDate, getColombiaDateTime, CATEGORY_LABELS } from '@/lib/formatters';
import type { Expense, ExpenseCategory, ExpenseType } from '@/types/database';
import { useExpenses, useUpdateExpense, useDeleteExpense, useRecurringTemplates } from '@/hooks/use-expenses';
import { usePropertyContext } from '@/context/PropertyContext';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import { calculateApartmentDailyCosts } from '@/lib/daily-costs';
import { DailyCostCards } from './DailyCostCards';
import { ExpenseModal } from './ExpenseModal';
import { toast } from 'sonner';

interface MonthlyChecklistViewProps {
  onViewReceipt: (url: string, title?: string) => void;
  initialMonth?: string;
}

interface BillDefinition {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: ExpenseCategory;
  defaultAmount: number;
  typicalDueDay: number;
  isVariable: boolean;
  provider: string;
}

const BILL_CONFIG: Record<string, BillDefinition> = {
  hoa_administration: {
    label: 'Administración',
    icon: Building2,
    category: 'hoa_administration',
    defaultAmount: 380000,
    typicalDueDay: 5,
    isVariable: false,
    provider: 'Edificio / Portería',
  },
  water: {
    label: 'Agua / Acueducto (EPM)',
    icon: Droplets,
    category: 'water',
    defaultAmount: 110000,
    typicalDueDay: 10,
    isVariable: true,
    provider: 'EPM',
  },
  internet_cable: {
    label: 'Internet y TV / Teléfono',
    icon: Wifi,
    category: 'internet_cable',
    defaultAmount: 125000,
    typicalDueDay: 15,
    isVariable: false,
    provider: 'Tigo / Claro Fibra',
  },
  gas: {
    label: 'Gas Natural (EPM)',
    icon: Flame,
    category: 'gas',
    defaultAmount: 35000,
    typicalDueDay: 24,
    isVariable: true,
    provider: 'EPM',
  },
  electricity: {
    label: 'Energía / Luz (EPM)',
    icon: Zap,
    category: 'electricity',
    defaultAmount: 290000,
    typicalDueDay: 25,
    isVariable: true,
    provider: 'EPM',
  },
};

const CHECKLIST_ITEMS: ExpenseCategory[] = [
  'hoa_administration',
  'internet_cable',
  'electricity',
  'water',
  'gas',
];

/**
 * Computes an intelligent historical estimate for a service in selectedMonth:
 * 1. Averages up to 3 most recent logged expenses in previous months.
 * 2. Falls back to template or standard default amount if no history exists.
 */
function getServiceEstimate(
  category: ExpenseCategory,
  selectedMonth: string,
  allExpenses: Expense[],
  fallbackAmount: number
): { amount: number; isHistoricalAvg: boolean; samplesCount: number } {
  const pastEntries = allExpenses
    .filter((e) => {
      if (e.category !== category) return false;
      const month = e.billing_month || e.date.substring(0, 7);
      return month < selectedMonth && Number(e.amount) > 0;
    })
    .sort((a, b) => {
      const monthA = a.billing_month || a.date.substring(0, 7);
      const monthB = b.billing_month || b.date.substring(0, 7);
      return monthB.localeCompare(monthA);
    })
    .slice(0, 3);

  if (pastEntries.length > 0) {
    const sum = pastEntries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    return {
      amount: Math.round(sum / pastEntries.length),
      isHistoricalAvg: true,
      samplesCount: pastEntries.length,
    };
  }

  return {
    amount: fallbackAmount,
    isHistoricalAvg: false,
    samplesCount: 0,
  };
}

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

interface DocChipProps {
  label: string;
  variant: 'invoice' | 'receipt';
  onOpen: () => void;
}

/** Compact chip indicating an attached document (Factura / Comprobante). Click to open viewer. */
function DocChip({ label, variant, onOpen }: DocChipProps) {
  const isInvoice = variant === 'invoice';
  const Icon = isInvoice ? FileText : Receipt;
  const styles = isInvoice
    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
    : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/50';

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Ver ${label}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${styles}`}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
}

export function MonthlyChecklistView({ onViewReceipt, initialMonth }: MonthlyChecklistViewProps) {
  const propertyCtx = usePropertyContext();
  const activePropertyId = propertyCtx?.activePropertyId || DEFAULT_PROPERTY_ID;
  const { data: expenses = [] } = useExpenses(activePropertyId);
  const { data: templates = [] } = useRecurringTemplates(activePropertyId);
  const updateExpenseMutation = useUpdateExpense();
  const deleteExpenseMutation = useDeleteExpense();

  // Current month state 'YYYY-MM' (Colombia timezone or specified initialMonth)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => initialMonth || getColombiaDateTime().dateStr.substring(0, 7)
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ExpenseCategory>('hoa_administration');
  const [activeType, setActiveType] = useState<ExpenseType>('fixed_monthly');
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [scanTrigger, setScanTrigger] = useState(false);

  const handleOpenCreate = (cat: ExpenseCategory, type: ExpenseType, scan = false) => {
    setExpenseToEdit(null);
    setActiveCategory(cat);
    setActiveType(type);
    setScanTrigger(scan);
    setModalOpen(true);
  };

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

  // Build items data: merge active templates, historical estimates, and registered invoices
  const checklistData = useMemo(() => {
    return CHECKLIST_ITEMS.map((catKey) => {
      const config = BILL_CONFIG[catKey];
      const template = templates.find((t) => t.category === catKey && t.is_active !== false);
      const defaultAmount = template?.default_amount ?? config.defaultAmount;
      const typicalDueDay = template?.typical_due_day ?? config.typicalDueDay;

      // Find if an expense for this category already exists in this billing month (prefer entry with documents)
      const categoryExpenses = monthExpenses.filter((e) => e.category === config.category);
      const existing = categoryExpenses.find((e) => e.invoice_url || e.receipt_url) || categoryExpenses[0];

      const estimate = getServiceEstimate(config.category, selectedMonth, expenses, defaultAmount);

      return {
        catKey,
        config,
        template,
        existing,
        typicalDueDay,
        estimate,
        isPaid: existing?.payment_status === 'paid',
        isPending: Boolean(existing && existing.payment_status !== 'paid'),
        isAwaiting: !existing,
      };
    });
  }, [monthExpenses, expenses, templates, selectedMonth]);

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

  // Estimated unbilled services sum (projected commitments not yet invoiced)
  const totalProjectedUnbilled = useMemo(() => {
    return checklistData
      .filter((item) => item.isAwaiting)
      .reduce((sum, item) => sum + item.estimate.amount, 0);
  }, [checklistData]);

  const totalMonthlyProjected = totalMonthlyBilled + totalProjectedUnbilled;
  const awaitingCount = checklistData.filter((i) => i.isAwaiting).length;
  const pendingBilled = Math.max(0, totalMonthlyBilled - totalMonthlyPaid);
  const totalRemainingToCover = Math.max(0, totalMonthlyProjected - totalMonthlyPaid);

  // Daily apartment operating costs (Apto Vacío vs Apto con Gente)
  const dailyCosts = useMemo(() => {
    return calculateApartmentDailyCosts(selectedMonth, monthExpenses, expenses);
  }, [selectedMonth, monthExpenses, expenses]);

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

      {/* Monthly Budget & Cash Flow Bar (Pipeline Financiero) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Presupuesto Proyectado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Presupuesto Proyectado</p>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                Mes Completo
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCOP(totalMonthlyProjected)} COP
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
            {awaitingCount > 0
              ? `${awaitingCount} servicio${awaitingCount > 1 ? 's' : ''} esperando factura`
              : 'Todos los servicios facturados'}
          </p>
        </div>

        {/* Card 2: Total Facturado Confirmado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Operativo del Mes</p>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Facturado Real
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCOP(totalMonthlyBilled)} COP
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
            {monthExpenses.length} movimientos registrados
          </p>
        </div>

        {/* Card 3: Total Pagado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Pagado / Cubierto</p>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCOP(totalMonthlyPaid)} COP
            </p>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
            <span>Pendiente Facturado:</span>
            <span className="font-semibold text-rose-500">{formatCOP(pendingBilled)}</span>
          </div>
        </div>

        {/* Card 4: Restante por Cubrir */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Restante por Cubrir</p>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                Proyección
              </span>
            </div>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {formatCOP(totalRemainingToCover)} COP
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-1.5 truncate">
            {formatCOP(pendingBilled)} fact. + {formatCOP(totalProjectedUnbilled)} est.
          </p>
        </div>
      </div>

      {/* Cronograma / Timeline habitual de vencimientos */}
      <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
          <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Cronograma de pagos habitual del mes:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Día 10: Administración
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Día 15: Internet / TV
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Día 20: EPM (Luz, Agua, Gas)
          </span>
        </div>
      </div>

      {/* Daily Operating Costs (Apto Vacío vs Apto con Gente) */}
      <DailyCostCards calculation={dailyCosts} />

      {/* Section 1: Standard Recurring Utilities, HOA & Annual Insurance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Costos Fijos, Servicios Públicos y Seguro Anual
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control de servicios del mes: esperando factura ➔ facturados por pagar ➔ pagados
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checklistData.map((item) => {
            const { catKey, config, existing, typicalDueDay, estimate, isPaid, isPending } = item;
            const Icon = config.icon;

            return (
              <div
                key={catKey}
                className={`p-5 rounded-2xl border transition-all duration-150 flex flex-col justify-between ${
                  isPaid
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    : isPending
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-xs'
                      : 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-200/90 dark:border-slate-800 shadow-xs'
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
                              : 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {config.label}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {config.isVariable ? 'Consumo Variable Mensual' : 'Monto Fijo Mensual'} • {config.provider}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isPaid ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 rounded-full shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="leading-none relative -top-[0.5px]">Pagado</span>
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-full shrink-0">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="leading-none relative -top-[0.5px]">Facturado · Por pagar</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-100/80 dark:bg-sky-950/80 px-2.5 py-1 rounded-full border border-sky-200/60 dark:border-sky-800/40 shrink-0">
                        <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span className="leading-none relative -top-[0.5px]">Esperando Factura</span>
                      </span>
                    )}
                  </div>

                  {/* Amount & Due Date block */}
                  <div className="my-3 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">
                        {existing ? 'Valor Factura:' : 'Valor Estimado:'}
                      </span>
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        {existing
                          ? formatCOP(existing.amount)
                          : `${formatCOP(estimate.amount)} (Est.)`}
                      </span>
                    </div>

                    {existing?.due_date ? (
                      <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span>Vence:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatDate(existing.due_date)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span>
                          {estimate.isHistoricalAvg ? (
                            <span className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-medium">
                              <History className="w-2.5 h-2.5" />
                              Promedio de {estimate.samplesCount} meses anteriores
                            </span>
                          ) : (
                            'Estimado presupuestal'
                          )}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          Vence aprox. día {typicalDueDay}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Soportes adjuntos: chips Factura / Comprobante */}
                  {existing && (existing.invoice_url || existing.receipt_url) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {existing.invoice_url && (
                        <DocChip
                          label="Factura"
                          variant="invoice"
                          onOpen={() => onViewReceipt(existing.invoice_url!, `Factura: ${config.label}`)}
                        />
                      )}
                      {existing.receipt_url && (
                        <DocChip
                          label="Comprobante"
                          variant="receipt"
                          onOpen={() => onViewReceipt(existing.receipt_url!, `Comprobante: ${config.label}`)}
                        />
                      )}
                    </div>
                  )}
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
                          setScanTrigger(false);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 w-full">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenCreate(
                            config.category,
                            config.category === 'hoa_administration' || config.category === 'internet_cable'
                              ? 'fixed_monthly'
                              : 'utility_monthly',
                            false
                          )
                        }
                        className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1"
                        title="Cargar monto o fecha de factura manualmente"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cargar Factura</span>
                      </button>

                      <button
                        type="button"
                        aria-label="Escanear factura con IA"
                        onClick={() =>
                          handleOpenCreate(
                            config.category,
                            config.category === 'hoa_administration' || config.category === 'internet_cable'
                              ? 'fixed_monthly'
                              : 'utility_monthly',
                            true
                          )
                        }
                        className="py-1.5 px-2.5 text-xs font-semibold rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors flex items-center gap-1 shrink-0"
                        title="Escanear factura con IA (foto o PDF)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                        <span>IA</span>
                      </button>
                    </div>
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
                {(activeAnnualPolicy.invoice_url || activeAnnualPolicy.receipt_url) && (
                  <button
                    type="button"
                    onClick={() => onViewReceipt((activeAnnualPolicy.invoice_url || activeAnnualPolicy.receipt_url)!)}
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
                  className={`p-5 rounded-2xl border transition-all duration-150 flex flex-col justify-between ${isPaid
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-xs'
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPaid
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

                    <div className="my-2.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[11px] text-slate-500">Monto:</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatCOP(exp.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Soportes adjuntos: chips Factura / Comprobante */}
                    {(exp.invoice_url || exp.receipt_url) && (
                      <div
                        className="flex flex-wrap items-center gap-1.5 mb-2.5"
                      >
                        {exp.invoice_url && (
                          <DocChip
                            label="Factura"
                            variant="invoice"
                            onOpen={() => onViewReceipt(exp.invoice_url!, `Factura: ${exp.description}`)}
                          />
                        )}
                        {exp.receipt_url && (
                          <DocChip
                            label="Comprobante"
                            variant="receipt"
                            onOpen={() => onViewReceipt(exp.receipt_url!, `Comprobante: ${exp.description}`)}
                          />
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 mb-2">
                      Fecha: {formatDate(exp.date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTogglePaid(exp)}
                      className={`flex-1 py-1 px-2.5 text-xs font-semibold rounded-xl border transition-colors ${isPaid
                        ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        }`}
                    >
                      {isPaid ? 'Cambiar a Pendiente' : 'Marcar Pagado'}
                    </button>

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
          setScanTrigger(false);
        }}
        expenseToEdit={expenseToEdit}
        defaultCategory={activeCategory}
        defaultBillingMonth={selectedMonth}
        defaultType={activeType}
        initialScanTrigger={scanTrigger}
      />
    </div>
  );
}
