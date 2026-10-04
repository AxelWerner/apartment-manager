import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  Check,
  Sparkles,
} from 'lucide-react';
import { useActiveProperty } from '@/context/PropertyContext';
import { CreatePropertyModal } from './CreatePropertyModal';
import type { UserRole } from '@/types/database';

const roleConfig: Record<UserRole, { label: string; badge: string }> = {
  SUPER_USER: {
    label: 'Super Admin',
    badge: 'bg-purple-100/90 text-purple-700 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
  },
  OWNER: {
    label: 'Dueño',
    badge: 'bg-amber-100/90 text-amber-800 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
  },
  ADMINISTRATOR: {
    label: 'Admin',
    badge: 'bg-blue-100/90 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60',
  },
  CLEANER: {
    label: 'Limpieza',
    badge: 'bg-emerald-100/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  },
  VIEWER: {
    label: 'Lector',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export function RoleBadge({ role }: { role: UserRole }) {
  const config = roleConfig[role] || roleConfig.VIEWER;

  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-tight shrink-0 ${config.badge}`}
    >
      {config.label}
    </span>
  );
}

// Alias for backwards compatibility if needed
export const RoleAvatar = RoleBadge;

interface PropertySwitcherProps {
  className?: string;
}

export function PropertySwitcher({ className = '' }: PropertySwitcherProps) {
  const {
    properties,
    activeProperty,
    activePropertyId,
    role,
    switchProperty,
  } = useActiveProperty();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Switcher Button - Header right aligned */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-between gap-3 px-3.5 py-1.5 sm:py-2 rounded-xl bg-white/90 dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-900/60 shadow-2xs hover:shadow-xs transition-all text-left cursor-pointer max-w-[220px] sm:max-w-xs md:max-w-sm"
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex-1 pr-1">
          <p
            className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1 leading-snug break-words tracking-tight"
            title={activeProperty?.name}
          >
            {activeProperty?.name || 'Selecciona un Apartamento'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {activeProperty?.city && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {activeProperty.city}
              </span>
            )}
            <RoleBadge role={role} />
          </div>
        </div>

        <div className="shrink-0">
          <div className="w-5 h-5 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-rose-500' : ''
              }`}
            />
          </div>
        </div>
      </button>

      {/* Dropdown Menu - Aligns to the right */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Apartamentos
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {properties.length} {properties.length === 1 ? 'inmueble' : 'inmuebles'}
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
            {properties.map(({ property, role: propRole }) => {
              const isActive = property.id === activePropertyId;

              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => {
                    switchProperty(property.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/50 text-rose-950 dark:text-rose-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-transparent text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p
                      className={`text-xs font-semibold line-clamp-1 leading-snug break-words ${
                        isActive ? 'text-rose-950 dark:text-rose-100' : 'text-slate-800 dark:text-slate-200'
                      }`}
                      title={property.name}
                    >
                      {property.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {property.city && (
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                          {property.city}
                        </span>
                      )}
                      <RoleBadge role={propRole} />
                    </div>
                  </div>
                  {isActive && (
                    <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}

            {properties.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                No hay apartamentos registrados aún.
              </div>
            )}
          </div>

          {/* Create New Apartment Option */}
          <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreateModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer border border-dashed border-rose-200 dark:border-rose-900/40"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Añadir nuevo apartamento</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Creación */}
      <CreatePropertyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
