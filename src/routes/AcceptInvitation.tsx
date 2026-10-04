import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
  ArrowRight,
  Shield,
  Sparkles,
  MapPin,
  Clock,
  Crown,
  Briefcase,
  SlidersHorizontal,
  Sparkle,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchInvitationByToken,
  acceptPropertyInvitation,
  type InvitationDetails,
} from '@/lib/invitations-service';
import type { UserRole } from '@/types/database';
import { toast } from 'sonner';

const roleLabels: Record<
  UserRole,
  { label: string; description: string; icon: typeof Crown; colorClass: string }
> = {
  SUPER_USER: {
    label: 'Super User',
    description: 'Acceso total de plataforma',
    icon: Shield,
    colorClass: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800',
  },
  OWNER: {
    label: 'Dueño / Copropietario',
    description: 'Control financiero completo, administración y configuración',
    icon: Crown,
    colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
  },
  ADMINISTRATOR: {
    label: 'Administrador',
    description: 'Gestión de reservas, gastos, guía del huésped y equipo',
    icon: Briefcase,
    colorClass: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
  },
  OPERATOR: {
    label: 'Gestor Operativo',
    description: 'Operación diaria: reservas, gastos, guía del huésped y daños',
    icon: SlidersHorizontal,
    colorClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
  },
  CLEANER: {
    label: 'Personal de Limpieza',
    description: 'Control de calendario de entradas/salidas y reporte de incidencias',
    icon: Sparkle,
    colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
  },
  VIEWER: {
    label: 'Lector',
    description: 'Consulta de métricas e ingresos sin permisos de edición',
    icon: Eye,
    colorClass: 'text-slate-600 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  },
};

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [invitationData, setInvitationData] = useState<InvitationDetails | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!token) {
        setIsLoading(false);
        setErrorMessage('Enlace de invitación inválido o no especificado.');
        return;
      }

      setIsLoading(true);
      try {
        const data = await fetchInvitationByToken(token);
        if (ignore) return;
        if (!data) {
          setErrorMessage('La invitación no existe o ya no está disponible.');
        } else {
          setInvitationData(data);
        }
      } catch {
        if (!ignore) {
          setErrorMessage('Ocurrió un error al cargar la invitación.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    try {
      const result = await acceptPropertyInvitation(token);
      if (result.success && result.property_id) {
        toast.success('¡Te has unido con éxito al apartamento!');
        localStorage.setItem('active_property_id', result.property_id);
        // Recargar o navegar a dashboard
        window.location.href = `/p/${result.property_id}/dashboard`;
      } else {
        toast.error(result.error || 'No se pudo aceptar la invitación.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      toast.error(msg);
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Cargando invitación...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !invitationData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Invitación no disponible
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {errorMessage || 'Este enlace no es válido o ha sido revocado por el administrador.'}
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 transition-colors"
            >
              <span>Ir al Inicio de Sesión</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { invitation, property, isExpired } = invitationData;
  const roleInfo = roleLabels[invitation.role] || roleLabels.VIEWER;
  const RoleIcon = roleInfo.icon;

  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Invitación Expirada
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Esta invitación expiró el{' '}
            {new Date(invitation.expires_at).toLocaleDateString('es-CO', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
            . Pide al administrador del apartamento que te genere una nueva invitación.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors"
            >
              <span>Ir al Panel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Top Header */}
        <div className="p-8 text-center border-b border-slate-100 dark:border-slate-800 bg-gradient-to-b from-rose-50/50 dark:from-rose-950/20 to-transparent">
          <div className="w-16 h-16 rounded-2xl bg-rose-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-600/30 mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Invitación para colaborar</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {property?.name || 'Apartamento'}
          </h1>
          {property?.city && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {property.city}
                {property.address ? ` • ${property.address}` : ''}
              </span>
            </p>
          )}
        </div>

        {/* Content Body */}
        <div className="p-8 space-y-6">
          {/* Role info pill */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${roleInfo.colorClass}`}
          >
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 shadow-xs shrink-0 mt-0.5">
              <RoleIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-75">
                Rol Asignado
              </div>
              <div className="text-sm font-bold mt-0.5">{roleInfo.label}</div>
              <div className="text-xs opacity-90 mt-1 leading-snug">
                {roleInfo.description}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Invitación enviada a:{' '}
            <strong className="font-semibold text-slate-700 dark:text-slate-200">
              {invitation.email}
            </strong>
          </div>

          {/* Action based on auth */}
          {user ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>Sesión activa como:</span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  {user.email}
                </strong>
              </div>

              <button
                type="button"
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-lg shadow-rose-600/25 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uniéndote al apartamento...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Aceptar Invitación y Entrar</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                Para aceptar esta invitación, debes iniciar sesión con tu cuenta o registrarte en AptOS con tu correo.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate(`/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`)
                }
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Iniciar Sesión para Aceptar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
