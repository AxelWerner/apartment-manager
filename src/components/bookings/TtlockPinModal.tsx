import { useState, useEffect, useContext, useCallback } from 'react';
import {
  KeyRound,
  X,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Lock,
  History,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { AuthContext } from '@/context/auth-context-def';
import { useGenerateTtlockPin, useSyncTtlockPins } from '@/hooks/use-ttlock';
import { verifyPinOnLock } from '@/lib/ttlock-service';
import { formatDate, getColombiaDateTime } from '@/lib/formatters';
import { checkBookingPinEligibility } from '@/lib/ttlock-eligibility';
import type { Booking, BookingTtlockPin } from '@/types/database';

interface TtlockPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  allBookings?: Booking[];
  existingPins?: BookingTtlockPin[];
  todayStr?: string;
  onPinGenerated?: (pin: BookingTtlockPin) => void;
}

function formatDateTime(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

export function TtlockPinModal({
  isOpen,
  onClose,
  booking,
  allBookings = [],
  existingPins = [],
  todayStr,
  onPinGenerated,
}: TtlockPinModalProps) {
  const [newlyGeneratedPin, setNewlyGeneratedPin] = useState<BookingTtlockPin | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    verified: boolean;
    message: string;
  } | null>(null);

  const auth = useContext(AuthContext);
  const currentUserName = auth?.profile?.full_name || auth?.user?.email || 'Usuario';

  const generatePinMutation = useGenerateTtlockPin();
  const syncPinsMutation = useSyncTtlockPins();

  const bookingId = booking?.id;
  const effectiveToday = todayStr || getColombiaDateTime().dateStr;

  // History of pins for this specific booking
  const bookingHistory = bookingId
    ? existingPins.filter((p) => p.booking_id === bookingId)
    : [];
  const validGeneratedPin =
    newlyGeneratedPin && !existingPins.some((p) => p.id === newlyGeneratedPin.id && p.status !== 'active')
      ? newlyGeneratedPin
      : null;

  const rawBookingPins =
    validGeneratedPin && !bookingHistory.some((p) => p.id === validGeneratedPin.id)
      ? [validGeneratedPin, ...bookingHistory]
      : bookingHistory;
  const allBookingPins = [...rawBookingPins].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  // Active / current pin
  const activePin = allBookingPins.find(
    (p) => p.status === 'active' || p.status === 'mock'
  );

  const handleClose = useCallback(() => {
    setNewlyGeneratedPin(null);
    setCopiedId(null);
    setVerificationStatus(null);
    onClose();
  }, [onClose]);

  // Automatically verify whether pins are still configured or used when opening modal
  useEffect(() => {
    if (!isOpen || !bookingId || allBookingPins.length === 0) return;
    const lockIdToSync = activePin?.lock_id ?? allBookingPins[0]?.lock_id ?? undefined;
    syncPinsMutation.mutate({
      pins: allBookingPins,
      lockId: lockIdToSync,
      propertyId: booking.property_id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bookingId]);

  // Lock background body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  if (!isOpen || !booking) return null;

  // Evaluate eligibility with the 2-reservation rule
  const eligibility = checkBookingPinEligibility(
    booking,
    allBookings.length > 0 ? allBookings : [booking],
    allBookingPins,
    effectiveToday
  );

  const isFutureRestricted =
    !eligibility.canGenerate &&
    (eligibility.reason === 'not_in_7_days_window' ||
      eligibility.reason === 'not_closest_booking');

  const handleGenerate = async () => {
    try {
      const pinObj = await generatePinMutation.mutateAsync({
        bookingId: booking.id,
        propertyId: booking.property_id,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guestName: booking.guest_name,
        generatedBy: currentUserName,
      });
      setNewlyGeneratedPin(pinObj);
      setVerificationStatus({
        verified: true,
        message: 'PIN creado y programado exitosamente en la cerradura física TTLock.',
      });
      toast.success('One-Time PIN generado y programado en TTLock exitosamente');
      onPinGenerated?.(pinObj);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar PIN';
      toast.error(msg);
    }
  };

  const handleVerifyAndSync = async () => {
    if (!activePin) return;
    setIsVerifying(true);
    try {
      const verifyRes = await verifyPinOnLock(
        activePin.pin,
        activePin.lock_id ?? undefined,
        booking.property_id
      );

      await syncPinsMutation.mutateAsync({
        pins: allBookingPins,
        lockId: activePin.lock_id ?? undefined,
        propertyId: booking.property_id,
      });

      if (verifyRes.verified) {
        setVerificationStatus({
          verified: true,
          message: `Confirmado en cerradura física (ID TTLock: ${verifyRes.keyboardPwdId}).`,
        });
        toast.success(`PIN ${activePin.pin} verificado en la cerradura física`);
      } else {
        setNewlyGeneratedPin(null);
        setVerificationStatus({
          verified: false,
          message: 'El código no figura en la cerradura física. Ha sido marcado como Borrado / Desactivado.',
        });
        toast.warning('El código no se encontró en la cerradura TTLock. Marcado como borrado/desactivado.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar la cerradura';
      toast.error(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopy = async (pinText: string, id: string) => {
    if (!pinText) return;
    try {
      await navigator.clipboard.writeText(pinText);
      setCopiedId(id);
      toast.success(`PIN ${pinText} copiado al portapapeles`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast.error('No se pudo copiar automáticamente');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ttlock-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="ttlock-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white leading-tight"
              >
                Cerradura TTLock
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestión y emisión de códigos PIN
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 flex flex-col flex-1 min-h-0 overflow-hidden space-y-4">
          {/* Static Top Section (Guest Details, Active PIN, Generator/Alert) - ALWAYS VISIBLE */}
          <div className="flex-shrink-0 space-y-3.5">
            {/* Guest and Stay Details */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Huésped:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {booking.guest_name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Entrada / Salida:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {formatDate(booking.check_in)} → {formatDate(booking.check_out)}
              </span>
            </div>
            {booking.airbnb_confirmation_code && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Código Airbnb:</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {booking.airbnb_confirmation_code}
                </span>
              </div>
            )}
          </div>

          {/* Active PIN Section (if exists) */}
          {activePin && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>PIN Activo de Apertura</span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                  {activePin.is_mock ? 'Simulación Activa' : 'Activo en Cerradura'}
                </span>
              </div>

              <div className="bg-gradient-to-b from-amber-50 to-orange-50 dark:from-slate-800/80 dark:to-amber-950/30 border-2 border-amber-300/80 dark:border-amber-700/60 rounded-2xl p-5 shadow-inner flex flex-col items-center justify-center">
                <span className="text-[11px] uppercase tracking-widest font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  Código Huésped (One-Time — 6 horas)
                </span>
                <span
                  data-testid="ttlock-pin-number"
                  className="font-mono text-4xl sm:text-5xl font-black tracking-widest text-slate-900 dark:text-white drop-shadow-xs"
                >
                  {activePin.pin}
                </span>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                  <span>Emitido: {formatDateTime(activePin.created_at)}</span>
                  <span>•</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Válido hasta: {formatDateTime(activePin.valid_to)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(activePin.pin, activePin.id)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-all shadow-sm active:scale-[0.99]"
                >
                  {copiedId === activePin.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleVerifyAndSync}
                  disabled={isVerifying}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all disabled:opacity-50 active:scale-[0.99]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                  <span>{isVerifying ? 'Verificando...' : 'Corroborar en Lock'}</span>
                </button>
              </div>

              {verificationStatus && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    verificationStatus.verified
                      ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-50/90 border-amber-200/80 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                  }`}
                >
                  {verificationStatus.verified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span className="leading-tight">{verificationStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {/* PIN Generation Action / Rule Restriction Alert */}
          {eligibility.canGenerate ? (
            <div className="space-y-3 pt-1">
              {!activePin && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-xs text-amber-900 dark:text-amber-300">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Código de Acceso Seguro (One-Time — 6 horas)</span>
                  </div>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                    Código de un solo uso válido durante 6 horas desde su creación. Al ser generado
                    algorítmicamente por TTLock, no consume el límite de pines personalizados de la cuenta.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generatePinMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 active:scale-[0.99]"
              >
                {generatePinMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Programando Cerradura...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>
                      {activePin ? 'Generar Nuevo One-Time PIN' : 'Confirmar y Generar One-Time PIN'}
                    </span>
                  </>
                )}
              </button>
            </div>
          ) : !activePin ? (
            /* Restriction Message (Cannot generate PIN - only shown if no active PIN is displayed) */
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                {eligibility.reason === 'past_booking' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <span>
                  {eligibility.reason === 'past_booking'
                    ? 'Reserva Finalizada'
                    : 'Generación no disponible'}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {eligibility.message}
              </p>
            </div>
          ) : null}
          </div>

          {/* Historial de Códigos PIN (Oculto en reservas futuras con generación bloqueada) */}
          {!isFutureRestricted && (
            <div className="flex-1 min-h-0 flex flex-col pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between pb-2 flex-shrink-0">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Historial de Códigos ({allBookingPins.length})</span>
                </h4>
                <span className="text-[10px] text-slate-400">
                  Auditoría y registros de apertura
                </span>
              </div>

              {allBookingPins.length === 0 ? (
                <div className="p-3 text-center rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                  No se ha emitido ningún código PIN para esta reserva todavía.
                </div>
              ) : (
                <div className="overflow-y-auto space-y-2 pr-1 max-h-[190px] sm:max-h-[230px]">
                  {allBookingPins.map((pinItem) => {
                    const isUsed = pinItem.status === 'used';
                    const isRevoked = pinItem.status === 'revoked';
                    const isThisActive = pinItem.status === 'active' || pinItem.status === 'mock';

                    return (
                      <div
                        key={pinItem.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                              {pinItem.pin}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isUsed
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : isRevoked
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                  : isThisActive
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {isUsed
                                ? 'Usado'
                                : isRevoked
                                ? 'Borrado / Desactivado'
                                : isThisActive
                                ? 'Activo'
                                : pinItem.status}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>Creado: {formatDateTime(pinItem.created_at)}</span>
                            </div>
                            {pinItem.generated_by && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>
                                  Generado por:{' '}
                                  <strong className="font-medium text-slate-700 dark:text-slate-300">
                                    {pinItem.generated_by}
                                  </strong>
                                </span>
                              </div>
                            )}
                          </div>
                          {isUsed && pinItem.used_at && (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Apertura registrada: {formatDateTime(pinItem.used_at)}</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopy(pinItem.pin, pinItem.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                          title="Copiar PIN"
                        >
                          {copiedId === pinItem.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
