import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGuestGuide } from '@/hooks/use-guest-guide';
import { WifiCard } from '@/components/guide/WifiCard';
import { HouseRulesSection } from '@/components/guide/HouseRulesSection';
import { AppliancesGuideSection } from '@/components/guide/AppliancesGuideSection';
import { LocalRecommendationsSection } from '@/components/guide/LocalRecommendationsSection';
import { EmergencyContactsSection } from '@/components/guide/EmergencyContactsSection';
import {
  Building2,
  MapPin,
  Clock,
  Key,
  Lock,
  Share2,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';


export default function GuestPortal() {
  const { propertyId } = useParams();
  const { data: guide, isLoading } = useGuestGuide(propertyId);
  const [activeTab, setActiveTab] = useState<'all' | 'wifi' | 'access' | 'rules' | 'appliances' | 'places' | 'emergency'>('all');
  const [copiedCode, setCopiedCode] = useState(false);

  if (isLoading || !guide) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center animate-bounce mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Cargando Guía del Huésped...</h2>
        <p className="text-xs text-slate-500 mt-1">Preparando la información de tu estancia</p>
      </div>
    );
  }

  const handleCopyAccessCode = async () => {
    try {
      await navigator.clipboard.writeText(guide.access_code);
      setCopiedCode(true);
      toast.success('¡Código de acceso copiado!');
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleShareGuide = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Guía Digital - ${guide.welcome_title}`,
          text: `Aquí tienes la guía digital del apartamento: ${guide.welcome_title}`,
          url: window.location.href,
        });
      } catch {
        // Share cancelled or failed
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Enlace de la guía copiado al portapapeles');
      } catch {
        toast.error('No se pudo copiar el enlace');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-rose-500 selection:text-white">
      {/* Top Mobile/Desktop Floating Bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-xs sm:text-sm leading-tight text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
                {guide.welcome_title}
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {guide.apartment_number} • Guía del Huésped
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Compartir guía con acompañantes"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compartir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Welcome Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-rose-600 to-amber-500 text-white p-6 sm:p-8 shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white border border-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              Portal Oficial de Huéspedes
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {guide.welcome_title}
            </h2>
            <p className="text-xs sm:text-sm text-rose-50 leading-relaxed font-medium">
              {guide.welcome_message}
            </p>

            {/* Address & Maps button */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-rose-100 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[280px] sm:max-w-md">{guide.address}</span>
              </div>
              {guide.maps_url && (
                <a
                  href={guide.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold bg-white text-rose-600 px-3.5 py-1.5 rounded-xl shadow-md hover:bg-rose-50 transition-colors"
                >
                  <span>Abrir en Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Quick Navigation Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'all', label: 'Todo' },
            { id: 'wifi', label: '📶 Wi-Fi' },
            { id: 'access', label: '🔑 Acceso y Llaves' },
            { id: 'rules', label: '📋 Normas' },
            { id: 'appliances', label: '💡 Electrodomésticos' },
            { id: 'places', label: '🍽️ Lugares' },
            { id: 'emergency', label: '🆘 Contactos' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Check-in & Check-out Quick Times */}
        {(activeTab === 'all' || activeTab === 'access') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/40">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">
                  Horario de Entrada (Check-In)
                </span>
                <p className="text-base font-extrabold text-slate-900 dark:text-white">
                  A partir de las {guide.check_in_time}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/50 dark:border-rose-800/40">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">
                  Horario de Salida (Check-Out)
                </span>
                <p className="text-base font-extrabold text-slate-900 dark:text-white">
                  Hasta las {guide.check_out_time}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 1. Wi-Fi Card */}
        {(activeTab === 'all' || activeTab === 'wifi') && (
          <section>
            <WifiCard ssid={guide.wifi_ssid} password={guide.wifi_password} />
          </section>
        )}

        {/* 2. Access & Smart Lock Info */}
        {(activeTab === 'all' || activeTab === 'access') && (
          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Instrucciones de Acceso</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pasos para el ingreso al edificio y apertura de la cerradura
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              {/* Access Code Box - Conditioned on host preference */}
              {guide.show_access_code ? (
                <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 block">
                        Código de Cerradura Inteligente
                      </span>
                      <p className="text-xl font-mono font-extrabold text-amber-950 dark:text-amber-100 tracking-wider">
                        {guide.access_code || '1234 #'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyAccessCode}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 text-xs font-bold shadow-xs border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-slate-700 transition-all cursor-pointer shrink-0"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? '¡Copiado!' : 'Copiar Código'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Código de acceso privado
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Por seguridad, tu anfitrión te enviará el código exclusivo de acceso a través del chat de Airbnb o WhatsApp antes de tu llegada.
                    </p>
                  </div>
                </div>
              )}

              {/* Step-by-step Access Instructions */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Instrucciones de Llegada y Portería
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {guide.access_instructions}
                </p>
              </div>

              {/* Check-out details */}
              {guide.check_out_instructions && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Instrucciones para la Salida (Check-Out)
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {guide.check_out_instructions}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. Building Amenities */}
        {guide.building_amenities && guide.building_amenities.length > 0 && (activeTab === 'all' || activeTab === 'access') && (
          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Zonas Comunes e Instalaciones</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Amenidades disponibles para los huéspedes en el edificio
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {guide.building_amenities.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 4. House Rules */}
        {(activeTab === 'all' || activeTab === 'rules') && (
          <section>
            <HouseRulesSection rules={guide.house_rules || []} />
          </section>
        )}

        {/* 5. Appliances Guide */}
        {(activeTab === 'all' || activeTab === 'appliances') && (
          <section>
            <AppliancesGuideSection appliances={guide.appliances || []} />
          </section>
        )}

        {/* 6. Local Recommendations */}
        {(activeTab === 'all' || activeTab === 'places') && (
          <section>
            <LocalRecommendationsSection recommendations={guide.recommendations || []} />
          </section>
        )}

        {/* 7. Emergency Contacts & WhatsApp Direct Chat */}
        {(activeTab === 'all' || activeTab === 'emergency') && (
          <section>
            <EmergencyContactsSection
              contacts={guide.emergency_contacts || []}
              hostPhone={guide.host_phone}
              hostName={guide.host_name}
              propertyName={guide.welcome_title}
            />
          </section>
        )}

        {/* Footer */}
        <footer className="pt-8 pb-12 text-center space-y-2 border-t border-slate-200/60 dark:border-slate-800/60">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            ¡Te deseamos una maravillosa estadía en {guide.welcome_title}!
          </p>
          <p className="text-[11px] text-slate-400">
            Desarrollado con ❤️ para anfitriones y huéspedes
          </p>
        </footer>
      </main>
    </div>
  );
}
