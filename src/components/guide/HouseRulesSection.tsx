import type { HouseRule } from '@/types/database';
import {
  Volume2,
  CigaretteOff,
  Users,
  Sparkles,
  Clock,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Volume2,
  CigaretteOff,
  Users,
  Sparkles,
  Clock,
  ShieldCheck,
  AlertCircle,
};

interface HouseRulesSectionProps {
  rules: HouseRule[];
}

export function HouseRulesSection({ rules }: HouseRulesSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Normas de la Casa</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Reglas esenciales para garantizar una estancia placentera y buena convivencia
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {rules.map((rule) => {
          const Icon = iconMap[rule.icon] || HelpCircle;
          return (
            <div
              key={rule.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-800/40">
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                  {rule.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {rule.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
