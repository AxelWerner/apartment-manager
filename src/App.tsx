import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { PropertyProvider, useActiveProperty } from '@/context/PropertyContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import Login from '@/routes/Login';
import Dashboard from '@/routes/Dashboard';
import Analytics from '@/routes/Analytics';
import Bookings from '@/routes/Bookings';
import Expenses from '@/routes/Expenses';
import Damages from '@/routes/Damages';
import Settings from '@/routes/Settings';
import GuestPortal from '@/routes/GuestPortal';
import GuestGuideAdmin from '@/routes/GuestGuideAdmin';
import WifiCardPage from '@/routes/WifiCardPage';
import GuestGuidePosterPage from '@/routes/GuestGuidePosterPage';

import { EmptyPropertyView } from '@/components/properties/EmptyPropertyView';

function RootView() {
  const { properties, isLoading } = useActiveProperty();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (properties.length === 0) {
    return <EmptyPropertyView />;
  }

  const storedId = localStorage.getItem('active_property_id');
  const targetId = properties.some((p) => p.property.id === storedId)
    ? storedId
    : properties[0]?.property.id;

  return <Navigate to={`/p/${targetId}/dashboard`} replace />;
}

function LegacyRedirect({ toSection }: { toSection: string }) {
  const { properties, activePropertyId, isLoading } = useActiveProperty();

  if (isLoading) {
    return null;
  }

  if (properties.length === 0 || !activePropertyId) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={`/p/${activePropertyId}/${toSection}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Rutas públicas (sin autenticación) */}
        <Route path="/login" element={<Login />} />
        <Route path="/guide" element={<GuestPortal />} />
        <Route path="/guide/:propertyId" element={<GuestPortal />} />
        <Route path="/guide/poster" element={<GuestGuidePosterPage />} />
        <Route path="/guide/poster/:propertyId" element={<GuestGuidePosterPage />} />
        <Route path="/wifi" element={<WifiCardPage />} />
        <Route path="/wifi/:propertyId" element={<WifiCardPage />} />

        {/* Rutas privadas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <PropertyProvider>
                <Outlet />
              </PropertyProvider>
            }
          >
            {/* Vista principal (vacia con drawer si es nuevo, o redirige al apto activo) */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<RootView />} />
              <Route path="/onboarding" element={<Navigate to="/" replace />} />
            </Route>

            {/* Redirecciones de compatibilidad */}
            <Route path="/dashboard" element={<LegacyRedirect toSection="dashboard" />} />
            <Route path="/analytics" element={<LegacyRedirect toSection="analytics" />} />
            <Route path="/bookings" element={<LegacyRedirect toSection="bookings" />} />
            <Route path="/expenses" element={<LegacyRedirect toSection="expenses" />} />
            <Route path="/damages" element={<LegacyRedirect toSection="damages" />} />
            <Route path="/guest-guide" element={<LegacyRedirect toSection="guest-guide" />} />
            <Route path="/settings" element={<LegacyRedirect toSection="settings" />} />

            {/* Rutas principales con prefijo de Apartamento: /p/:propertyId/... */}
            <Route path="/p/:propertyId" element={<AppLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMINISTRATOR', 'OWNER', 'VIEWER']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="analytics"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMINISTRATOR', 'OWNER', 'VIEWER']}>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route path="bookings" element={<Bookings />} />
              <Route
                path="expenses"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMINISTRATOR', 'OWNER']}>
                    <Expenses />
                  </ProtectedRoute>
                }
              />
              <Route path="damages" element={<Damages />} />
              <Route path="guest-guide" element={<GuestGuideAdmin />} />
              <Route
                path="settings"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMINISTRATOR', 'OWNER']}>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
