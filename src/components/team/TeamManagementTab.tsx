import { useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  Copy,
  Check,
  Clock,
  Crown,
  Briefcase,
  Sparkle,
  Eye,
  Shield,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  usePropertyMembers,
  usePropertyInvitations,
  useUpdateMemberRole,
  useRemoveMember,
  useCancelInvitation,
} from '@/hooks/use-team';
import { InviteUserModal } from './InviteUserModal';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole, PropertyMember, PropertyInvitation } from '@/types/database';
import { toast } from 'sonner';

interface TeamManagementTabProps {
  propertyId: string;
  propertyName: string;
  currentUserRole: UserRole;
}

const roleBadgeConfig: Record<
  UserRole,
  { label: string; bg: string; text: string; border: string; icon: typeof Crown }
> = {
  SUPER_USER: {
    label: 'Super User',
    bg: 'bg-purple-50 dark:bg-purple-950/60',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    icon: Shield,
  },
  OWNER: {
    label: 'Dueño',
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: Crown,
  },
  ADMINISTRATOR: {
    label: 'Administrador',
    bg: 'bg-rose-50 dark:bg-rose-950/60',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    icon: Briefcase,
  },
  CLEANER: {
    label: 'Limpieza',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: Sparkle,
  },
  VIEWER: {
    label: 'Lector',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    icon: Eye,
  },
};

