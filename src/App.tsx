import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import Login from '@/routes/Login';
import Dashboard from '@/routes/Dashboard';
import Bookings from '@/routes/Bookings';
import Expenses from '@/routes/Expenses';
import Damages from '@/routes/Damages';
import Settings from '@/routes/Settings';
import GuestPortal from '@/routes/GuestPortal';
import GuestGuideAdmin from '@/routes/GuestGuideAdmin';
import WifiCardPage from '@/routes/WifiCardPage';
import GuestGuidePosterPage from '@/routes/GuestGuidePosterPage';

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
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/damages" element={<Damages />} />
            <Route path="/guest-guide" element={<GuestGuideAdmin />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

