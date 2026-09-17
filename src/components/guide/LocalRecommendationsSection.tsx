import { useState } from 'react';
import type { GuideRecommendation } from '@/types/database';
import {
  Utensils,
  Coffee,
  ShoppingCart,
  Pill,
  Compass,
  Car,
  ExternalLink,
  MapPin,
} from 'lucide-react';

const categoryConfig: Record<
  GuideRecommendation['category'],
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  restaurant: { label: 'Restaurante', icon: Utensils, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/60' },
  cafe: { label: 'Café & Bakery', icon: Coffee, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60' },
  supermarket: { label: 'Supermercado', icon: ShoppingCart, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60' },
  pharmacy: { label: 'Farmacia', icon: Pill, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/60' },
  attraction: { label: 'Atracción', icon: Compass, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/60' },
  transport: { label: 'Transporte', icon: Car, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' },
};

interface LocalRecommendationsSectionProps {
  recommendations: GuideRecommendation[];
}

export function LocalRecommendationsSection({
  recommendations,
}: LocalRecommendationsSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'restaurant', label: 'Restaurantes' },
    { id: 'cafe', label: 'Cafés' },
    { id: 'supermarket', label: 'Supermercados' },
    { id: 'pharmacy', label: 'Farmacias' },
    { id: 'transport', label: 'Transporte' },
  ];

  const filtered =
    selectedCategory === 'all'
      ? recommendations
      : recommendations.filter((r) => r.category === selectedCategory);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recomendaciones Locales</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Lugares favoritos, gastronomía y servicios esenciales en la zona
        </p>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid of Places */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {filtered.map((item) => {
          const config = categoryConfig[item.category] || categoryConfig.restaurant;
          const Icon = config.icon;

          return (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug truncate">
                      {item.title}
                    </h4>
                  </div>
                  {item.distance && (
                    <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full shrink-0">
                      {item.distance}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                  {item.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate max-w-[180px]">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{item.address || 'En la zona'}</span>
                </span>

                {item.maps_url && (
                  <a
                    href={item.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    <span>Ver mapa</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
