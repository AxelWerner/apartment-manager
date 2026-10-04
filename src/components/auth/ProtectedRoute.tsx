import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { usePropertyContext } from '@/context/PropertyContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import type { UserRole } from '@/types/database';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps = {}) {
  const { user, role: globalRole, loading: authLoading } = useAuth();
  const propertyCtx = usePropertyContext();
  const location = useLocation();

  const loading = authLoading || (propertyCtx?.isLoading ?? false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Verificando acceso...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const propertyRole = propertyCtx?.role;
    const effectiveRole: UserRole =
      globalRole === 'SUPER_USER'
        ? 'SUPER_USER'
        : (propertyRole || globalRole || 'VIEWER');

    const isAllowed =
      effectiveRole === 'SUPER_USER' ||
      effectiveRole === 'PRIMARY_OWNER' ||
      Boolean(propertyCtx?.isPrimaryOwner) ||
      allowedRoles.includes(effectiveRole);

    if (!isAllowed) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Acceso no autorizado
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md">
            Tu rol actual ({effectiveRole || 'Sin rol'}) no cuenta con permisos suficientes para acceder a este módulo.
          </p>
        </div>
      );
    }
  }

  return children ? <>{children}</> : <Outlet />;
}