export function TeamManagementTab({
  propertyId,
  propertyName,
  currentUserRole,
}: TeamManagementTabProps) {
  const { user } = useAuth();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [currentTime] = useState(() => Date.now());

  const { data: members = [], isLoading: isLoadingMembers } = usePropertyMembers(propertyId);
  const { data: invitations = [], isLoading: isLoadingInvitations } = usePropertyInvitations(propertyId);

  const updateRoleMutation = useUpdateMemberRole(propertyId);
  const removeMemberMutation = useRemoveMember(propertyId);
  const cancelInvitationMutation = useCancelInvitation(propertyId);

  const isOwnerOrAdmin =
    currentUserRole === 'OWNER' ||
    currentUserRole === 'SUPER_USER' ||
    currentUserRole === 'ADMINISTRATOR';

  const isOwner = currentUserRole === 'OWNER' || currentUserRole === 'SUPER_USER';

  const handleCopyInviteLink = async (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      toast.success('¡Enlace de invitación copiado!');
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const handleRoleChange = async (member: PropertyMember, newRole: UserRole) => {
    if (member.role === newRole) return;
    try {
      await updateRoleMutation.mutateAsync({
        memberId: member.id,
        newRole,
      });
      toast.success('Rol actualizado correctamente');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar rol';
      toast.error(msg);
    }
  };

  const handleRemoveMember = async (member: PropertyMember) => {
    // Verificar si es el único dueño
    if (member.role === 'OWNER') {
      const ownersCount = members.filter((m) => m.role === 'OWNER').length;
      if (ownersCount <= 1) {
        toast.error('No puedes eliminar al único dueño del apartamento.');
        return;
      }
    }

    const confirmName = member.profile?.full_name || 'este miembro';
    if (!window.confirm(`¿Estás seguro de que deseas revocar el acceso a ${confirmName}?`)) {
      return;
    }

    try {
      await removeMemberMutation.mutateAsync(member.id);
      toast.success('Acceso revocado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al revocar acceso';
      toast.error(msg);
    }
  };

  const handleCancelInvitation = async (invitation: PropertyInvitation) => {
    if (!window.confirm(`¿Deseas cancelar la invitación para ${invitation.email}?`)) {
      return;
    }

    try {
      await cancelInvitationMutation.mutateAsync(invitation.id);
      toast.success('Invitación cancelada');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cancelar la invitación';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Equipo y Usuarios del Apartamento
            </h2>
            <p className="text-xs text-slate-400">
              Controla quién tiene acceso a {propertyName || 'este inmueble'} y qué permisos posee
            </p>
          </div>
        </div>

        {isOwnerOrAdmin && (
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invitar Usuario</span>
          </button>
        )}
      </div>

      {/* Permissions / Role Guide Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(['OWNER', 'ADMINISTRATOR', 'CLEANER', 'VIEWER'] as UserRole[]).map((r) => {
          const cfg = roleBadgeConfig[r];
          const Icon = cfg.icon;
          return (
            <div
              key={r}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg border ${cfg.border} ${cfg.bg} ${cfg.text}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {cfg.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                {r === 'OWNER' && 'Acceso total al apartamento, finanzas, miembros y configuración.'}
                {r === 'ADMINISTRATOR' && 'Gestión operativa de reservas, gastos, guías e invitaciones.'}
                {r === 'CLEANER' && 'Calendario de entradas/salidas y reporte de daños e incidentes.'}
                {r === 'VIEWER' && 'Lectura de estadísticas e ingresos sin permisos de modificación.'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Active Members Table / List */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Miembros Activos
            </h3>
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {members.length}
            </span>
          </div>
        </div>

        {isLoadingMembers ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No se encontraron miembros activos registrados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((member) => {
              const isCurrentUser = member.user_id === user?.id;
              const roleCfg = roleBadgeConfig[member.role] || roleBadgeConfig.VIEWER;
              const RoleIcon = roleCfg.icon;
              const displayName =
                member.profile?.full_name ||
                (isCurrentUser ? user?.email : null) ||
                `Usuario ${member.user_id.slice(0, 6)}`;
              const initials = displayName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={member.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    {member.profile?.avatar_url ? (
                      <img
                        src={member.profile.avatar_url}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
                        {initials}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">
                            Tú
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        {member.profile?.phone && <span>{member.profile.phone}</span>}
                        {member.created_at && (
                          <span>
                            Miembro desde {new Date(member.created_at).toLocaleDateString('es-CO', {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Role Selector & Actions */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {isOwner && !isCurrentUser ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-rose-500 ${roleCfg.bg} ${roleCfg.text} ${roleCfg.border}`}
                      >
                        <option value="OWNER">Dueño</option>
                        <option value="ADMINISTRATOR">Administrador</option>
                        <option value="CLEANER">Limpieza</option>
                        <option value="VIEWER">Lector</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${roleCfg.bg} ${roleCfg.text} ${roleCfg.border}`}
                      >
                        <RoleIcon className="w-3.5 h-3.5" />
                        <span>{roleCfg.label}</span>
                      </span>
                    )}

                    {isOwner && !isCurrentUser && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member)}
                        title="Revocar acceso"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Invitations Section */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Invitaciones Pendientes
            </h3>
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {invitations.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Las invitaciones expiran a las 48 horas</span>
        </div>

        {isLoadingInvitations ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No hay invitaciones pendientes actualmente. Puedes invitar a nuevos colaboradores con el botón superior.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {invitations.map((inv) => {
              const roleCfg = roleBadgeConfig[inv.role] || roleBadgeConfig.VIEWER;
              const isCopied = copiedToken === inv.token;
              const isExpired = new Date(inv.expires_at).getTime() < currentTime;

              return (
                <div
                  key={inv.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {inv.email}
                        </span>
                        {isExpired ? (
                          <span className="px-2 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-[10px] font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Expirada
                          </span>
                        ) : (
                          <span className="px-2 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pendiente
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Rol: <strong className="font-semibold text-slate-600 dark:text-slate-300">{roleCfg.label}</strong></span>
                        <span>•</span>
                        <span>
                          Expira:{' '}
                          {new Date(inv.expires_at).toLocaleDateString('es-CO', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {!isExpired && (
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(inv.token)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Copiar enlace de invitación"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copiar Link</span>
                          </>
                        )}
                      </button>
                    )}

                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => handleCancelInvitation(inv)}
                        title="Cancelar invitación"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        propertyId={propertyId}
        propertyName={propertyName}
      />
    </div>
  );
}
