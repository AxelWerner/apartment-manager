import { useState } from 'react';
import type { KeyDistance } from '@/types/database';
import {
  Plane,
  Waves,
  Sun,
  Landmark,
  Store,
  HeartPulse,
  Trees,
  Compass,
  Ship,
  ShoppingCart,
  MapPin,
  ExternalLink,
  Navigation,
  Car,
  Footprints,
  Sparkles,
} from 'lucide-react';

interface KeyDistancesSectionProps {
  distances: KeyDistance[];
}

const categoryStyles: Record<
  KeyDistance['category'],
  { label: string; badgeColor: string; iconBg: string; defaultIcon: React.ComponentType<{ className?: string }> }
> = {
  airport: {
    label: 'Aeropuerto',
    badgeColor: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
    iconBg: 'bg-sky-500 text-white',
    defaultIcon: Plane,
  },
  beach: {
    label: 'Playas',
    badgeColor: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60',
    iconBg: 'bg-cyan-500 text-white',
    defaultIcon: Waves,
  },
  center: {
    label: 'Centros Urbanos',
    badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    iconBg: 'bg-amber-500 text-white',
    defaultIcon: Landmark,
  },
  hospital: {
    label: 'Salud y Urgencias',
    badgeColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    iconBg: 'bg-rose-500 text-white',
    defaultIcon: HeartPulse,
  },
  attraction: {
    label: 'Turismo y Naturaleza',
    badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    iconBg: 'bg-emerald-500 text-white',
    defaultIcon: Trees,
  },
  supermarket: {
    label: 'Supermercados',
    badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    iconBg: 'bg-indigo-500 text-white',
    defaultIcon: ShoppingCart,
  },
  transport: {
    label: 'Transporte',
    badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    iconBg: 'bg-slate-700 text-white dark:bg-slate-600',
    defaultIcon: Car,
  },
  other: {
    label: 'Puntos de Interés',
    badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    iconBg: 'bg-slate-600 text-white',
    defaultIcon: MapPin,
  },
};

function getIconComponent(iconName?: string, category?: KeyDistance['category']) {
  switch (iconName?.toLowerCase()) {
    case 'plane':
      return Plane;
    case 'waves':
      return Waves;
    case 'sun':
      return Sun;
    case 'landmark':
      return Landmark;
    case 'store':
      return Store;
    case 'heartpulse':
    case 'hospital':
      return HeartPulse;
    case 'trees':
    case 'tree':
      return Trees;
    case 'compass':
      return Compass;
    case 'ship':
      return Ship;
    case 'shoppingcart':
    case 'cart':
      return ShoppingCart;
    case 'car':
      return Car;
    default:
      if (category && categoryStyles[category]) {
        return categoryStyles[category].defaultIcon;
      }
      return MapPin;
  }
}

export function KeyDistancesSection({ distances }: KeyDistancesSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!distances || distances.length === 0) {
    return null;
  }

  const categories = [
    { id: 'all', label: 'Todos los Lugares' },
    { id: 'airport', label: '✈️ Aeropuerto' },
    { id: 'beach', label: '🏖️ Playas' },
    { id: 'center', label: '🏙️ Centros' },
    { id: 'hospital', label: '🏥 Hospital / Salud' },
    { id: 'attraction', label: '🌴 Atracciones' },
    { id: 'supermarket', label: '🛒 Supermercados' },
  ];

  const filtered =
    selectedCategory === 'all'
      ? distances
      : distances.filter((d) => d.category === selectedCategory);

  // Quick Highlights (Key places for top summary bar)
  const airportItem = distances.find((d) => d.category === 'airport');
  const mainBeachItem = distances.find((d) => d.category === 'beach' && d.name.toLowerCase().includes('salguero')) || distances.find((d) => d.category === 'beach');
  const rodaderoCenterItem = distances.find((d) => d.name.toLowerCase().includes('rodadero') && d.category === 'center');
  const downtownItem = distances.find((d) => d.name.toLowerCase().includes('histórico') || d.name.toLowerCase().includes('historico'));

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-rose-500" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Distancias y Puntos de Interés
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Tiempos estimados de traslado a los principales destinos, playas y servicios de Santa Marta
        </p>
      </div>

      {/* Quick Time Highlights Ribbon */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border border-slate-700/60 shadow-md">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider mb-2.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Resumen Rápido de Traslados</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
          {airportItem && (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400 font-semibold block truncate">✈️ Aeropuerto</span>
              <p className="text-xs sm:text-sm font-extrabold text-white mt-0.5">{airportItem.travel_time || airportItem.distance}</p>
            </div>
          )}
          {mainBeachItem && (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400 font-semibold block truncate">🏖️ Playa</span>
              <p className="text-xs sm:text-sm font-extrabold text-cyan-300 mt-0.5">{mainBeachItem.travel_time || mainBeachItem.distance}</p>
            </div>
          )}
          {rodaderoCenterItem && (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400 font-semibold block truncate">🛍️ El Rodadero</span>
              <p className="text-xs sm:text-sm font-extrabold text-amber-300 mt-0.5">{rodaderoCenterItem.travel_time || rodaderoCenterItem.distance}</p>
            </div>
          )}
          {downtownItem && (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400 font-semibold block truncate">🏛️ Centro Histórico</span>
              <p className="text-xs sm:text-sm font-extrabold text-rose-300 mt-0.5">{downtownItem.travel_time || downtownItem.distance}</p>
            </div>
          )}
        </div>
      </div>

      {/* Filter Categories Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const count = cat.id === 'all' ? distances.length : distances.filter((d) => d.category === cat.id).length;
          if (count === 0 && cat.id !== 'all') return null;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCategory === cat.id ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Distances Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {filtered.map((item) => {
          const config = categoryStyles[item.category] || categoryStyles.other;
          const Icon = getIconComponent(item.icon, item.category);

          const isWalking = item.travel_time?.toLowerCase().includes('pie') || item.distance.toLowerCase().includes('metro');

          return (
            <div
              key={item.id}
              className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
            >
              <div className="space-y-2.5">
                {/* Header with Icon, Title and Category Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${config.iconBg}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {item.name}
                      </h4>
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1 ${config.badgeColor}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {item.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                )}

                {/* Distance & Travel Time Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {item.distance && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      <span>{item.distance}</span>
                    </div>
                  )}

                  {item.travel_time && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                      {isWalking ? (
                        <Footprints className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Car className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      )}
                      <span>{item.travel_time}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action: Open Map / Directions */}
              {item.maps_url && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
                  <a
                    href={item.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline"
                  >
                    <span>Cómo llegar en Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
