import { useState } from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  Receipt,
  ShieldAlert,
  Compass,
  Settings,
  Building2,
  CheckCircle2,
  LogOut,
  User as UserIcon,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useActiveProperty } from '@/context/PropertyContext';
import { PropertySwitcher } from '@/components/properties/PropertySwitcher';
import { CreatePropertyModal } from '@/components/properties/CreatePropertyModal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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
  const { properties, activePropertyId, role: propertyRole, isLoading } = useActiveProperty();
  const { user, role: globalRole, signOut } = useAuth();
  const location = useLocation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Si no tiene propiedades y está intentando acceder a una sub-ruta (/p/:id/...), redirigir a /
  if (!isLoading && properties.length === 0 && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }

  const hasProperties = properties.length > 0;
  const currentRole: UserRole = propertyRole || globalRole || 'VIEWER';
  const basePath = activePropertyId ? `/p/${activePropertyId}` : '';

  const allNavItems: Array<{
    to: string;
    pathSuffix: string;
    label: string;
    icon: typeof LayoutDashboard;
    roles?: UserRole[];
  }> = [
    { to: `${basePath}/dashboard`, pathSuffix: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER', 'VIEWER'] },
    { to: `${basePath}/analytics`, pathSuffix: '/analytics', label: 'Analíticas', icon: BarChart3, roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER', 'VIEWER'] },
    { to: `${basePath}/bookings`, pathSuffix: '/bookings', label: 'Reservas', icon: CalendarDays },
    { to: `${basePath}/expenses`, pathSuffix: '/expenses', label: 'Gastos y Servicios', icon: Receipt, roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER'] },
    { to: `${basePath}/damages`, pathSuffix: '/damages', label: 'Daños e Incidentes', icon: ShieldAlert },
    { to: `${basePath}/guest-guide`, pathSuffix: '/guest-guide', label: 'Guía Huésped', icon: Compass },
    { to: `${basePath}/settings`, pathSuffix: '/settings', label: 'Configuración', icon: Settings, roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER'] },
  ];

  const navItems = hasProperties
    ? allNavItems.filter((item) => !item.roles || item.roles.includes(currentRole))
    : [];

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
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto min-h-0">
          {hasProperties ? (
            navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.to ||
                (item.pathSuffix !== '/dashboard' && location.pathname.endsWith(item.pathSuffix)) ||
                (item.pathSuffix === '/dashboard' &&
                  (location.pathname === item.to ||
                    location.pathname === `${basePath}/` ||
                    location.pathname === `${basePath}`));

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
            })
          ) : null}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 shrink-0 bg-white dark:bg-slate-900 mt-auto">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>COP</span>
            </div>
            <ThemeToggle />
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
        {/* Desktop Top Navbar Header */}
        <header className="hidden md:flex sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-6 py-3 items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {hasProperties ? (
              <PropertySwitcher />
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 border border-dashed border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Añadir apartamento</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {hasProperties && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-rose-500 stroke-[2.5]" />
                <span>Nuevo Apto</span>
              </button>
            )}

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>COP</span>
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 pr-2">
            {hasProperties ? (
              <PropertySwitcher />
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-dashed border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Añadir Apartamento</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle className="text-[11px] px-2 py-1" />
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
      {hasProperties && (
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
      )}

      {/* Modal para crear apartamento */}
      <CreatePropertyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
