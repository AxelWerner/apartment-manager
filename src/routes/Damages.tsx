import { useState } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Camera,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  Trash2,
  Eye,
} from 'lucide-react';
import { useDamages, useDeleteDamage } from '@/hooks/use-damages';
import { DamageModal } from '@/components/damages/DamageModal';
import { DamageDetailModal } from '@/components/damages/DamageDetailModal';
import { formatCOP, formatDate, SEVERITY_CONFIG, CLAIM_STATUS_CONFIG } from '@/lib/formatters';
import type { Damage } from '@/types/database';
import { toast } from 'sonner';

export default function Damages() {
  const { data: damages = [], isLoading } = useDamages();
  const deleteDamageMutation = useDeleteDamage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [damageToEdit, setDamageToEdit] = useState<Damage | null>(null);
  const [detailDamage, setDetailDamage] = useState<Damage | null>(null);

  const filteredDamages = damages.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.aircover_case_number && d.aircover_case_number.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedStatus === 'all' || d.claim_status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // KPI calculations
  const totalRepairCost = damages.reduce((sum, d) => sum + (Number(d.actual_repair_cost) || 0), 0);
  const totalReimbursed = damages.reduce((sum, d) => sum + (Number(d.reimbursement_amount) || 0), 0);
  const totalUnrecovered = Math.max(0, totalRepairCost - totalReimbursed);

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`¿Estás seguro de eliminar el reporte de "${title}"?`)) {
      try {
        await deleteDamageMutation.mutateAsync(id);
        toast.success('Reporte de daño eliminado');
      } catch {
        toast.error('No se pudo eliminar');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Daños e Incidentes del Apartamento
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Inspecciones de check-out, fotos de evidencia, reclamos de AirCover y reembolsos
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setDamageToEdit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Reportar Daño Encontrado</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Incidentes Totales</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{damages.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Costo de Arreglos</p>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
              {formatCOP(totalRepairCost)} COP
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Reembolsado (AirCover)</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatCOP(totalReimbursed)} COP
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pérdida Neta Asumida</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {formatCOP(totalUnrecovered)} COP
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título o caso AirCover..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">Todos los estados de reclamo</option>
            {Object.entries(CLAIM_STATUS_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Incidents */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Cargando incidentes...</div>
      ) : filteredDamages.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No se encontraron reportes de daños.
          </p>
          <p className="text-xs text-slate-400">
            ¡Excelente! Tu apartamento se encuentra en perfectas condiciones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDamages.map((dmg) => {
            const severityInfo = SEVERITY_CONFIG[dmg.severity] || SEVERITY_CONFIG.medium;
            const statusInfo = CLAIM_STATUS_CONFIG[dmg.claim_status] || CLAIM_STATUS_CONFIG.discovered;

            return (
              <div
                key={dmg.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                {/* Card Top / Photo Preview */}
                <div>
                  {dmg.photo_urls && dmg.photo_urls.length > 0 ? (
                    <div
                      onClick={() => setDetailDamage(dmg)}
                      className="h-40 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer relative group"
                    >
                      <img
                        src={dmg.photo_urls[0]}
                        alt={dmg.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {dmg.photo_urls.length > 1 && (
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
                          +{dmg.photo_urls.length - 1} fotos
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => setDetailDamage(dmg)}
                      className="h-28 w-full bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <Camera className="w-4 h-4" />
                        <span>Sin fotos adjuntas</span>
                      </div>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${severityInfo.badgeClass}`}>
                        {severityInfo.label}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(dmg.date_discovered)}
                      </span>
                    </div>

                    <h3
                      onClick={() => setDetailDamage(dmg)}
                      className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 hover:text-rose-600 cursor-pointer"
                    >
                      {dmg.title}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-2">
                      {dmg.description || 'Sin notas adicionales.'}
                    </p>

                    {/* Financial Pill */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                      <span className="text-slate-500">Costo / Pérdida:</span>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatCOP(dmg.actual_repair_cost || dmg.estimated_repair_cost)}
                        </span>
                        {dmg.reimbursement_amount > 0 && (
                          <span className="block text-[10px] font-semibold text-emerald-600">
                            Reembolsado: {formatCOP(dmg.reimbursement_amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 text-[11px]">Estado:</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDetailDamage(dmg)}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Detalles</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDamageToEdit(dmg);
                        setIsModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title="Editar"
                    >
                      <Plus className="w-3.5 h-3.5 rotate-45" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(dmg.id, dmg.title)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <DamageModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDamageToEdit(null);
        }}
        damageToEdit={damageToEdit}
      />

      <DamageDetailModal
        isOpen={Boolean(detailDamage)}
        onClose={() => setDetailDamage(null)}
        damage={detailDamage}
        onEdit={(dmg) => {
          setDetailDamage(null);
          setDamageToEdit(dmg);
          setIsModalOpen(true);
        }}
      />
    </div>
  );
}
