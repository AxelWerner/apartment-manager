import { useState } from 'react';
import {
  KeyRound,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Unlink,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Info,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import {
  usePropertyLock,
  useAccountLocks,
  useConnectTtlockAccount,
  useAssignPropertyLock,
  useUnlinkPropertyLock,
  useSavePropertyLock,
} from '@/hooks/use-ttlock';
import { toast } from 'sonner';

interface TtlockSettingsTabProps {
  propertyId: string;
  propertyName: string;
  isOwner: boolean;
  isPrimaryOwner?: boolean;
}

export function TtlockSettingsTab({
  propertyId,
  propertyName,
  isOwner,
  isPrimaryOwner = false,
}: TtlockSettingsTabProps) {
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isChangingLock, setIsChangingLock] = useState(false);
  const [selectedLockId, setSelectedLockId] = useState<string>('');
  const [unlinkModal, setUnlinkModal] = useState<'lock_only' | 'full_account' | null>(null);
  const [manualLockId, setManualLockId] = useState('');

  const { data: propertyLock, isLoading: isLockLoading } = usePropertyLock(propertyId);
  const hasAccount = Boolean(propertyLock?.access_token);
  const hasAssignedLock = Boolean(propertyLock?.lock_id);

  const {
    data: accountLocks = [],
    isLoading: isLoadingLocks,
    refetch: refetchLocks,
  } = useAccountLocks(propertyId, hasAccount);

  const connectMutation = useConnectTtlockAccount();
  const assignMutation = useAssignPropertyLock();
  const unlinkMutation = useUnlinkPropertyLock();
  const saveLockMutation = useSavePropertyLock();

  // Handle toggle active/inactive status (SOLO Super Dueño)
  const handleToggleLockActive = async () => {
    if (!isPrimaryOwner) {
      toast.error('Solo el Propietario Principal (Super Dueño) puede activar o desactivar la cerradura');
      return;
    }
    if (!propertyLock || !propertyLock.lock_id) return;
    const nextState = !propertyLock.is_active;
    try {
      await saveLockMutation.mutateAsync({
        ...propertyLock,
        property_id: propertyId,
        lock_id: propertyLock.lock_id,
        is_active: nextState,
      });
      toast.success(
        nextState
          ? 'Función de PIN y cerradura activada'
          : 'Función de PIN y cerradura desactivada'
      );
    } catch {
      toast.error('Error al actualizar el estado de la cerradura');
    }
  };

  // Handle in-app connection form submit
  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Por favor ingresa tu usuario y contraseña de TTLock');
      return;
    }

    try {
      const res = await connectMutation.mutateAsync({
        propertyId,
        username: username.trim(),
        password: password.trim(),
      });
      toast.success(res.message || '¡Cuenta TTLock conectada con éxito!');
      setIsConnectModalOpen(false);
      setPassword('');
      refetchLocks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al conectar con TTLock');
    }
  };

  // Handle assigning lock
  const handleAssignLock = async () => {
    const targetId = Number(selectedLockId || manualLockId);
    if (!targetId || isNaN(targetId)) {
      toast.error('Por favor selecciona o ingresa un ID de cerradura válido');
      return;
    }

    const chosenFromList = accountLocks.find((l) => l.lockId === targetId);
    const lockName = chosenFromList?.lockName || `Cerradura ${propertyName}`;
    const lockAlias = chosenFromList?.lockAlias || undefined;

    try {
      await assignMutation.mutateAsync({
        propertyId,
        lockId: targetId,
        lockName,
        lockAlias,
      });
      toast.success('Cerradura asignada y activada para este apartamento');
      setIsChangingLock(false);
      setSelectedLockId('');
      setManualLockId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar la cerradura');
    }
  };

  // Handle unlinking lock or account
  const handleConfirmUnlink = async () => {
    if (!unlinkModal) return;

    try {
      await unlinkMutation.mutateAsync({
        propertyId,
        unlinkType: unlinkModal,
      });

      if (unlinkModal === 'full_account') {
        toast.success('Cuenta TTLock desconectada completamente');
      } else {
        toast.success('Cerradura desvinculada del apartamento');
      }
      setUnlinkModal(null);
      setIsChangingLock(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desvincular');
    }
  };

  if (isLockLoading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Cargando información de cerradura...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cerraduras Inteligentes TTLock — {propertyName}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              Vincula la cerradura física de este apartamento para emitir códigos PIN de acceso seguro (One-Time de 6 horas) a tus huéspedes, auditar aperturas en tiempo real y evitar el uso de llaves físicas.
            </p>
          </div>
        </div>
      </div>

      {/* Case 1: No account connected */}
      {!hasAccount && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Lock className="w-7 h-7" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">
              Conecta tu cuenta de TTLock
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vincula de forma segura tu cuenta de la app TTLock para obtener tus cerraduras y programar códigos para tus reservas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              disabled={!isOwner}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 active:scale-[0.99] cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Conectar con TTLock</span>
            </button>
          </div>

          {!isOwner && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              * Solo los propietarios o administradores principales pueden conectar cerraduras.
            </p>
          )}
        </div>
      )}

      {/* Case 2: Account connected but no lock assigned OR user is changing lock */}
      {hasAccount && (!hasAssignedLock || isChangingLock) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cuenta TTLock Conectada
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {propertyLock?.account_email || 'Cuenta vinculada'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => refetchLocks()}
                disabled={isLoadingLocks}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Actualizar lista de cerraduras"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingLocks ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setUnlinkModal('full_account')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Desconectar Cuenta</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="space-y-1.5">
              <label htmlFor="lock-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Selecciona la cerradura de este apartamento:
              </label>
              <p className="text-xs text-slate-500">
                Elige cuál de las cerraduras vinculadas a tu cuenta corresponde a <strong className="text-slate-700 dark:text-slate-300">{propertyName}</strong>.
              </p>
            </div>

            {isLoadingLocks ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                <span>Consultando cerraduras en tu cuenta de TTLock...</span>
              </div>
            ) : accountLocks.length > 0 ? (
              <div className="space-y-3">
                <div className="relative">
                  <select
                    id="lock-select"
                    value={selectedLockId}
                    onChange={(e) => setSelectedLockId(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white appearance-none focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="">-- Elige una cerradura --</option>
                    {accountLocks.map((lock) => (
                      <option key={lock.lockId} value={lock.lockId}>
                        {lock.lockName || `Cerradura ${lock.lockId}`} (ID: {lock.lockId})
                        {lock.lockAlias ? ` — ${lock.lockAlias}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleAssignLock}
                    disabled={!selectedLockId || assignMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {assignMutation.isPending ? 'Guardando...' : 'Asignar y Activar Cerradura'}
                  </button>

                  {isChangingLock && (
                    <button
                      type="button"
                      onClick={() => setIsChangingLock(false)}
                      className="px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 rounded-xl space-y-3 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2 font-semibold">
                  <Info className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>No se encontraron cerraduras en esta cuenta</span>
                </div>
                <p>
                  Asegúrate de haber añadido primero la cerradura física en la aplicación móvil de TTLock con esta misma cuenta.
                </p>
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/60 space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    O ingresa el Lock ID manualmente si ya lo conoces:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Ej: 31266290"
                      value={manualLockId}
                      onChange={(e) => setManualLockId(e.target.value)}
                      className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAssignLock}
                      disabled={!manualLockId || assignMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer"
                    >
                      Asignar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Case 3: Lock Assigned */}
      {hasAccount && hasAssignedLock && !isChangingLock && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  propertyLock?.is_active
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {propertyLock?.lock_name || `Cerradura ${propertyName}`}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      propertyLock?.is_active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {propertyLock?.is_active ? 'Activa' : 'Desactivada'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  ID Cerradura: <span className="font-mono font-semibold">{propertyLock?.lock_id}</span>
                  {propertyLock?.account_email && ` • ${propertyLock.account_email}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle switch for Smart Lock PIN feature */}
              <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {propertyLock?.is_active ? 'Función Activa' : 'Función Desactivada'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(propertyLock?.is_active)}
                  onClick={handleToggleLockActive}
                  disabled={!isPrimaryOwner || saveLockMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    !isPrimaryOwner ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } disabled:opacity-40 ${
                    propertyLock?.is_active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  title={
                    !isPrimaryOwner
                      ? 'Solo el Propietario Principal (Super Dueño) puede activar o desactivar la cerradura'
                      : propertyLock?.is_active
                      ? 'Desactivar función de PIN de cerradura'
                      : 'Activar función de PIN de cerradura'
                  }
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      propertyLock?.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsChangingLock(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                Cambiar Cerradura
              </button>
              <button
                type="button"
                onClick={() => setUnlinkModal('lock_only')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900 transition-colors cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Desvincular</span>
              </button>
            </div>
          </div>

          {!isPrimaryOwner && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              * Solo el Propietario Principal (Super Dueño) tiene permisos para activar o desactivar la función de cerradura.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-slate-400">Tipo de PIN</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                One-Time Passcode (6 horas)
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-slate-400">Integración en Reservas</span>
              <p
                className={`font-bold flex items-center gap-1.5 ${
                  propertyLock?.is_active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {propertyLock?.is_active ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Habilitada en reservas
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Desactivada temporalmente
                  </>
                )}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-slate-400">Auditoría y Aperturas</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                Registro histórico persistente
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Connect TTLock Account */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Conectar Cuenta de TTLock
                  </h4>
                  <p className="text-xs text-slate-500">
                    {propertyName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Usuario o Correo de TTLock
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: usuario@gmail.com o teléfono"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Contraseña de TTLock
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Contraseña de tu app TTLock"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white pr-10 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1 leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Seguridad y Privacidad</span>
                </div>
                <p>
                  Tus credenciales se transmiten de forma cifrada a la API oficial de TTLock para obtener un token de acceso temporal. Tu contraseña nunca se guarda en nuestros servidores.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={connectMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {connectMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <span>Conectar y Buscar Cerraduras</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Unlinking */}
      {unlinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {unlinkModal === 'full_account'
                    ? '¿Desconectar cuenta de TTLock?'
                    : '¿Desvincular cerradura del apartamento?'}
                </h4>
                <p className="text-xs text-slate-500">
                  {propertyName}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <p>
                • <strong>Los códigos PIN emitidos anteriormente NO se borrarán</strong> de las reservas pasadas ni activas, garantizando el registro de auditoría.
              </p>
              <p>
                • No se podrán generar nuevos códigos PIN para este apartamento hasta que vuelvas a vincular una cerradura.
              </p>
              {unlinkModal === 'full_account' && (
                <p className="text-rose-600 dark:text-rose-400 font-medium">
                  • Se revocarán los tokens de acceso guardados para este apartamento.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUnlinkModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlink}
                disabled={unlinkMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {unlinkMutation.isPending
                  ? 'Procesando...'
                  : unlinkModal === 'full_account'
                  ? 'Sí, desconectar cuenta'
                  : 'Sí, desvincular cerradura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
