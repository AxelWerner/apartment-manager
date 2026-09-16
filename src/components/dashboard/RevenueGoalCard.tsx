import React, { useState } from 'react';
import { Target, Trophy, TrendingUp, CalendarDays, Pencil, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatCOP, formatMonthYear } from '@/lib/formatters';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Modal } from '@/components/ui/modal';
import { useUpdateProperty } from '@/hooks/use-property';
import type { Booking, Property } from '@/types/database';
import { toast } from 'sonner';

interface RevenueGoalCardProps {
  bookings: Booking[];
  property?: Property;
  currentMonthStr: string; // 'YYYY-MM'
  currentYear: number;
}

export function RevenueGoalCard({
  bookings,
  property,
  currentMonthStr,
  currentYear,
}: RevenueGoalCardProps) {
  const updatePropertyMutation = useUpdateProperty();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const monthlyGoal = property?.monthly_revenue_target || 3000000;
  const [tempGoal, setTempGoal] = useState(monthlyGoal);

  const annualGoal = monthlyGoal * 12; // 36.000.000 COP por defecto

  const getOwnerRevenue = (b: Booking) => {
    if (b.owner_payout !== undefined && b.owner_payout !== null) return Number(b.owner_payout);
    const accommodation = Math.max(0, (Number(b.net_payout) || 0) - (Number(b.cleaning_fee_collected) || 0));
    return Math.round(accommodation * 0.80);
  };

  // Current Month Bookings and Revenue (filtered by check_in in currentMonthStr, excluding cancelled)
  const thisMonthBookings = bookings.filter(
    (b) => b.check_in.startsWith(currentMonthStr) && b.status !== 'cancelled'
  );
  const thisMonthRevenue = thisMonthBookings.reduce(
    (sum, b) => sum + getOwnerRevenue(b),
    0
  );
  const monthProgressPercent = Math.min(200, Math.round((thisMonthRevenue / monthlyGoal) * 100));
  const isMonthGoalAchieved = thisMonthRevenue >= monthlyGoal;
  const monthDifference = Math.abs(thisMonthRevenue - monthlyGoal);

  // Annual Bookings and Revenue (currentYear)
  const thisYearBookings = bookings.filter(
    (b) => b.check_in.startsWith(String(currentYear)) && b.status !== 'cancelled'
  );
  const thisYearRevenue = thisYearBookings.reduce(
    (sum, b) => sum + getOwnerRevenue(b),
    0
  );
  const annualProgressPercent = Math.min(200, Math.round((thisYearRevenue / annualGoal) * 100));
  const isAnnualGoalAchieved = thisYearRevenue >= annualGoal;
  const annualDifference = Math.abs(thisYearRevenue - annualGoal);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePropertyMutation.mutateAsync({
        monthly_revenue_target: tempGoal,
      });
      setIsEditModalOpen(false);
      toast.success('Meta de ingresos actualizada correctamente');
    } catch {
      toast.error('No se pudo guardar la meta');
    }
  };

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-5 sm:p-6 shadow-md border border-slate-800 relative overflow-hidden">
        {/* Subtle background ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Header & Meta Explanation */}
          <div className="space-y-1.5 max-w-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  Meta de Ingresos por Reservas
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs font-semibold text-rose-300">
                    Objetivo: {formatCOP(monthlyGoal)} COP / mes
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTempGoal(monthlyGoal);
                      setIsEditModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    title="Editar meta mensual"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              Seguimiento en tiempo real de los pagos netos de Airbnb frente al objetivo mensual y acumulado anual.
            </p>
          </div>

          {/* Goals Display: Month Goal & Annual Goal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {/* Card 1: Meta del Mes Actual */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-200">
                    Mes Actual ({formatMonthYear(currentMonthStr)})
                  </span>
                </div>
                {isMonthGoalAchieved ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Trophy className="w-3 h-3" /> ¡Meta Lograda!
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {monthProgressPercent}%
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-white">
                    {formatCOP(thisMonthRevenue)}
                  </span>
                  <span className="text-xs text-slate-400">
                    de <strong className="text-slate-300">{formatCOP(monthlyGoal)}</strong>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800/80 rounded-full h-2.5 mt-2.5 overflow-hidden p-0.5 border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isMonthGoalAchieved
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-xs shadow-emerald-500/50'
                        : 'bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, monthProgressPercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>{thisMonthBookings.length} reservas en el mes</span>
                  {isMonthGoalAchieved ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> +{formatCOP(monthDifference)} superados
                    </span>
                  ) : (
                    <span className="text-amber-300/90 font-medium">
                      Faltan {formatCOP(monthDifference)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Total Acumulado Anual */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-200">
                    Total Anual ({currentYear})
                  </span>
                </div>
                {isAnnualGoalAchieved ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Trophy className="w-3 h-3" /> ¡Meta Anual Lograda!
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {annualProgressPercent}%
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-white">
                    {formatCOP(thisYearRevenue)}
                  </span>
                  <span className="text-xs text-slate-400">
                    de <strong className="text-slate-300">{formatCOP(annualGoal)}</strong>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800/80 rounded-full h-2.5 mt-2.5 overflow-hidden p-0.5 border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isAnnualGoalAchieved
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-xs shadow-emerald-500/50'
                        : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, annualProgressPercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>{thisYearBookings.length} reservas en {currentYear}</span>
                  {isAnnualGoalAchieved ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> +{formatCOP(annualDifference)} superados
                    </span>
                  ) : (
                    <span className="text-blue-300/90 font-medium">
                      Meta anual: 12 meses × {formatCOP(monthlyGoal)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal to quickly customize monthly goal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ajustar Meta Mensual de Reservas"
        subtitle="Define el monto en COP que esperas recibir por mes de tus reservas de Airbnb"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Meta Mensual ($ COP) *
            </label>
            <CurrencyInput
              value={tempGoal}
              onChange={setTempGoal}
              className="w-full px-3.5 py-2.5 text-base font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Meta Anual calculada: <strong>{formatCOP(tempGoal * 12)} COP</strong>
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updatePropertyMutation.isPending}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
            >
              {updatePropertyMutation.isPending ? 'Guardando...' : 'Guardar Meta'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
