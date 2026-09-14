import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import Dashboard from '@/routes/Dashboard';
import Bookings from '@/routes/Bookings';
import Expenses from '@/routes/Expenses';
import Damages from '@/routes/Damages';
import Settings from '@/routes/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/damages" element={<Damages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
