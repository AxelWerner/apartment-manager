import React, { useState } from 'react';
import {
  X,
  Mail,
  ShieldCheck,
  Check,
  Copy,
  Share2,
  Sparkles,
  Loader2,
  Crown,
  Briefcase,
  SlidersHorizontal,
  Sparkle,
  Eye,
} from 'lucide-react';
import { useCreateInvitation } from '@/hooks/use-team';
import type { UserRole, PropertyInvitation } from '@/types/database';
import { toast } from 'sonner';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  propertyName: string;
}

const roleOptions: Array<{
  role: UserRole;
  title: string;
  description: string;
  icon: typeof Crown;
  selectedCardClass: string;
  unselectedCardClass: string;
  selectedIconClass: string;
  unselectedIconClass: string;
  checkColor: string;
}> = [
  {
    role: 'ADMINISTRATOR',
    title: 'Administrador',
    description: 'Gestión total de reservas, gastos, facturación, guía e invitaciones.',
    icon: Briefcase,
    selectedCardClass:
      'border-rose-500 dark:border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/25 shadow-xs',
    unselectedCardClass:
      'border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-800/60',
    selectedIconClass: 'bg-rose-600 text-white shadow-xs shadow-rose-600/30',
    unselectedIconClass:
      'bg-rose-100/80 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/50',
    checkColor: 'text-rose-600 dark:text-rose-400',
  },
  {
    role: 'OPERATOR',
    title: 'Gestor Operativo',
    description: 'Operativa diaria: reservas, gastos del apto, guía del huésped y daños sin acceso a finanzas críticas ni miembros.',
    icon: SlidersHorizontal,
    selectedCardClass:
      'border-amber-500 dark:border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/25 shadow-xs',
    unselectedCardClass:
      'border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-800/60',
    selectedIconClass: 'bg-amber-600 text-white shadow-xs shadow-amber-600/30',
    unselectedIconClass:
      'bg-amber-100/80 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-200/70 dark:border-amber-900/50',
    checkColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    role: 'CLEANER',
    title: 'Personal de Limpieza',
    description: 'Acceso a fechas de entrada/salida y reporte fotográfico de daños.',
    icon: Sparkle,
    selectedCardClass:
      'border-emerald-500 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/25 shadow-xs',
    unselectedCardClass:
      'border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-800/60',
    selectedIconClass: 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/30',
    unselectedIconClass:
      'bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900/50',
    checkColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    role: 'VIEWER',
    title: 'Lector / Auditor',
    description: 'Solo visualización de métricas, reportes y calendario sin edición.',
    icon: Eye,
    selectedCardClass:
      'border-purple-500 dark:border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 ring-2 ring-purple-500/25 shadow-xs',
    unselectedCardClass:
      'border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 hover:border-purple-300 dark:hover:border-purple-800/60',
    selectedIconClass: 'bg-purple-600 text-white shadow-xs shadow-purple-600/30',
    unselectedIconClass:
      'bg-purple-100/80 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 border border-purple-200/70 dark:border-purple-900/50',
    checkColor: 'text-purple-600 dark:text-purple-400',
  },
];

export function InviteUserModal({
  isOpen,
  onClose,
  propertyId,
  propertyName,
}: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('ADMINISTRATOR');
  const [isOwner, setIsOwner] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<PropertyInvitation | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const inviteMutation = useCreateInvitation(propertyId);

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail('');
    setRole('ADMINISTRATOR');
    setIsOwner(false);
    setCreatedInvitation(null);
    setHasCopied(false);
    onClose();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      const inv = await inviteMutation.mutateAsync({
        email: email.trim(),
        role,
        isOwner,
      });
      setCreatedInvitation(inv);
      toast.success(`Invitación generada para ${email}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || 'Error al enviar invitación';
      toast.error(msg);
    }
  };

  const getInviteUrl = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/invite/${token}`;
  };

  const handleCopyLink = async () => {
    if (!createdInvitation) return;
    const url = getInviteUrl(createdInvitation.token);
    try {
      await navigator.clipboard.writeText(url);
      setHasCopied(true);
      toast.success('¡Enlace de invitación copiado al portapapeles!');
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      toast.error('No se pudo copiar el enlace.');
    }
  };

  const handleShareWhatsApp = () => {
    if (!createdInvitation) return;
    const url = getInviteUrl(createdInvitation.token);
    const text = encodeURIComponent(
      `¡Hola! Te invito a unirte a "${propertyName}" en AptOS como ${createdInvitation.role}. Ingresa a través de este enlace para aceptar la invitación:\n${url}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Invitar Colaborador
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {propertyName ? `Acceso para ${propertyName}` : 'Acceso al apartamento'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {createdInvitation ? (
          <div className="p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  ¡Invitación lista para compartir!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Se ha generado un enlace exclusivo válido por 48 horas para{' '}
                  <strong className="font-semibold">{createdInvitation.email}</strong>{' '}
                  {createdInvitation.is_owner ? 'como 👑 Dueño / Copropietario con rol ' : 'con rol de '}
                  <span className="uppercase font-semibold tracking-wider text-[11px]">
                    {createdInvitation.role}
                  </span>
                  .
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Enlace de Invitación
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getInviteUrl(createdInvitation.token)}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 select-all focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer shrink-0"
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir por WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedInvitation(null);
                  setEmail('');
                }}
                className="px-4 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Invitar a otro
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Correo Electrónico del Usuario *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                El usuario podrá registrarse o iniciar sesión con este correo para acceder.
              </p>
            </div>

            {/* Titularidad / Dueño toggle */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-start gap-3 transition-colors">
              <input
                id="modal-is-owner"
                type="checkbox"
                checked={isOwner}
                onChange={(e) => setIsOwner(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="modal-is-owner" className="flex-1 cursor-pointer select-none">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Crown className="w-3.5 h-3.5 text-blue-500" />
                  <span>Marcar como Dueño / Copropietario</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Identifica a la persona como titular del apartamento. Podrá consultar las liquidaciones y reportes oficiales de ganancias.
                </p>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Nivel de Permisos / Rol Operativo *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {roleOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = role === opt.role;
                  return (
                    <button
                      type="button"
                      key={opt.role}
                      onClick={() => setRole(opt.role)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected ? opt.selectedCardClass : opt.unselectedCardClass
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg mt-0.5 shrink-0 transition-colors ${
                          isSelected ? opt.selectedIconClass : opt.unselectedIconClass
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {opt.title}
                          </span>
                          {isSelected && <ShieldCheck className={`w-4 h-4 ${opt.checkColor}`} />}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={inviteMutation.isPending || !email.trim()}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Crear Invitación</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
