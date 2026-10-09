import { useState } from 'react';
import {
  Building2,
  Plus,
  Sparkles,
  CheckCircle2,
  MapPin,
  Clock,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { CreatePropertyModal } from './CreatePropertyModal';
import {
  useUserPendingInvitations,
  useAcceptPendingInvitation,
  useDeclinePendingInvitation,
} from '@/hooks/use-pending-invitations';
import { RoleBadge } from './PropertySwitcher';

function formatExpiresIn(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Expirada';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `Expira en ${mins} min`;
  }
  if (hours < 24) {
    return `Expira en ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `Expira en ${days} día${days > 1 ? 's' : ''}`;
}

export function EmptyPropertyView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);

  const { invitations, count } = useUserPendingInvitations();
  const acceptMutation = useAcceptPendingInvitation();
  const declineMutation = useDeclinePendingInvitation();

  const handleAccept = async (token: string, propertyName?: string, propertyId?: string) => {
    setActiveToken(token);
    try {
      await acceptMutation.mutateAsync({
        token,
        propertyName,
        propertyId,
      });
    } finally {
      setActiveToken(null);
    }
  };

  const handleDecline = async (token: string, propertyName?: string) => {
    setActiveToken(token);
    try {
      await declineMutation.mutateAsync({
        token,
        propertyName,
      });
    } finally {
      setActiveToken(null);
    }
  };

  const isBusy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6 space-y-8">
      {/* Sección destacada si tiene invitaciones pendientes */}
      {count > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-rose-500/30 bg-gradient-to-b from-rose-50/80 via-white to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 p-6 sm:p-7 shadow-xl shadow-rose-500/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  ¡Tienes {count} {count === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}!
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                  Acceso de equipo
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Te han invitado a colaborar en uno o más apartamentos. Puedes unirte al instante:
              </p>
            </div>
          </div>

          {/* Tarjetas de invitación */}
          <div className="mt-5 space-y-3">
            {invitations.map((inv) => {
              const isItemProcessing = isBusy && activeToken === inv.token;

              return (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/40">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {inv.property_name || 'Apartamento'}
                        </p>
                        <RoleBadge role={inv.role} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        {inv.property_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{inv.property_city}</span>
                          </span>
                        )}
                        <span className="truncate max-w-[200px]">
                          {inv.inviter_name
                            ? `Invitado por: ${inv.inviter_name}`
                            : inv.inviter_email
                            ? `De: ${inv.inviter_email}`
                            : 'Invitación pendiente'}
                        </span>
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                          <Clock className="w-3 h-3 shrink-0" />
                          {formatExpiresIn(inv.expires_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0 sm:self-center justify-end">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecline(inv.token, inv.property_name || undefined)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Rechazar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleAccept(inv.token, inv.property_name || undefined, inv.property_id)
                      }
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {isItemProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      )}
                      <span>Aceptar invitación</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tarjeta principal para crear un nuevo apartamento */}
      <div className="text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 items-center justify-center text-white shadow-xl shadow-rose-500/25 mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {count > 0 ? 'O crea tu propio apartamento' : 'Comienza añadiendo tu primer apartamento'}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Para ver el panel de control, sincronizar tus reservas de Airbnb y gestionar finanzas, agrega tu primera propiedad.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-left text-xs space-y-2.5 text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span>¿Qué podrás hacer una vez añadido?</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Importar reservas desde CSV de Airbnb en segundos</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Controlar gastos fijos, servicios públicos y aseo</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Invitar a socios, administradores o personal de limpieza</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir mi primer Apartamento</span>
          </button>
        </div>
      </div>

      <CreatePropertyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
