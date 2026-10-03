import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  Check,
} from 'lucide-react';
import { useActiveProperty } from '@/context/PropertyContext';
import { CreatePropertyModal } from './CreatePropertyModal';
import type { UserRole } from '@/types/database';

const roleLabels: Record<UserRole, { label: string; badge: string }> = {
  SUPER_USER: { label: 'Super Admin', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
  OWNER: { label: 'Dueño', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  ADMINISTRATOR: { label: 'Admin', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  CLEANER: { label: 'Limpieza', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  VIEWER: { label: 'Lector', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

export function PropertySwitcher() {
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

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentRoleInfo = roleLabels[role] || roleLabels.VIEWER;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between transition-colors text-left cursor-pointer group"
      >
        <div className="truncate pr-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {activeProperty?.name || 'Selecciona un Apto'}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
              {activeProperty?.city || 'Medellín'} • COP
            </span>
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md ${currentRoleInfo.badge}`}
            >
              {currentRoleInfo.label}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Tus Apartamentos
          </div>

          <div className="max-h-56 overflow-y-auto px-1 space-y-1">
            {properties.map(({ property, role: propRole }) => {
              const isActive = property.id === activePropertyId;
              const roleInfo = roleLabels[propRole] || roleLabels.VIEWER;

              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => {
                    switchProperty(property.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 font-medium'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-medium truncate">{property.name}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span>{property.city}</span>
                      <span>•</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${roleInfo.badge}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-rose-500 shrink-0" />}
                </button>
              );
            })}

            {properties.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-400">
                No tienes apartamentos registrados aún.
              </div>
            )}
          </div>

          {/* Create New Apartment Option */}
          <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 px-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreateModalOpen(true);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
            >
              <div className="w-5 h-5 rounded-lg bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span>Nuevo Apartamento</span>
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
