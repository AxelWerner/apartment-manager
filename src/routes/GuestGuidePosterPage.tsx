import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGuestGuide } from '@/hooks/use-guest-guide';
import {
  QrPrintTemplate,
  type FixedTemplateOptions,
  type TemplateVariant,
} from '@/components/guide/QrPrintTemplate';
import {
  Printer,
  ArrowLeft,
  QrCode,
  Wifi,
  Clock,
} from 'lucide-react';


export default function GuestGuidePosterPage() {
  const { propertyId } = useParams();
  const { data: guide, isLoading } = useGuestGuide(propertyId);

  const [options, setOptions] = useState<FixedTemplateOptions>({
    variant: 'essential',
    size: 'a5',
    language: 'bilingual',
    theme: 'sage',
  });

  if (isLoading || !guide) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center animate-pulse mb-3">
          <QrCode className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Cargando plantillas de lámina QR...
        </p>
      </div>
    );
  }

  const guideUrl = `${window.location.origin}/guide${propertyId ? `/${propertyId}` : ''}`;

  const handlePrint = () => {
    window.print();
  };

  const variantsList: { id: TemplateVariant; title: string; desc: string; icon: typeof Clock }[] = [
    {
      id: 'essential',
      title: '1. Guía Digital e Información Clave',
      desc: 'QR Guía + Horarios de Entrada/Salida + Normas del Apto (A5 Bilingüe)',
      icon: Clock,
    },
    {
      id: 'wifi_only',
      title: '2. Solo Conexión Wi-Fi',
      desc: 'QR Conexión Instantánea + Red (SSID) y Clave en grande (A5 Bilingüe)',
      icon: Wifi,
    },
  ];



  return (
    <div className="min-h-screen bg-slate-200/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Top Navigation & Variant Switcher (Hidden when printing) */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                to="/guest-guide"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="Volver a la configuración"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Plantillas de Lámina QR Fijas</span>
                  <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 font-mono px-2 py-0.5 rounded-full font-semibold">
                    {guide.apartment_number}
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium px-2 py-0.5 rounded-full">
                    A5 • Bilingüe
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Formato A5 fijo en español e inglés listo para imprimir en expositor
                </p>
              </div>
            </div>

            {/* Print button & Pastel Theme switcher */}
            <div className="flex items-center gap-2">
              {/* Tema Pastel */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                {[
                  { id: 'sage' as const, label: 'Salvia', dot: 'bg-emerald-500' },
                  { id: 'sky' as const, label: 'Cielo', dot: 'bg-sky-500' },
                  { id: 'sand' as const, label: 'Arena', dot: 'bg-amber-400' },
                  { id: 'lavender' as const, label: 'Lavanda', dot: 'bg-purple-400' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOptions({ ...options, theme: t.id })}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      (options.theme || 'sage') === t.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>

          {/* 2 Fixed Variants Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">

            {variantsList.map((v) => {
              const Icon = v.icon;
              const isSelected = options.variant === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setOptions({ ...options, variant: v.id })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{v.title}</p>
                    <p
                      className={`text-[10px] line-clamp-1 mt-0.5 ${
                        isSelected
                          ? 'text-slate-300 dark:text-slate-600'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {v.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Preview Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 print:p-0 print:m-0">
        <div className="w-full flex justify-center print:block print:w-full">
          <QrPrintTemplate guide={guide} options={options} guideUrl={guideUrl} />
        </div>
      </main>
    </div>
  );
}
