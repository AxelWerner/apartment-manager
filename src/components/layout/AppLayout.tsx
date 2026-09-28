import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Receipt,
  ShieldAlert,
  Compass,
  Settings,
  Building2,
  CheckCircle2,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useProperty } from '@/hooks/use-property';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/types/database';

const roleConfig: Record<UserRole, { label: string; badgeClass: string }> = {
  SUPER_USER: {
    label: 'Super User',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  ADMINISTRATOR: {
    label: 'Admin',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  OWNER: {
    label: 'Dueño',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  CLEANER: {
    label: 'Limpieza',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  VIEWER: {
    label: 'Lector',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
};

export function AppLayout() {
  const { data: property } = useProperty();
  const { user, role, signOut } = useAuth();
  const location = useLocation();

  const currentRole: UserRole = role || 'VIEWER';

  const allNavItems: Array<{
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    roles?: UserRole[];
  }> = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER', 'VIEWER'] },
    { to: '/bookings', label: 'Reservas', icon: CalendarDays },
    { to: '/expenses', label: 'Gastos y Servicios', icon: Receipt, roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER'] },
    { to: '/damages', label: 'Daños e Incidentes', icon: ShieldAlert },
    { to: '/guest-guide', label: 'Guía Huésped', icon: Compass },
    { to: '/settings', label: 'Configuración', icon: Settings, roles: ['SUPER_USER', 'ADMINISTRATOR'] },
  ];

  const navItems = allNavItems.filter((item) => !item.roles || item.roles.includes(currentRole));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row pb-20 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 z-20">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Apto Manager</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Airbnb Host Suite</p>
            </div>
          </div>

          {/* Active Property Badge */}
          <div className="mt-4 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {property?.name || 'Apto 502 - Medellín'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                {property?.city || 'Medellín'} • COP
              </p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" title="Sincronizado" />
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 shrink-0 bg-white dark:bg-slate-900 mt-auto">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Moneda: <strong>Pesos (COP)</strong></span>
          </div>

          {user && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate" title={user.email}>
                    {user.email}
                  </p>
                  <span
                    className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                      roleConfig[currentRole]?.badgeClass || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {roleConfig[currentRole]?.label || currentRole}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">{property?.name || 'Apto Manager'}</h1>
              <p className="text-[10px] text-slate-400">COP • Medellín</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                roleConfig[currentRole]?.badgeClass || 'bg-slate-100 text-slate-700'
              }`}
            >
              {roleConfig[currentRole]?.label || currentRole}
            </span>
            {user && (
              <button
                type="button"
                onClick={() => signOut()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.2]' : 'stroke-1.5'}`} />
              <span className="truncate max-w-[60px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
