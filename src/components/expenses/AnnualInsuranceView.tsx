import { useState } from 'react';
import { ShieldCheck, AlertTriangle, FileText, Plus } from 'lucide-react';
import { formatCOP, formatDate } from '@/lib/formatters';
import type { Expense } from '@/types/database';
import { useExpenses } from '@/hooks/use-expenses';
import { ExpenseModal } from './ExpenseModal';

interface AnnualInsuranceViewProps {
  onViewReceipt: (url: string) => void;
}

export function AnnualInsuranceView({ onViewReceipt }: AnnualInsuranceViewProps) {
  const { data: expenses = [] } = useExpenses();
  const [modalOpen, setModalOpen] = useState(false);

  // Find latest annual insurance expense
  const insuranceExpenses = expenses
    .filter((e) => e.category === 'insurance_annual' || e.expense_type === 'annual')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const currentPolicy = insuranceExpenses[0] as Expense | undefined;
  const annualPremium = currentPolicy ? Number(currentPolicy.amount) : 1350000;
  const monthlyAmortized = Math.round(annualPremium / 12);

  // Renewal calculation (assumed 1 year from payment date)
  const paymentDate = currentPolicy?.date || '2026-06-15';
  const renewalDate = new Date(paymentDate);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const renewalDateStr = renewalDate.toISOString().split('T')[0];

  const today = new Date();
  const diffDays = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Seguro Todo Riesgo del Apartamento</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Póliza anual contra incendios, daños por agua, terremoto y responsabilidad civil
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-colors shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{currentPolicy ? 'Actualizar / Renovar Póliza' : 'Registrar Seguro'}</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5">
          <div>
            <p className="text-xs font-medium text-slate-400">Prima Anual Pagada</p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {formatCOP(annualPremium)} COP
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Fecha de pago: {formatDate(paymentDate)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-400">Impacto Mensual (Prorrateado)</p>
            <p className="text-2xl font-extrabold text-rose-400 mt-1">
              {formatCOP(monthlyAmortized)} COP / mes
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Costo mensual para cálculo de margen real
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-400">Próxima Renovación</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-lg font-bold text-white">{formatDate(renewalDateStr)}</p>
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                  diffDays > 45
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {diffDays > 0 ? `${diffDays} días restantes` : 'Por renovar'}
              </span>
            </div>
            {currentPolicy?.receipt_url && (
              <button
                type="button"
                onClick={() => onViewReceipt(currentPolicy.receipt_url!)}
                className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 mt-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Ver carátula de póliza adjunta
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-bold">¿Cómo afecta el seguro anual a tus estadísticas de ganancias?</p>
          <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
            Al pagar un seguro de una sola vez al año ({formatCOP(annualPremium)} COP), si se restara únicamente en ese mes, ese período parecería tener pérdidas irreales. En el Dashboard se aplica automáticamente el cálculo prorrateado (<strong>{formatCOP(monthlyAmortized)} COP/mes</strong>) para reflejar tu rentabilidad neta mensual exacta.
          </p>
        </div>
      </div>

      <ExpenseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        expenseToEdit={currentPolicy}
        defaultCategory="insurance_annual"
        defaultType="annual"
      />
    </div>
  );
}
