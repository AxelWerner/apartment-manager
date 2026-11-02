import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Droplets,
  Zap,
  Flame,
  Wifi,
  CalendarClock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  useUserPendingInvitations,
  useAcceptPendingInvitation,
  useDeclinePendingInvitation,
} from '@/hooks/use-pending-invitations';
import { useServiceReminders, type ServiceReminder } from '@/hooks/use-service-reminders';
import { RoleBadge } from '@/components/properties/PropertySwitcher';
import { formatCOP } from '@/lib/formatters';
import type { UserPendingInvitation, ExpenseCategory } from '@/types/database';

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

function getCategoryIcon(category: ExpenseCategory) {
  switch (category) {
    case 'hoa_administration':
      return Building2;
    case 'water':
      return Droplets;
    case 'internet_cable':
      return Wifi;
    case 'gas':
      return Flame;
    case 'electricity':
      return Zap;
    default:
      return CalendarClock;
  }
}

function getCategoryColor(category: ExpenseCategory) {
  switch (category) {
    case 'hoa_administration':
      return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200/60';
    case 'water':
      return 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border-sky-200/60';
    case 'internet_cable':
      return 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400 border-violet-200/60';
    case 'gas':
      return 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200/60';
    case 'electricity':
      return 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/60 dark:text-yellow-400 border-yellow-200/60';
    default:
      return 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200';
  }
}

interface InvitationsBellProps {
  className?: string;
}

export function InvitationsBell({ className = '' }: InvitationsBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { invitations, count: invitationsCount, isLoading: isInvitesLoading } = useUserPendingInvitations();
  const { reminders, count: remindersCount, canReceiveServiceAlerts } = useServiceReminders();

  const acceptMutation = useAcceptPendingInvitation();
  const declineMutation = useDeclinePendingInvitation();

  const [activeToken, setActiveToken] = useState<string | null>(null);

  // User selected tab override; null means auto-derive from alerts
  const [userSelectedTab, setUserSelectedTab] = useState<'services' | 'invitations' | null>(null);

  // Total count shown in badge
  const totalCount = invitationsCount + (canReceiveServiceAlerts ? remindersCount : 0);

  // Auto-derived active tab
  const defaultTab = canReceiveServiceAlerts && remindersCount > 0
    ? 'services'
    : invitationsCount > 0
    ? 'invitations'
    : canReceiveServiceAlerts ? 'services' : 'invitations';

  const activeTab = userSelectedTab ?? defaultTab;

  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      if (!prev) {
        setUserSelectedTab(null); // Reset tab override on open
      }
      return !prev;
    });
  };

  // Close when clicking outside or pressing Escape
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

  const handleGoToExpense = (reminder: ServiceReminder) => {
    setIsOpen(false);
    const targetMonth = reminder.dueDateStr.substring(0, 7);
    navigate(`/p/${reminder.propertyId}/expenses?month=${targetMonth}`);
  };

  const isBusy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Bell Button with Unified Badge */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
        title={totalCount > 0 ? `${totalCount} notificaciones pendientes` : 'Centro de Notificaciones'}
        aria-label={totalCount > 0 ? `Notificaciones e Invitaciones (${totalCount} pendientes)` : 'Notificaciones e Invitaciones'}
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 transition-transform group-hover:scale-105" />

        {totalCount > 0 && (
          <>
            {/* Ping effect */}
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>

            {/* Counter badge */}
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-xs">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          </>
        )}
      </button>

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/90 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Notificaciones
              </h3>
            </div>
            {totalCount > 0 ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                {totalCount} {totalCount === 1 ? 'alerta' : 'alertas'}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-400">
                Al día
              </span>
            )}
          </div>

          {/* Navigation Tabs (Only if user has permission to see services) */}
          {canReceiveServiceAlerts && (
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 p-1 gap-1">
              <button
                type="button"
                onClick={() => setUserSelectedTab('services')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'services'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>Servicios</span>
                {remindersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {remindersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setUserSelectedTab('invitations')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'invitations'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Invitaciones</span>
                {invitationsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    {invitationsCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Content Area */}
          <div className="max-h-[380px] overflow-y-auto p-2 space-y-2">
            {/* TAB 1: SERVICE BILL REMINDERS (PRIMARY_OWNER & OWNER ONLY) */}
            {canReceiveServiceAlerts && activeTab === 'services' && (
              reminders.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    ¡Al día con los servicios!
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mt-1">
                    Todos los servicios del mes están pagos o aún no llegan a su fecha de revisión.
                  </p>
                </div>
              ) : (
                reminders.map((reminder) => {
                  const Icon = getCategoryIcon(reminder.category);
                  const colorClass = getCategoryColor(reminder.category);

                  const urgencyBadge =
                    reminder.urgency === 'overdue' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-950/80 px-2 py-0.5 rounded-full shrink-0">
                        <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                        <span className="leading-none relative -top-[0.5px]">
                          Venció día {reminder.typicalDueDay}
                        </span>
                      </span>
                    ) : reminder.urgency === 'due_today' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/80 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span className="leading-none relative -top-[0.5px]">
                          Vence hoy
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-100/90 dark:bg-sky-950/80 px-2 py-0.5 rounded-full shrink-0">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span className="leading-none relative -top-[0.5px]">
                          Vence día {reminder.typicalDueDay}
                        </span>
                      </span>
                    );

                  return (
                    <div
                      key={reminder.id}
                      className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/60 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${colorClass}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {reminder.label}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {reminder.provider} • {reminder.propertyName}
                            </p>
                          </div>
                        </div>

                        {urgencyBadge}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-700/40 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          {reminder.status === 'pending'
                            ? `Facturado: ${formatCOP(reminder.amount)}`
                            : `Esperando factura (~${formatCOP(reminder.amount)})`}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleGoToExpense(reminder)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>Revisar</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* TAB 2: INVITATIONS */}
            {(!canReceiveServiceAlerts || activeTab === 'invitations') && (
              isInvitesLoading ? (
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
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
