import { useState, useEffect } from 'react';
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
  Sparkles,
  Menu,
  X,
  Sun,
  Moon,
  Laptop,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useActiveProperty } from '@/context/PropertyContext';
import { PropertySwitcher } from '@/components/properties/PropertySwitcher';
import { CreatePropertyModal } from '@/components/properties/CreatePropertyModal';
import { InvitationsBell } from '@/components/invitations/InvitationsBell';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AiAssistantDrawer } from '@/components/ai/AiAssistantDrawer';
import {
  getThemePreference,
  setThemePreference,
  THEME_CHANGE_EVENT,
  type ThemePreference,
} from '@/lib/theme';
import type { UserRole } from '@/types/database';

const roleConfig: Record<UserRole, { label: string; badgeClass: string }> = {
  SUPER_USER: {
    label: 'Super User',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  PRIMARY_OWNER: {
    label: 'Dueño Principal',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  },
  OWNER: {
    label: 'Dueño',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  ADMINISTRATOR: {
    label: 'Admin',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  OPERATOR: {
    label: 'Gestor Operativo',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
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
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [themePreference, setThemePrefState] = useState<ThemePreference>(getThemePreference());

  // Shortcut Cmd+J / Ctrl+J to toggle AI drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsAiDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleUpdate = () => setThemePrefState(getThemePreference());
    window.addEventListener('storage', handleUpdate);
    window.addEventListener(THEME_CHANGE_EVENT, handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener(THEME_CHANGE_EVENT, handleUpdate);
    };
  }, []);

  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setIsMobileMenuOpen(false);
  }

  // Manejar tecla Escape y bloqueo de scroll al abrir menú móvil
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    }
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const activeProperty = properties.find((p) => p.property.id === activePropertyId)?.property;

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
    shortLabel: string;
    title: string;
    description: string;
    icon: typeof LayoutDashboard;
    roles?: UserRole[];
  }> = [
    {
      to: `${basePath}/dashboard`,
      pathSuffix: '/dashboard',
      label: 'Dashboard',
      shortLabel: 'Dashboard',
      title: 'Dashboard de Rentabilidad',
      description: 'Monitoreo en tiempo real de ingresos, gastos y rentabilidad en Pesos Colombianos (COP)',
      icon: LayoutDashboard,
      roles: ['SUPER_USER', 'PRIMARY_OWNER', 'OWNER', 'ADMINISTRATOR', 'OPERATOR', 'VIEWER'],
    },
    {
      to: `${basePath}/analytics`,
      pathSuffix: '/analytics',
      label: 'Analíticas',
      shortLabel: 'Analíticas',
      title: 'Analíticas del Apto',
      description: 'Indicadores de desempeño hotelero y rentabilidad',
      icon: BarChart3,
      roles: ['SUPER_USER', 'PRIMARY_OWNER', 'OWNER', 'ADMINISTRATOR', 'OPERATOR', 'VIEWER'],
    },
    {
      to: `${basePath}/bookings`,
      pathSuffix: '/bookings',
      label: 'Reservas',
      shortLabel: 'Reservas',
      title: 'Reservas e Ingresos',
      description: 'Control de estadías de Airbnb, reservas directas y carga de archivos CSV',
      icon: CalendarDays,
      roles: ['SUPER_USER', 'PRIMARY_OWNER', 'OWNER', 'ADMINISTRATOR', 'OPERATOR', 'CLEANER', 'VIEWER'],
    },
    {
      to: `${basePath}/expenses`,
      pathSuffix: '/expenses',
      label: 'Gastos y Servicios',
      shortLabel: 'Gastos',
      title: 'Gastos y Servicios del Apartamento',
      description: 'Administración, servicios públicos (EPM), seguro anual, insumos y limpiezas',
      icon: Receipt,
      roles: ['SUPER_USER', 'PRIMARY_OWNER', 'OWNER', 'ADMINISTRATOR', 'OPERATOR'],
    },
    {
      to: `${basePath}/damages`,
      pathSuffix: '/damages',
      label: 'Daños e Incidentes',
      shortLabel: 'Daños',
      title: 'Daños e Incidentes del Apartamento',
      description: 'Inspecciones de check-out, fotos de evidencia, reclamos de AirCover y reembolsos',
      icon: ShieldAlert,
      roles: ['SUPER_USER', 'PRIMARY_OWNER', 'OWNER', 'ADMINISTRATOR', 'OPERATOR', 'CLEANER', 'VIEWER'],
    },
    {
      to: `${basePath}/guest-guide`,
      pathSuffix: '/guest-guide',
      label: 'Guía Huésped',
      shortLabel: 'Guía',
      title: 'Guía Digital del Huésped',
      description: 'Configura la información visible para tus huéspedes, genera el código QR y comparte el enlace público',
      icon: Compass,
      roles: ['SUPER_USER', 'PRIMARY_OWNER'],
    },
    {
      to: `${basePath}/settings`,
      pathSuffix: '/settings',
      label: 'Configuración',
      shortLabel: 'Ajustes',
      title: 'Configuración del Apartamento',
      description: 'Datos de la propiedad, tarifas predeterminadas en COP, gestión de equipo y usuarios',
      icon: Settings,
      roles: ['SUPER_USER', 'PRIMARY_OWNER', 'OWNER', 'ADMINISTRATOR'],
    },
  ];

  const isUserPrimaryOwner = currentRole === 'PRIMARY_OWNER' || currentRole === 'SUPER_USER';

  const navItems = hasProperties
    ? allNavItems.filter((item) => isUserPrimaryOwner || !item.roles || item.roles.includes(currentRole))
    : [];

  // Organizar navegación móvil: máximo 4 items principales + 1 botón "Más"
  const primaryOrder = ['/dashboard', '/bookings', '/expenses', '/analytics'];
  const primaryNavItems: typeof navItems =
    navItems.length <= 4
      ? navItems
      : (() => {
          const preferredItems = primaryOrder
            .map((path) => navItems.find((item) => item.pathSuffix === path))
            .filter((item): item is typeof navItems[0] => item !== undefined);

          const remaining = navItems.filter((item) => !preferredItems.includes(item));
          return [...preferredItems, ...remaining].slice(0, 4);
        })();

  const secondaryNavItems: typeof navItems =
    navItems.length <= 4 ? [] : navItems.filter((item) => !primaryNavItems.includes(item));

  const isMoreActive = secondaryNavItems.some(
    (item) =>
      location.pathname === item.to ||
      (item.pathSuffix !== '/dashboard' && location.pathname.endsWith(item.pathSuffix))
  );

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
  const pageShortTitle = currentNavItem?.shortLabel || currentNavItem?.label || 'Dashboard';
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
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                        roleConfig[currentRole]?.badgeClass || 'bg-slate-100 text-slate-700'
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

          {/* Right: Actions, AI Assistant, PropertySwitcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-rose-500/10 hover:from-amber-500/20 hover:via-indigo-500/20 hover:to-rose-500/20 border border-amber-300/50 dark:border-indigo-700/50 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all hover:scale-[1.02] shadow-2xs cursor-pointer group"
              title="Abrir Asistente Financiero IA (Cmd+J)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>Asistente IA</span>
            </button>
            <InvitationsBell />
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

        {/* Mobile Header (Sleek, Compact, No Overflow) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-1.5">
          {/* Left: Page Title with Menu Icon */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/40">
              <PageIcon className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[95px] xs:max-w-[130px]">
              {pageShortTitle}
            </h2>
          </div>

          {/* Right: AI Assistant, PropertySwitcher (compact), Invitations, ThemeToggle and Signout */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(true)}
              className="p-1.5 rounded-lg bg-amber-50 dark:bg-indigo-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-indigo-800/60"
              title="Asistente IA"
              aria-label="Asistente IA"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            {hasProperties ? (
              <PropertySwitcher compact />
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-dashed border-rose-300 dark:border-rose-800 text-xs font-semibold transition-colors cursor-pointer"
                title="Añadir apartamento"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
            <InvitationsBell />
            <ThemeToggle showLabel={false} className="w-8 h-8 p-0" />
            {user && (
              <button
                type="button"
                onClick={() => signOut()}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 transition-colors shrink-0 cursor-pointer"
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

      {/* Mobile Bottom Navigation Bar (Max 4 primary tabs + 'Más' button) */}
      {hasProperties && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 flex items-center justify-around px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.to ||
              (item.pathSuffix !== '/dashboard' && location.pathname.endsWith(item.pathSuffix)) ||
              (item.pathSuffix === '/dashboard' &&
                (location.pathname === item.to ||
                  location.pathname === `${basePath}/` ||
                  location.pathname === `${basePath}` ||
                  location.pathname === '/'));

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[10px] font-medium transition-all flex-1 max-w-[72px] ${
                  isActive
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : ''
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-1.5'}`} />
                </div>
                <span className="truncate w-full text-center tracking-tight mt-0.5">
                  {item.shortLabel || item.label}
                </span>
              </NavLink>
            );
          })}

          {secondaryNavItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-xl text-[10px] font-medium transition-all flex-1 max-w-[72px] cursor-pointer ${
                isMoreActive
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              aria-label="Más opciones de menú"
            >
              <div
                className={`p-1 rounded-lg relative transition-colors ${
                  isMoreActive ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : ''
                }`}
              >
                <Menu className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.2]' : 'stroke-1.5'}`} />
                {isMoreActive && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </div>
              <span className="truncate w-full text-center tracking-tight mt-0.5">Más</span>
            </button>
          )}
        </nav>
      )}

      {/* Mobile "Más" Bottom Sheet Drawer */}
      {hasProperties && isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div
            className="relative bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200/90 dark:border-slate-800 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 pb-[max(1rem,env(safe-area-inset-bottom))]"
            role="dialog"
            aria-modal="true"
            aria-label="Menú y navegación"
          >
            {/* Handle bar */}
            <div className="pt-3 pb-1.5 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Sheet Header */}
            <div className="px-5 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                    Menú y Opciones
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    AptOS · Acceso rápido
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Cerrar menú"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-left">
              {/* Secondary Navigation Items */}
              {secondaryNavItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                    Más Secciones
                  </p>
                  <div className="space-y-1.5">
                    {secondaryNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        location.pathname === item.to ||
                        (item.pathSuffix !== '/dashboard' && location.pathname.endsWith(item.pathSuffix));

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            isActive
                              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-900/50 text-rose-950 dark:text-rose-100 shadow-2xs'
                              : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isActive
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold truncate">{item.label}</p>
                              {isActive ? (
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950 px-2 py-0.5 rounded-full">
                                  Activo
                                </span>
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Theme Preference Segmented Control */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                  Tema Visual
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setThemePreference('light')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      themePreference === 'light'
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400 shadow-2xs font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Claro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemePreference('dark')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      themePreference === 'dark'
                        ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Oscuro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemePreference('system')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      themePreference === 'system'
                        ? 'bg-slate-500/10 border-slate-500/50 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sistema</span>
                  </button>
                </div>
              </div>

              {/* User Account & Logout */}
              {user && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 pr-1">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={user.email}>
                          {user.email}
                        </p>
                        <span
                          className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border mt-0.5 ${
                            roleConfig[currentRole]?.badgeClass || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {roleConfig[currentRole]?.label || currentRole}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        signOut();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/40 transition-colors shrink-0 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear apartamento */}
      <CreatePropertyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Drawer del Asistente Financiero IA */}
      <AiAssistantDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        activePropertyId={activePropertyId ?? undefined}
        propertyName={activeProperty?.name}
      />
    </div>
  );
}
