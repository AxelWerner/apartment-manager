import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Building2,
  Check,
  X,
  Loader2,
  Inbox,
  Clock,
  Sparkles,
  MapPin,
} from 'lucide-react';
import {
  useUserPendingInvitations,
  useAcceptPendingInvitation,
  useDeclinePendingInvitation,
} from '@/hooks/use-pending-invitations';
import { RoleBadge } from '@/components/properties/PropertySwitcher';
import type { UserPendingInvitation } from '@/types/database';

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

interface InvitationsBellProps {
  className?: string;
}

export function InvitationsBell({ className = '' }: InvitationsBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { invitations, count, isLoading } = useUserPendingInvitations();
  const acceptMutation = useAcceptPendingInvitation();
  const declineMutation = useDeclinePendingInvitation();

  const [activeToken, setActiveToken] = useState<string | null>(null);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleAccept = async (invitation: UserPendingInvitation) => {
    setActiveToken(invitation.token);
    try {
      await acceptMutation.mutateAsync({
        token: invitation.token,
        propertyName: invitation.property_name || undefined,
        propertyId: invitation.property_id,
      });
      setIsOpen(false);
    } finally {
      setActiveToken(null);
    }
  };

  const handleDecline = async (invitation: UserPendingInvitation) => {
    setActiveToken(invitation.token);
    try {
      await declineMutation.mutateAsync({
        token: invitation.token,
        propertyName: invitation.property_name || undefined,
      });
    } finally {
      setActiveToken(null);
    }
  };

  const isBusy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Botón de la campana con Badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
        title={count > 0 ? `${count} invitaciones pendientes` : 'Notificaciones e Invitaciones'}
        aria-label={count > 0 ? `Invitaciones (${count} pendientes)` : 'Invitaciones'}
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 transition-transform group-hover:scale-105" />

        {count > 0 && (
          <>
            {/* Ping effect */}
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>

            {/* Contador numérico badge */}
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-xs">
              {count > 9 ? '9+' : count}
            </span>
          </>
        )}
      </button>

      {/* Popover / Menú desplegable */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/90 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Cabecera */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Invitaciones
              </h3>
            </div>
            {count > 0 ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                {count} {count === 1 ? 'pendiente' : 'pendientes'}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-400">
                Al día
              </span>
            )}
          </div>

          {/* Lista de invitaciones */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-2 space-y-2">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                <p className="text-xs">Cargando invitaciones...</p>
              </div>
            ) : invitations.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6 stroke-1.5" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Sin invitaciones pendientes
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px] mt-1">
                  Cuando alguien te invite a colaborar en un apartamento, aparecerá aquí.
                </p>
              </div>
            ) : (
              invitations.map((inv) => {
                const isItemProcessing = isBusy && activeToken === inv.token;

                return (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-colors"
                  >
                    {/* Encabezado de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/40">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {inv.property_name || 'Apartamento'}
                          </p>
                          {inv.property_city && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{inv.property_city}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <RoleBadge role={inv.role} />
                    </div>

                    {/* Meta info */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-700/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[170px]" title={inv.inviter_email || undefined}>
                        {inv.inviter_name
                          ? `De: ${inv.inviter_name}`
                          : inv.inviter_email
                          ? `De: ${inv.inviter_email}`
                          : 'Invitación a equipo'}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatExpiresIn(inv.expires_at)}
                      </span>
                    </div>

                    {/* Botones de acción */}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDecline(inv)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Rechazar</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAccept(inv)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-xs hover:shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                      >
                        {isItemProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                        <span>Aceptar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
