import { useState } from 'react';
import type { ApplianceGuide } from '@/types/database';
import {
  AirVent,
  Tv,
  Flame,
  Waves,
  ChevronDown,
  Info,
  Lightbulb,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  AirVent,
  Tv,
  Flame,
  Waves,
};

interface AppliancesGuideSectionProps {
  appliances: ApplianceGuide[];
}

export function AppliancesGuideSection({ appliances }: AppliancesGuideSectionProps) {
  const [openIds, setOpenIds] = useState<string[]>([appliances[0]?.id || '']);

  const toggleOpen = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Uso de Electrodomésticos y Servicios</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Instrucciones paso a paso para el funcionamiento óptimo de los equipos
        </p>
      </div>

      <div className="space-y-3">
        {appliances.map((app) => {
          const Icon = iconMap[app.icon] || Info;
          const isOpen = openIds.includes(app.id);

          return (
            <div
              key={app.id}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition-all"
            >
              <button
                type="button"
                onClick={() => toggleOpen(app.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/40">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {app.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 hidden sm:inline">
                    {isOpen ? 'Ocultar' : 'Ver pasos'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-indigo-600' : ''
                    }`}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 space-y-3.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="space-y-2 pt-2">
                    {app.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>

                  {app.tips && (
                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex items-start gap-2.5">
                      <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                        <strong>Consejo:</strong> {app.tips}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
