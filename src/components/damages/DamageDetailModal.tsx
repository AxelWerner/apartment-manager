import { useState } from 'react';
import {
  Receipt,
  User,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { formatCOP, formatDate, SEVERITY_CONFIG, CLAIM_STATUS_CONFIG } from '@/lib/formatters';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import type { Damage, ClaimStatus } from '@/types/database';
import { useUpdateDamage } from '@/hooks/use-damages';
import { useCreateExpense } from '@/hooks/use-expenses';
import { toast } from 'sonner';

interface DamageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  damage: Damage | null;
  onEdit: (damage: Damage) => void;
}

const STATUS_PIPELINE: { status: ClaimStatus; label: string }[] = [
  { status: 'discovered', label: 'Hallado' },
  { status: 'guest_contacted', label: 'Huésped Notificado' },
  { status: 'aircover_claim_submitted', label: 'AirCover Enviado' },
  { status: 'approved', label: 'Aprobado' },
  { status: 'reimbursed', label: 'Reembolsado' },
];

export function DamageDetailModal({ isOpen, onClose, damage, onEdit }: DamageDetailModalProps) {
  const updateDamageMutation = useUpdateDamage();
  const createExpenseMutation = useCreateExpense();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (!damage) return null;

  const severityInfo = SEVERITY_CONFIG[damage.severity] || SEVERITY_CONFIG.medium;
  const netLoss = Math.max(0, damage.actual_repair_cost - damage.reimbursement_amount);

  const handleUpdateStatus = async (newStatus: ClaimStatus) => {
    try {
      await updateDamageMutation.mutateAsync({
        id: damage.id,
        updates: { claim_status: newStatus },
      });
      toast.success(`Estado actualizado a: ${CLAIM_STATUS_CONFIG[newStatus].label}`);
    } catch {
      toast.error('Error al actualizar estado');
    }
  };

  const handleConvertToExpense = async () => {
    if (damage.linked_expense_id) {
      toast.info('Este daño ya cuenta con un gasto registrado');
      return;
    }

    try {
      const newExp = await createExpenseMutation.mutateAsync({
        property_id: DEFAULT_PROPERTY_ID,
        category: 'maintenance_repairs',
        expense_type: 'occasional',
        description: `Reparación: ${damage.title}`,
        amount: damage.actual_repair_cost || damage.estimated_repair_cost,
        date: new Date().toISOString().split('T')[0],
        due_date: null,
        billing_month: new Date().toISOString().substring(0, 7),
        payment_status: 'paid',
        is_recurring: false,
        recurrence_period: null,
        linked_booking_id: damage.linked_booking_id,
        receipt_url: damage.photo_urls?.[0] || null,
        notes: `Generado automáticamente desde el reporte de daño: ${damage.title}`,
      });

      await updateDamageMutation.mutateAsync({
        id: damage.id,
        updates: { linked_expense_id: newExp.id },
      });

      toast.success('Gasto de mantenimiento registrado con éxito');
    } catch {
      toast.error('No se pudo crear el gasto');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={damage.title}
      subtitle={`Descubierto el ${formatDate(damage.date_discovered)}`}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Status Stepper */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <p className="text-xs font-bold text-slate-500 mb-2">Flujo de Reclamo / Resolución</p>
          <div className="flex items-center justify-between overflow-x-auto pb-1 gap-1">
            {STATUS_PIPELINE.map((step, idx) => {
              const currentIndex = STATUS_PIPELINE.findIndex((s) => s.status === damage.claim_status);
              const isDone = idx <= currentIndex && damage.claim_status !== 'written_off';
              const isCurrent = step.status === damage.claim_status;

              return (
                <button
                  key={step.status}
                  type="button"
                  onClick={() => handleUpdateStatus(step.status)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    isCurrent
                      ? 'bg-rose-600 text-white shadow-xs'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Gravedad</p>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold mt-1 ${severityInfo.badgeClass}`}>
                {severityInfo.label}
              </span>
            </div>

            {damage.booking && (
              <div>
                <p className="text-xs text-slate-500 font-medium">Huésped Responsable</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  {damage.booking.guest_name}
                </p>
              </div>
            )}

            {damage.aircover_case_number && (
              <div>
                <p className="text-xs text-slate-500 font-medium">Caso AirCover</p>
                <p className="text-sm font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                  {damage.aircover_case_number}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-500 font-medium">Descripción</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                {damage.description || 'Sin descripción adicional.'}
              </p>
            </div>
          </div>

          {/* Financial summary card */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Balance del Incidente (COP)
            </p>

            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Costo Estimado:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatCOP(damage.estimated_repair_cost)}
              </span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Costo Real Arreglo:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {formatCOP(damage.actual_repair_cost)}
              </span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Reembolso Obtenido:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatCOP(damage.reimbursement_amount)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pérdida Neta Asumida:
              </span>
              <span
                className={`text-base font-extrabold ${
                  netLoss > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatCOP(netLoss)}
              </span>
            </div>

            {/* Convert to expense button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleConvertToExpense}
                disabled={Boolean(damage.linked_expense_id) || damage.actual_repair_cost <= 0}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-800 dark:text-slate-200 transition-colors disabled:opacity-40"
              >
                <Receipt className="w-3.5 h-3.5 text-rose-500" />
                <span>
                  {damage.linked_expense_id
                    ? 'Gasto de Reparación ya Vinculado'
                    : 'Convertir Reparación a Gasto'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        {damage.photo_urls && damage.photo_urls.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">Fotos de Evidencia</p>
            <div className="flex flex-wrap gap-2">
              {damage.photo_urls.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedPhoto(url)}
                  className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolution notes */}
        {damage.resolution_notes && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
            <p className="font-bold text-slate-700 dark:text-slate-300">Notas de Resolución:</p>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">{damage.resolution_notes}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(damage);
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
          >
            Editar Registro
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Expanded photo modal */}
      {selectedPhoto && (
        <Modal isOpen={true} onClose={() => setSelectedPhoto(null)} title="Foto de Evidencia" maxWidth="lg">
          <div className="p-2 text-center">
            <img
              src={selectedPhoto}
              alt="Evidencia Ampliada"
              className="max-h-[70vh] mx-auto rounded-xl object-contain border border-slate-200"
            />
          </div>
        </Modal>
      )}
    </Modal>
  );
}
