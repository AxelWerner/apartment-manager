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
  OPERATOR: {
    label: 'Gestor Operativo',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
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
  const { properties, activePropertyId, role: propertyRole, isOwner, isLoading } = useActiveProperty();
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
    title: string;
    description: string;
    icon: typeof LayoutDashboard;
    roles?: UserRole[];
  }> = [
      {
        to: `${basePath}/dashboard`,
        pathSuffix: '/dashboard',
        label: 'Dashboard',
        title: 'Dashboard de Rentabilidad',
        description: 'Monitoreo en tiempo real de ingresos, gastos y rentabilidad en Pesos Colombianos (COP)',
        icon: LayoutDashboard,
        roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER', 'OPERATOR', 'VIEWER'],
      },
      {
        to: `${basePath}/analytics`,
        pathSuffix: '/analytics',
        label: 'Analíticas',
        title: 'Analíticas del Apto',
        description: 'Indicadores de desempeño hotelero y rentabilidad',
        icon: BarChart3,
        roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER', 'OPERATOR', 'VIEWER'],
      },
      {
        to: `${basePath}/bookings`,
        pathSuffix: '/bookings',
        label: 'Reservas',
        title: 'Reservas e Ingresos',
        description: 'Control de estadías de Airbnb, reservas directas y carga de archivos CSV',
        icon: CalendarDays,
      },
      {
        to: `${basePath}/expenses`,
        pathSuffix: '/expenses',
        label: 'Gastos y Servicios',
        title: 'Gastos y Servicios del Apartamento',
        description: 'Administración, servicios públicos (EPM), seguro anual, insumos y limpiezas',
        icon: Receipt,
        roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER', 'OPERATOR'],
      },
      {
        to: `${basePath}/damages`,
        pathSuffix: '/damages',
        label: 'Daños e Incidentes',
        title: 'Daños e Incidentes del Apartamento',
        description: 'Inspecciones de check-out, fotos de evidencia, reclamos de AirCover y reembolsos',
        icon: ShieldAlert,
      },
      {
        to: `${basePath}/guest-guide`,
        pathSuffix: '/guest-guide',
        label: 'Guía Huésped',
        title: 'Guía Digital del Huésped',
        description: 'Configura la información visible para tus huéspedes, genera el código QR y comparte el enlace público',
        icon: Compass,
      },
      {
        to: `${basePath}/settings`,
        pathSuffix: '/settings',
        label: 'Configuración',
        title: 'Configuración del Apartamento',
        description: 'Datos de la propiedad, tarifas predeterminadas en COP, gestión de equipo y usuarios',
        icon: Settings,
        roles: ['SUPER_USER', 'ADMINISTRATOR', 'OWNER'],
      },
    ];

  const navItems = hasProperties
    ? allNavItems.filter((item) => !item.roles || item.roles.includes(currentRole))
    : [];

  const currentNavItem = allNavItems.find(
    (item) =>
      location.pathname === item.to ||
      (item.pathSuffix !== '/dashboard' && location.pathname.endsWith(item.pathSuffix)) ||
      (item.pathSuffix === '/dashboard' &&
        (location.pathname === item.to ||
          location.pathname === `${basePath}/` ||
          location.pathname === `${basePath}` ||
          location.pathname === '/'))
  );

  const PageIcon = currentNavItem?.icon || LayoutDashboard;
  const pageTitle = currentNavItem?.title || currentNavItem?.label || 'Dashboard';
  const pageDescription = currentNavItem?.description || '';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row pb-20 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 z-20">
        {/* Brand Header */}
        <div className="h-[88px] px-6 border-b border-slate-100 dark:border-slate-800 flex items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base leading-tight tracking-tight">AptOS</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Host Operating System</p>
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${isActive
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
                  <div className="flex items-center gap-1 mt-0.5">
                    {isOwner && (
                      <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                        👑 Dueño
                      </span>
                    )}
                    <span
                      className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border ${roleConfig[currentRole]?.badgeClass || 'bg-slate-100 text-slate-700'
                        }`}
                    >
                      {roleConfig[currentRole]?.label || currentRole}
                    </span>
                  </div>
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
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex h-[88px] sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-6 items-center justify-between gap-4 shrink-0">
          {/* Left: Page Title with Menu Icon & Description */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/40 shadow-2xs">
              <PageIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg text-slate-900 dark:text-white leading-tight tracking-tight truncate">
                {pageTitle}
              </h1>
              {pageDescription && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {pageDescription}
                </p>
              )}
            </div>
          </div>

          {/* Right: PropertySwitcher (bien a la derecha) */}
          <div className="flex items-center gap-3 shrink-0 ml-auto">
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
        </header>

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Left: Page Title with Menu Icon */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/40">
              <PageIcon className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
              {pageTitle}
            </h2>
          </div>

          {/* Right: Switcher, ThemeToggle and Signout */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {hasProperties && <PropertySwitcher />}
            <ThemeToggle className="text-[10px] px-1.5 py-1" />
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
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${isActive
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
