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
  SlidersHorizontal,
  Sparkle,
  Eye,
  Shield,
  Loader2,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import {
  usePropertyMembers,
  usePropertyInvitations,
  useUpdateMemberRole,
  useUpdateMemberOwnership,
  useTransferPrimaryOwnership,
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
  isCurrentUserOwner?: boolean;
  isCurrentUserPrimaryOwner?: boolean;
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
  OPERATOR: {
    label: 'Gestor Operativo',
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    icon: SlidersHorizontal,
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
  isCurrentUserOwner,
  isCurrentUserPrimaryOwner,
}: TeamManagementTabProps) {
  const { user } = useAuth();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [currentTime] = useState(() => Date.now());

  const { data: members = [], isLoading: isLoadingMembers } = usePropertyMembers(propertyId);
  const { data: invitations = [], isLoading: isLoadingInvitations } = usePropertyInvitations(propertyId);

  const updateRoleMutation = useUpdateMemberRole(propertyId);
  const updateOwnershipMutation = useUpdateMemberOwnership(propertyId);
  const transferOwnershipMutation = useTransferPrimaryOwnership(propertyId);
  const removeMemberMutation = useRemoveMember(propertyId);
  const cancelInvitationMutation = useCancelInvitation(propertyId);

  const isPrimaryOwner = Boolean(
    isCurrentUserPrimaryOwner ||
    currentUserRole === 'SUPER_USER' ||
    members.find((m) => m.user_id === user?.id)?.is_primary_owner
  );

  const isOwner = Boolean(
    isPrimaryOwner ||
    isCurrentUserOwner ||
    currentUserRole === 'OWNER' ||
    currentUserRole === 'SUPER_USER' ||
    members.find((m) => m.user_id === user?.id)?.is_owner
  );

  const isOwnerOrAdmin = isOwner || currentUserRole === 'ADMINISTRATOR';

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
    if (member.is_primary_owner) {
      toast.error('El Dueño Principal tiene máxima jerarquía y su rol no se modifica.');
      return;
    }
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

  const handleOwnershipChange = async (member: PropertyMember, newIsOwner: boolean) => {
    if (member.is_primary_owner) {
      toast.error('El Dueño Principal posee titularidad absoluta y no puede ser desmarcado.');
      return;
    }

    // Si se quiere desmarcar como dueño, validar que no sea el único
    if (!newIsOwner && member.is_owner) {
      const ownersCount = members.filter((m) => m.is_owner || m.role === 'OWNER' || m.is_primary_owner).length;
      if (ownersCount <= 1) {
        toast.error('Debe haber al menos un dueño asignado al apartamento.');
        return;
      }
    }

    try {
      await updateOwnershipMutation.mutateAsync({
        memberId: member.id,
        isOwner: newIsOwner,
      });
      toast.success(newIsOwner ? 'Usuario marcado como Dueño' : 'Titularidad de Dueño retirada');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar titularidad';
      toast.error(msg);
    }
  };

  const handleTransferPrimaryOwnership = async (member: PropertyMember) => {
    const confirmName = member.profile?.full_name || member.profile?.email || 'este usuario';
    const confirmed = window.confirm(
      `⚠️ ¿TRANSFERIR TITULARIDAD PRINCIPAL A ${confirmName.toUpperCase()}?\n\n` +
      `Esta acción transferirá la titularidad absoluta del apartamento a este usuario.\n` +
      `Pasarás a ser Copropietario y ya no podrás modificar ni revocar al nuevo Dueño Principal.`
    );
    if (!confirmed) return;

    try {
      await transferOwnershipMutation.mutateAsync({ newOwnerUserId: member.user_id });
      toast.success(`Titularidad principal transferida a ${confirmName}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al transferir titularidad';
      toast.error(msg);
    }
  };

  const handleRemoveMember = async (member: PropertyMember) => {
    if (member.is_primary_owner) {
      toast.error('No se puede revocar el acceso al Dueño Principal.');
      return;
    }

    // Verificar si es el único dueño
    if (member.is_owner || member.role === 'OWNER') {
      const ownersCount = members.filter((m) => m.is_owner || m.role === 'OWNER' || m.is_primary_owner).length;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Dueño Flag Card */}
        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
              <Crown className="w-3.5 h-3.5 fill-amber-500/20" />
            </div>
            <span className="text-xs font-bold text-amber-950 dark:text-amber-100">
              Dueño Principal / Dueño
            </span>
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-tight">
            Máxima autoridad sobre finanzas. El Dueño Principal es inmune a remoción o degradación y puede transferir la titularidad.
          </p>
        </div>

        {/* 4 Operational Roles */}
        {(['ADMINISTRATOR', 'OPERATOR', 'CLEANER', 'VIEWER'] as UserRole[]).map((r) => {
          const cfg = roleBadgeConfig[r];
          const Icon = cfg.icon;
          return (
            <div
              key={r}
              className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
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
                {r === 'ADMINISTRATOR' && 'Gestión completa de tarifas, comisiones, miembros y ajustes técnicos.'}
                {r === 'OPERATOR' && 'Operativa diaria: reservas, gastos del apto, guía del huésped y daños.'}
                {r === 'CLEANER' && 'Calendario de entradas/salidas y reporte fotográfico de incidencias.'}
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
              const memberEmail =
                member.profile?.email || (isCurrentUser ? user?.email : null);
              const displayName =
                member.profile?.full_name ||
                memberEmail ||
                `Usuario ${member.user_id.slice(0, 6)}`;
              const initials = (member.profile?.full_name || memberEmail || displayName)
                .split(/[\s@._-]+/)
                .filter(Boolean)
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'U';

              return (
                <div
                  key={member.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-855/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {member.profile?.avatar_url ? (
                        <img
                          src={member.profile.avatar_url}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-300 dark:border-slate-700">
                          {initials}
                        </div>
                      )}
                      {member.is_primary_owner ? (
                        <span
                          title="Dueño Principal (Titular Inmune)"
                          className="absolute -bottom-1 -right-1 p-0.5 bg-amber-500 text-white rounded-full ring-2 ring-white dark:ring-slate-900"
                        >
                          <Crown className="w-3 h-3 fill-white" />
                        </span>
                      ) : member.is_owner ? (
                        <span
                          title="Dueño / Copropietario"
                          className="absolute -bottom-1 -right-1 p-0.5 bg-amber-400 text-white rounded-full ring-2 ring-white dark:ring-slate-900"
                        >
                          <Crown className="w-3 h-3 fill-white" />
                        </span>
                      ) : null}
                    </div>

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
                        {memberEmail && member.profile?.full_name && (
                          <span className="text-slate-500 dark:text-slate-400">
                            {memberEmail}
                          </span>
                        )}
                        {memberEmail && member.profile?.full_name && member.created_at && (
                          <span>•</span>
                        )}
                        {member.profile?.phone && (
                          <>
                            <span>{member.profile.phone}</span>
                            {member.created_at && <span>•</span>}
                          </>
                        )}
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

                  {/* Role Selector, Dueño Badge & Actions */}
                  <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-center">
                    {/* Primary Owner Badge (IMMUNE) */}
                    {member.is_primary_owner ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/80 shadow-xs">
                        <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>Dueño Principal</span>
                      </span>
                    ) : (
                      <>
                        {/* Dueño Flag Toggle / Badge */}
                        {isOwner && !isCurrentUser ? (
                          <button
                            type="button"
                            onClick={() => handleOwnershipChange(member, !member.is_owner)}
                            title={
                              member.is_owner
                                ? 'Hacer clic para retirar la titularidad de Dueño'
                                : 'Hacer clic para marcar como Dueño / Copropietario'
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              member.is_owner
                                ? 'bg-amber-100/90 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700 shadow-xs hover:bg-amber-200/80 dark:hover:bg-amber-900/60'
                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-400 border-dashed border-slate-300 dark:border-slate-700 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                            }`}
                          >
                            <Crown
                              className={`w-3.5 h-3.5 ${
                                member.is_owner
                                  ? 'text-amber-600 dark:text-amber-400 fill-amber-500/20'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span>{member.is_owner ? 'Dueño' : '+ Dueño'}</span>
                          </button>
                        ) : member.is_owner ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border bg-amber-100/90 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700">
                            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
                            <span>Dueño</span>
                          </span>
                        ) : null}

                        {/* Operational Role Selector */}
                        {isOwner && !isCurrentUser ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-rose-500 ${roleCfg.bg} ${roleCfg.text} ${roleCfg.border}`}
                          >
                            <option value="ADMINISTRATOR">Administrador</option>
                            <option value="OPERATOR">Gestor Operativo</option>
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

                        {/* Transfer Primary Ownership Button (only for Primary Owner) */}
                        {isPrimaryOwner && !isCurrentUser && (
                          <button
                            type="button"
                            onClick={() => handleTransferPrimaryOwnership(member)}
                            title="Transferir la titularidad principal a este usuario"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-700 hover:border-amber-300 transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Transferir Titularidad</span>
                          </button>
                        )}

                        {/* Remove Member Button */}
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
                      </>
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
                        {inv.is_owner && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
                            Dueño
                          </span>
                        )}
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
