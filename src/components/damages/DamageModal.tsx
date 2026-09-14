import React, { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { CurrencyInput } from '@/components/ui/currency-input';
import { uploadMedia } from '@/lib/storage';
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';
import type { Damage, DamageSeverity, ClaimStatus } from '@/types/database';
import { useCreateDamage, useUpdateDamage } from '@/hooks/use-damages';
import { useBookings } from '@/hooks/use-bookings';
import { CLAIM_STATUS_CONFIG } from '@/lib/formatters';
import { toast } from 'sonner';

interface DamageModalProps {
  isOpen: boolean;
  onClose: () => void;
  damageToEdit?: Damage | null;
}

interface DamageFormContentProps {
  damageToEdit?: Damage | null;
  onClose: () => void;
}

function DamageFormContent({ damageToEdit, onClose }: DamageFormContentProps) {
  const createDamageMutation = useCreateDamage();
  const updateDamageMutation = useUpdateDamage();
  const { data: bookings = [] } = useBookings();

  const [title, setTitle] = useState(damageToEdit?.title ?? '');
  const [description, setDescription] = useState(damageToEdit?.description ?? '');
  const [dateDiscovered, setDateDiscovered] = useState(
    damageToEdit?.date_discovered ?? new Date().toISOString().split('T')[0]
  );
  const [severity, setSeverity] = useState<DamageSeverity>(damageToEdit?.severity ?? 'medium');
  const [linkedBookingId, setLinkedBookingId] = useState<string>(damageToEdit?.linked_booking_id ?? '');
  const [estimatedCost, setEstimatedCost] = useState<number>(damageToEdit?.estimated_repair_cost ?? 0);
  const [actualCost, setActualCost] = useState<number>(damageToEdit?.actual_repair_cost ?? 0);
  const [reimbursementAmount, setReimbursementAmount] = useState<number>(
    damageToEdit?.reimbursement_amount ?? 0
  );
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>(damageToEdit?.claim_status ?? 'discovered');
  const [aircoverCaseNumber, setAircoverCaseNumber] = useState(damageToEdit?.aircover_case_number ?? '');
  const [resolutionNotes, setResolutionNotes] = useState(damageToEdit?.resolution_notes ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(damageToEdit?.photo_urls ?? []);
  const [isUploading, setIsUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadMedia(files[i], 'damages');
        uploaded.push(url);
      }
      setPhotoUrls((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} foto(s) de evidencia cargada(s)`);
    } catch {
      toast.error('Error al subir las imágenes');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Por favor escribe un título del daño encontrado');
      return;
    }

    try {
      const payload = {
        property_id: DEFAULT_PROPERTY_ID,
        linked_booking_id: linkedBookingId || null,
        title: title.trim(),
        description: description.trim(),
        date_discovered: dateDiscovered,
        severity,
        estimated_repair_cost: estimatedCost,
        actual_repair_cost: actualCost,
        reimbursement_amount: reimbursementAmount,
        claim_status: claimStatus,
        aircover_case_number: aircoverCaseNumber.trim() || null,
        resolution_notes: resolutionNotes.trim() || null,
        photo_urls: photoUrls,
        linked_expense_id: damageToEdit?.linked_expense_id || null,
      };

      if (damageToEdit) {
        await updateDamageMutation.mutateAsync({
          id: damageToEdit.id,
          updates: payload,
        });
        toast.success('Incidente actualizado');
      } else {
        await createDamageMutation.mutateAsync(payload);
        toast.success('Incidente registrado con éxito');
      }
      onClose();
    } catch {
      toast.error('Error al guardar el daño');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Título del Daño *
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. Control de TV quebrado, derrame en alfombra..."
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {/* Severity & Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Gravedad del Daño
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as DamageSeverity)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
          >
            <option value="low">Leve (ej. copa rota, mancha menor)</option>
            <option value="medium">Medio (ej. control roto, toalla quemada)</option>
            <option value="high">Alto (ej. daño en electrodoméstico, mueble roto)</option>
            <option value="critical">Crítico (ej. cerradura rota, fuga de agua grave)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Fecha del Hallazgo *
          </label>
          <input
            type="date"
            required
            value={dateDiscovered}
            onChange={(e) => setDateDiscovered(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Responsible Booking */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Huésped / Reserva Responsable (Opcional)
        </label>
        <select
          value={linkedBookingId}
          onChange={(e) => setLinkedBookingId(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
        >
          <option value="">No identificado / Desgaste normal</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.guest_name} (Salida: {b.check_out})
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Descripción y Contexto del Hallazgo
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe cómo y dónde se encontró el daño..."
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {/* Financials (Costs & Reimbursement in COP) */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Costos y Reembolso (COP)
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Costo Estimado
            </label>
            <CurrencyInput
              value={estimatedCost}
              onChange={setEstimatedCost}
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Costo Real Arreglo
            </label>
            <CurrencyInput
              value={actualCost}
              onChange={setActualCost}
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reembolso Recibido
            </label>
            <CurrencyInput
              value={reimbursementAmount}
              onChange={setReimbursementAmount}
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Claim Status & AirCover Case */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Estado del Reclamo
          </label>
          <select
            value={claimStatus}
            onChange={(e) => setClaimStatus(e.target.value as ClaimStatus)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            {Object.entries(CLAIM_STATUS_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Caso AirCover / Airbnb
          </label>
          <input
            type="text"
            value={aircoverCaseNumber}
            onChange={(e) => setAircoverCaseNumber(e.target.value)}
            placeholder="Ej. AC-88231"
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
          />
        </div>
      </div>

      {/* Multi-Photo Uploader */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Fotos de Evidencia (Cámara del móvil o archivo)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            id="damage-photos-input"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <label
            htmlFor="damage-photos-input"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-rose-500 cursor-pointer transition-colors"
          >
            <Camera className="w-4 h-4 text-rose-500" />
            <span>{isUploading ? 'Subiendo fotos...' : 'Tomar / Subir Fotos'}</span>
          </label>

          {photoUrls.map((url, idx) => (
            <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 group">
              <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-0.5 right-0.5 p-0.5 bg-rose-600 text-white rounded-full opacity-80 hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Resolution Notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Notas de Resolución
        </label>
        <textarea
          rows={2}
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          placeholder="Resultado con el huésped o soporte de Airbnb..."
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
          disabled={createDamageMutation.isPending || updateDamageMutation.isPending || isUploading}
          className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
        >
          {damageToEdit ? 'Guardar Cambios' : 'Registrar Daño'}
        </button>
      </div>
    </form>
  );
}

export function DamageModal({ isOpen, onClose, damageToEdit }: DamageModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={damageToEdit ? 'Editar Daño o Incidente' : 'Reportar Daño Encontrado'}
      subtitle="Registra la inspección de salida, fotos de evidencia y costos de reparación"
      maxWidth="xl"
    >
      <DamageFormContent
        key={damageToEdit?.id ?? 'new-damage'}
        damageToEdit={damageToEdit}
        onClose={onClose}
      />
    </Modal>
  );
}
