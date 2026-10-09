import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useSEO } from '@/hooks/use-seo';
import { Building2, Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

function getInitialUrlError(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash || window.location.search);
  const errorDesc = params.get('error_description');
  const errorCode = params.get('error_code');

  if (errorCode === 'otp_expired' || errorDesc?.toLowerCase().includes('expired')) {
    window.history.replaceState(null, '', window.location.pathname);
    return 'El enlace de verificación ha expirado. Por favor solicita uno nuevo.';
  } else if (errorDesc) {
    window.history.replaceState(null, '', window.location.pathname);
    return decodeURIComponent(errorDesc.replace(/\+/g, ' '));
  }
  return null;
}

export default function Login() {
  const { user, signIn, signUp, resendConfirmationEmail, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useSEO({
    title: 'Iniciar Sesión',
    description: 'Accede a AptOS para gestionar tus apartamentos turísticos, reservas de Airbnb, finanzas y cerraduras.',
  });

  const [mode, setMode] = useState<'signin' | 'signup' | 'verification_pending'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(getInitialUrlError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Redirigir si ya tiene sesión iniciada
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  if (!authLoading && user) {
    return <Navigate to={from} replace />;
  }

  const handleResend = async (targetEmail?: string) => {
    const mailToUse = targetEmail || email.trim();
    if (!mailToUse) {
      setErrorMessage('Ingresa tu correo para reenviar la confirmación.');
      return;
    }
    if (!resendConfirmationEmail) {
      setErrorMessage('No se puede reenviar el correo en este momento.');
      return;
    }

    setIsResending(true);
    setResendStatus(null);
    try {
      const { error } = await resendConfirmationEmail(mailToUse);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setResendStatus('¡Correo de verificación reenviado! Revisa tu bandeja de entrada o spam.');
      }
    } catch {
      setErrorMessage('Error al reenviar el correo de confirmación.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setResendStatus(null);

    if (mode === 'signin') {
      if (!email || !password) {
        setErrorMessage('Por favor ingresa tu correo y contraseña.');
        return;
      }

      setIsSubmitting(true);
      try {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMessage('Credenciales inválidas. Verifica tu correo y contraseña.');
            setUnconfirmedEmail(null);
          } else if (error.message.toLowerCase().includes('email not confirmed')) {
            setErrorMessage('Email not confirmed');
            setUnconfirmedEmail(email.trim());
          } else {
            setErrorMessage(error.message);
            setUnconfirmedEmail(null);
          }
        } else {
          navigate(from, { replace: true });
        }
      } catch {
        setErrorMessage('Ocurrió un error inesperado al iniciar sesión.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Modo Registro (Sign Up)
      if (!email || !password || !fullName) {
        setErrorMessage('Por favor completa todos los campos.');
        return;
      }

      if (password.length < 6) {
        setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Las contraseñas no coinciden.');
        return;
      }

      if (!signUp) {
        setErrorMessage('El servicio de registro no está disponible temporalmente.');
        return;
      }

      setIsSubmitting(true);
      try {
        const { data, error } = await signUp(email.trim(), password, fullName.trim());
        if (error) {
          if (error.message.includes('already registered')) {
            setErrorMessage('Este correo ya está registrado. Intenta iniciar sesión.');
          } else {
            setErrorMessage(error.message);
          }
        } else if (data?.session) {
          // Sesión iniciada automáticamente
          navigate(from, { replace: true });
        } else {
          // Requiere confirmación de correo
          setMode('verification_pending');
          setPassword('');
          setConfirmPassword('');
        }
      } catch {
        setErrorMessage('Ocurrió un error inesperado al crear la cuenta.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Logo & Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 mb-4">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            AptOS
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'signin'
              ? 'Acceso privado para administración de propiedades'
              : 'Regístrate para empezar a gestionar tus apartamentos'}
          </p>
        </div>

        {/* Card Form */}
        <div className="mt-8 bg-white dark:bg-slate-900 py-8 px-6 shadow-xl shadow-slate-200/50 dark:shadow-none sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 sm:px-10">
          {mode === 'verification_pending' ? (
            <div className="text-center py-2 space-y-5">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-500 shadow-sm shadow-rose-500/10">
                <Mail className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Verifica tu correo electrónico
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Hemos enviado un enlace de confirmación a:
                </p>
                <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-sm font-semibold text-slate-800 dark:text-slate-200 break-all">
                  {email || 'tu correo'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto pt-1 leading-relaxed">
                  Haz clic en el enlace para activar tu cuenta. Si no lo encuentras en unos minutos, revisa tu carpeta de spam o correo no deseado.
                </p>
              </div>

              {resendStatus && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{resendStatus}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled={isResending}
                  onClick={() => handleResend(email)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-900/50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Reenviando correo...</span>
                    </>
                  ) : (
                    <span>¿No recibiste el correo? Reenviar confirmación</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setResendStatus(null);
                    setUnconfirmedEmail(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Volver a Iniciar sesión
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Switch Tabs */}
              <div role="tablist" aria-label="Modo de autenticación" className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl mb-6">
                <button
                  role="tab"
                  aria-selected={mode === 'signin'}
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setResendStatus(null);
                    setUnconfirmedEmail(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'signup'}
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setResendStatus(null);
                    setUnconfirmedEmail(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Crear cuenta
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-sm space-y-2">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                    {unconfirmedEmail && (
                      <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-xs">
                        <span>¿No te llegó el correo?</span>
                        <button
                          type="button"
                          disabled={isResending}
                          onClick={() => handleResend(unconfirmedEmail)}
                          className="font-semibold underline hover:text-rose-800 dark:hover:text-rose-300 cursor-pointer disabled:opacity-50"
                        >
                          {isResending ? 'Reenviando...' : 'Reenviar verificación'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {resendStatus && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resendStatus}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Nombre completo
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required={mode === 'signup'}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Correo electrónico
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-colors"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
                >
                  Confirmar contraseña
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required={mode === 'signup'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-500/25 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === 'signin' ? 'Ingresando...' : 'Creando cuenta...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Ingresar al panel' : 'Crear mi cuenta'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
            {mode === 'signin' ? (
              <span>
                ¿Aún no tienes cuenta?{' '}
                <button
                  type="button"
                  role="link"
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 underline underline-offset-2 cursor-pointer"
                >
                  Regístrate aquí
                </button>
              </span>
            ) : (
              <span>
                ¿Ya tienes una cuenta?{' '}
                <button
                  type="button"
                  role="link"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 underline underline-offset-2 cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </span>
            )}
          </div>
        </>
      )}
    </div>

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          Protegido con autenticación de Supabase
        </div>
      </div>
    </div>
  );
}
