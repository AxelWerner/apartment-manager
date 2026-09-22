import { QrCodeSvg } from '@/components/guide/QrCodeSvg';
import {
  Wifi,
  Clock,
  Sparkles,
  ShieldAlert,
  Flame,
  VolumeX,
  PartyPopper,
  Snowflake,
} from 'lucide-react';


import type { GuestGuideData } from '@/types/database';

export type TemplateVariant = 'essential' | 'wifi_only';
export type TemplateSize = 'a4' | 'a5' | 'frame';
export type TemplateLanguage = 'es' | 'en' | 'bilingual';
export type TemplateColorTheme = 'sage' | 'sky' | 'sand' | 'lavender';

export interface FixedTemplateOptions {
  variant: TemplateVariant;
  size: TemplateSize;
  language: TemplateLanguage;
  theme?: TemplateColorTheme;
}

interface QrPrintTemplateProps {
  guide: GuestGuideData;
  options: FixedTemplateOptions;
  guideUrl: string;
}

const themeStyles: Record<TemplateColorTheme, {
  bg: string;
  border: string;
  headerBadge: string;
  iconColor: string;
  title: string;
  subBadge: string;
  cardBg: string;
  qrInnerBg: string;
  chipBadge: string;
  chipIcon: string;
  hintText: string;
  scheduleCard: string;
  scheduleText: string;
  rulesCard: string;
  rulesText: string;
  contactCard: string;
  contactIcon: string;
  footer: string;
}> = {
  sage: {
    bg: 'bg-[#F2F6F4]',
    border: 'border-[#D4E4DC]',
    headerBadge: 'bg-[#E1EFE7] border-[#C2DECFA0] text-[#1E5438]',
    iconColor: 'text-[#20573B]',
    title: 'text-[#142B1F]',
    subBadge: 'bg-white border-[#D4E4DC] text-[#1E5438]',
    cardBg: 'bg-white border-[#D4E4DC]',
    qrInnerBg: 'bg-[#F2F6F4] border-[#D4E4DC]',
    chipBadge: 'bg-[#E1EFE7] border-[#C2DECFA0] text-[#1E5438]',
    chipIcon: 'text-[#20573B]',
    hintText: 'text-[#4A6B5B]',
    scheduleCard: 'border-[#C8E0D2] bg-[#E8F3ED]',
    scheduleText: 'text-[#1E5438]',
    rulesCard: 'border-[#D4E4DC] bg-[#FAFBF9]',
    rulesText: 'text-[#142B1F]',
    contactCard: 'border-[#D4E4DC] bg-white text-[#1E5438]',
    contactIcon: 'bg-[#E1EFE7] text-[#1E5438] border-[#C2DECFA0]',
    footer: 'border-[#D4E4DC] text-[#6A8B7B]',
  },
  sky: {
    bg: 'bg-[#F1F6FA]',
    border: 'border-[#D0E2F2]',
    headerBadge: 'bg-[#E0EFF8] border-[#C0DCF0A0] text-[#194E78]',
    iconColor: 'text-[#1D5887]',
    title: 'text-[#10273D]',
    subBadge: 'bg-white border-[#D0E2F2] text-[#194E78]',
    cardBg: 'bg-white border-[#D0E2F2]',
    qrInnerBg: 'bg-[#F1F6FA] border-[#D0E2F2]',
    chipBadge: 'bg-[#E0EFF8] border-[#C0DCF0A0] text-[#194E78]',
    chipIcon: 'text-[#1D5887]',
    hintText: 'text-[#476B8A]',
    scheduleCard: 'border-[#C4DEEE] bg-[#E7F2F8]',
    scheduleText: 'text-[#194E78]',
    rulesCard: 'border-[#D0E2F2] bg-[#FAFCFD]',
    rulesText: 'text-[#10273D]',
    contactCard: 'border-[#D0E2F2] bg-white text-[#194E78]',
    contactIcon: 'bg-[#E0EFF8] text-[#194E78] border-[#C0DCF0A0]',
    footer: 'border-[#D0E2F2] text-[#6387A6]',
  },
  sand: {
    bg: 'bg-[#F8F5F0]',
    border: 'border-[#E6DFD3]',
    headerBadge: 'bg-[#EFE7DC] border-[#DFD4C4A0] text-[#5C482F]',
    iconColor: 'text-[#695235]',
    title: 'text-[#2D2316]',
    subBadge: 'bg-white border-[#E6DFD3] text-[#5C482F]',
    cardBg: 'bg-white border-[#E6DFD3]',
    qrInnerBg: 'bg-[#F8F5F0] border-[#E6DFD3]',
    chipBadge: 'bg-[#EFE7DC] border-[#DFD4C4A0] text-[#5C482F]',
    chipIcon: 'text-[#695235]',
    hintText: 'text-[#705E49]',
    scheduleCard: 'border-[#E0D5C3] bg-[#F3ECE0]',
    scheduleText: 'text-[#5C482F]',
    rulesCard: 'border-[#E6DFD3] bg-[#FCFAF7]',
    rulesText: 'text-[#2D2316]',
    contactCard: 'border-[#E6DFD3] bg-white text-[#5C482F]',
    contactIcon: 'bg-[#EFE7DC] text-[#5C482F] border-[#DFD4C4A0]',
    footer: 'border-[#E6DFD3] text-[#8C7A65]',
  },
  lavender: {
    bg: 'bg-[#F5F3F9]',
    border: 'border-[#DDD7E8]',
    headerBadge: 'bg-[#EBE4F6] border-[#D4C8E4A0] text-[#4B3669]',
    iconColor: 'text-[#563E78]',
    title: 'text-[#251A38]',
    subBadge: 'bg-white border-[#DDD7E8] text-[#4B3669]',
    cardBg: 'bg-white border-[#DDD7E8]',
    qrInnerBg: 'bg-[#F5F3F9] border-[#DDD7E8]',
    chipBadge: 'bg-[#EBE4F6] border-[#D4C8E4A0] text-[#4B3669]',
    chipIcon: 'text-[#563E78]',
    hintText: 'text-[#63537D]',
    scheduleCard: 'border-[#D9CFE8] bg-[#EFEAF6]',
    scheduleText: 'text-[#4B3669]',
    rulesCard: 'border-[#DDD7E8] bg-[#FAF9FC]',
    rulesText: 'text-[#251A38]',
    contactCard: 'border-[#DDD7E8] bg-white text-[#4B3669]',
    contactIcon: 'bg-[#EBE4F6] text-[#4B3669] border-[#D4C8E4A0]',
    footer: 'border-[#DDD7E8] text-[#82729C]',
  },
};

export function QrPrintTemplate({ guide, options, guideUrl }: QrPrintTemplateProps) {
  const { variant = 'essential', size = 'a5', language = 'bilingual', theme = 'sage' } = options;

  const currentTheme = themeStyles[theme] || themeStyles.sage;
  const wifiConnectString = `WIFI:T:WPA;S:${guide.wifi_ssid};P:${guide.wifi_password};;`;
  const isWifiOnly = variant === 'wifi_only';
  const qrValue = isWifiOnly ? wifiConnectString : guideUrl;

  // Text helpers based on language
  const t = {
    welcome:
      language === 'en'
        ? 'Welcome to'
        : language === 'bilingual'
          ? 'Bienvenido / Welcome to'
          : 'Bienvenido a',
    digitalGuide:
      language === 'en'
        ? 'Guest Digital Guide'
        : language === 'bilingual'
          ? 'Guía Digital • Digital Guide'
          : 'Guía Digital del Huésped',
    scanMe:
      language === 'en'
        ? 'Scan for Full Guide'
        : language === 'bilingual'
          ? 'Escanear para Guía'
          : 'Escanea con tu Móvil',
    scanWifi:
      language === 'en'
        ? 'Scan to Connect'
        : language === 'bilingual'
          ? 'Escanear para Conectar'
          : 'Escanear para Conectar',
    scanInstructions: {
      primary:
        language === 'en'
          ? 'Scan with your camera for digital guide & house tips'
          : 'Escanea para la guía digital, recomendaciones y normas',
      secondary:
        language === 'bilingual'
          ? 'Scan for digital guide, house tips & rules'
          : null,
    },
    scanWifiInstructions: {
      primary:
        language === 'en'
          ? 'Point camera to connect to Wi-Fi automatically'
          : 'Escanea para conectarte automáticamente al Wi-Fi',
      secondary:
        language === 'bilingual'
          ? 'Point camera to connect to Wi-Fi automatically'
          : null,
    },
    wifiTitle:
      language === 'en' ? 'Wi-Fi Fast Connect' : language === 'bilingual' ? 'Wi-Fi / Internet' : 'Conexión Wi-Fi',
    network: language === 'en' ? 'Network (SSID)' : language === 'bilingual' ? 'Red / Network' : 'Nombre de Red (SSID)',
    password: language === 'en' ? 'Password' : language === 'bilingual' ? 'Clave / Password' : 'Contraseña',
    checkInOut:
      language === 'en' ? 'Check-in & Check-out' : language === 'bilingual' ? 'Horarios / Schedule' : 'Horarios de Entrada y Salida',
    checkIn: language === 'en' ? 'Check-in' : 'Entrada (Check-in)',
    checkOut: language === 'en' ? 'Check-out' : 'Salida (Check-out)',
    rulesTitle:
      language === 'en'
        ? 'Essential House Rules'
        : language === 'bilingual'
          ? 'Normas Clave / House Rules'
          : 'Normas Clave del Apartamento',
  };

  // House rules structured for single and bilingual 2-line rendering
  const rulesList = [
    {
      icon: Flame,
      iconColor: 'text-rose-500 bg-rose-50/90 border-rose-100',
      primary:
        language === 'en'
          ? 'No smoking anywhere'
          : language === 'bilingual'
            ? 'Prohibido fumar'
            : 'Prohibido fumar en todo el inmueble',
      secondary: language === 'bilingual' ? 'No smoking anywhere' : null,
    },
    {
      icon: VolumeX,
      iconColor: 'text-amber-600 bg-amber-50/90 border-amber-100',
      primary:
        language === 'en'
          ? 'Quiet hours (22:00 - 08:00)'
          : language === 'bilingual'
            ? 'Horas de silencio (22:00 - 08:00)'
            : 'Horas de silencio (22:00 - 08:00)',
      secondary: language === 'bilingual' ? 'Quiet hours (10:00 PM - 8:00 AM)' : null,
    },
    {
      icon: PartyPopper,
      iconColor: 'text-purple-600 bg-purple-50/90 border-purple-100',
      primary:
        language === 'en'
          ? 'No parties or events'
          : language === 'bilingual'
            ? 'No fiestas ni eventos'
            : 'Prohibidas fiestas y eventos',
      secondary: language === 'bilingual' ? 'No parties or events' : null,
    },
    {
      icon: Snowflake,
      iconColor: 'text-sky-600 bg-sky-50/90 border-sky-100',
      primary:
        language === 'en'
          ? 'Set A/C to 22°-24°C & turn off when out'
          : 'Usar A/A en 22°-24° (apagar al salir)',
      secondary: language === 'bilingual' ? 'Set A/C to 22°-24°C & turn off when leaving' : null,
    },
  ];

  // Dimensions classes based on chosen size
  const sizeClasses = {
    a4: 'w-[210mm] min-h-[297mm] p-[12mm]',
    a5: 'w-[148mm] min-h-[210mm] p-[8mm]',
    frame: 'w-[130mm] min-h-[180mm] p-[7mm]',
  }[size];

  // =========================================================================
  // VARIANTE 2: SOLO WI-FI (Mismo estilo Pastel que la Guía)
  // =========================================================================
  if (variant === 'wifi_only') {
    return (
      <div
        className={`mx-auto ${currentTheme.bg} font-sans shadow-lg print:shadow-none border ${currentTheme.border} print:border-none flex flex-col justify-between box-border rounded-2xl print:rounded-none ${sizeClasses}`}
        style={{ colorScheme: 'light' }}
      >
        {/* Top Header */}
        <div className={`text-center pb-3 border-b ${currentTheme.border}`}>
          <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border ${currentTheme.headerBadge} text-[10px] font-bold uppercase tracking-wider mb-1`}>
            <Wifi className={`w-3.5 h-3.5 ${currentTheme.iconColor}`} />
            {t.wifiTitle}
          </span>
          <h1 className={`text-2xl sm:text-3xl font-serif font-extrabold ${currentTheme.title} tracking-tight`}>
            {guide.welcome_title}
          </h1>
          <div className="flex items-center justify-center mt-1.5">
            <span className={`px-3.5 py-1 rounded-xl font-mono font-extrabold text-sm sm:text-base tracking-wider shadow-2xs ${currentTheme.subBadge}`}>
              {guide.apartment_number}
            </span>
          </div>
        </div>

        {/* Center: Enlarged QR + Clean Compact Tag */}
        <div className="my-auto py-2.5 space-y-3.5">
          <div className={`flex flex-col items-center text-center rounded-2xl p-3.5 shadow-2xs ${currentTheme.cardBg}`}>
            <div className={`p-3 rounded-2xl shadow-2xs flex flex-col items-center ${currentTheme.qrInnerBg}`}>
              <QrCodeSvg value={qrValue} size={size === 'a4' ? 200 : size === 'a5' ? 155 : 135} />
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mt-2.5 ${currentTheme.chipBadge}`}>
              <Sparkles className={`w-3.5 h-3.5 ${currentTheme.chipIcon}`} />
              {t.scanWifi}
            </span>
            <div className={`text-[11px] font-medium max-w-sm leading-tight mt-1 flex flex-col items-center ${currentTheme.hintText}`}>
              <span className="font-semibold">{t.scanWifiInstructions.primary}</span>
              {t.scanWifiInstructions.secondary && (
                <span className="text-[9.5px] opacity-85 mt-0.5 font-normal">{t.scanWifiInstructions.secondary}</span>
              )}
            </div>
          </div>

          {/* Large Credentials Box - Matching Pastel Cards */}
          <div className="space-y-2.5 text-xs w-full max-w-sm mx-auto">
            {/* Red / Network */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${currentTheme.scheduleCard}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${currentTheme.scheduleText}`}>
                {t.network}
              </span>
              <p className={`text-base sm:text-lg font-mono font-extrabold select-all truncate ${currentTheme.title}`}>
                {guide.wifi_ssid}
              </p>
            </div>

            {/* Contraseña / Password */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${currentTheme.rulesCard}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${currentTheme.hintText}`}>
                {t.password}
              </span>
              <p className={`text-base sm:text-lg font-mono font-extrabold bg-white px-3.5 py-1 rounded-lg border ${currentTheme.border} select-all shadow-2xs tracking-wider ${currentTheme.title}`}>
                {guide.wifi_password}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`pt-2 border-t flex items-center justify-between text-[9px] font-mono ${currentTheme.footer}`}>
          <span>{guide.welcome_title}</span>
          <span>Wi-Fi Access</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VARIANTE 1: GUÍA + INFORMACIÓN ESENCIAL (Pastel Harmony)
  // =========================================================================
  return (
    <div
      className={`mx-auto ${currentTheme.bg} font-sans shadow-lg print:shadow-none border ${currentTheme.border} print:border-none flex flex-col justify-between box-border rounded-2xl print:rounded-none ${sizeClasses}`}
      style={{ colorScheme: 'light' }}
    >
      {/* Header */}
      <div className={`text-center pb-3 border-b ${currentTheme.border}`}>
        <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border ${currentTheme.headerBadge} text-[10px] font-bold uppercase tracking-wider mb-1`}>
          {t.welcome}
        </span>
        <h1 className={`text-2xl sm:text-3xl font-serif font-extrabold ${currentTheme.title} tracking-tight`}>
          {guide.welcome_title}
        </h1>
        <div className="flex items-center justify-center mt-1.5">
          <span className={`px-3.5 py-1 rounded-xl font-mono font-extrabold text-sm sm:text-base tracking-wider shadow-2xs ${currentTheme.subBadge}`}>
            {guide.apartment_number}
          </span>
        </div>
      </div>

      {/* Center: Enlarged QR to Digital Guide + Clean Compact Tag */}
      <div className="my-auto py-2.5 space-y-3.5">
        <div className={`flex flex-col items-center text-center rounded-2xl p-3.5 shadow-2xs ${currentTheme.cardBg}`}>
          <div className={`p-3 rounded-2xl shadow-2xs flex flex-col items-center ${currentTheme.qrInnerBg}`}>
            <QrCodeSvg value={guideUrl} size={size === 'a4' ? 195 : size === 'a5' ? 150 : 130} />
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mt-2.5 ${currentTheme.chipBadge}`}>
            <Sparkles className={`w-3.5 h-3.5 ${currentTheme.chipIcon}`} />
            {t.digitalGuide}
          </span>
          <div className={`text-[11px] font-medium max-w-sm leading-tight mt-1 flex flex-col items-center ${currentTheme.hintText}`}>
            <span className="font-semibold">{t.scanInstructions.primary}</span>
            {t.scanInstructions.secondary && (
              <span className="text-[9.5px] opacity-85 mt-0.5 font-normal">{t.scanInstructions.secondary}</span>
            )}
          </div>
        </div>

        {/* Under QR: Essential Apartment Info (Pastel Horarios, Normas y Contacto) */}
        <div className="space-y-2 text-xs">
          {/* Horarios Check-in & Check-out */}
          <div className={`p-2.5 rounded-xl border ${currentTheme.scheduleCard}`}>
            <div className={`flex items-center gap-1.5 font-bold text-[11px] mb-1 border-b border-black/5 pb-0.5 ${currentTheme.scheduleText}`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{t.checkInOut}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-white/90 rounded-lg p-1.5 border border-black/5 text-center">
                <span className={`text-[9px] uppercase font-semibold block ${currentTheme.hintText}`}>{t.checkIn}</span>
                <strong className={`font-mono text-xs ${currentTheme.title}`}>{guide.check_in_time || '15:00'}</strong>
              </div>
              <div className="bg-white/90 rounded-lg p-1.5 border border-black/5 text-center">
                <span className={`text-[9px] uppercase font-semibold block ${currentTheme.hintText}`}>{t.checkOut}</span>
                <strong className={`font-mono text-xs ${currentTheme.title}`}>{guide.check_out_time || '11:00'}</strong>
              </div>
            </div>
          </div>

          {/* Normas Clave */}
          <div className={`p-2.5 rounded-xl border space-y-1.5 ${currentTheme.rulesCard}`}>
            <div className={`flex items-center gap-1.5 font-bold text-[11px] border-b border-black/5 pb-1 ${currentTheme.title}`}>
              <ShieldAlert className={`w-3.5 h-3.5 ${currentTheme.iconColor}`} />
              <span>{t.rulesTitle}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-medium">
              {rulesList.map((rule, idx) => {
                const Icon = rule.icon;
                return (
                  <div key={idx} className="flex items-start gap-1.5">
                    <div className={`p-1 rounded-md border shrink-0 mt-0.5 ${rule.iconColor}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className={`font-semibold ${currentTheme.title}`}>{rule.primary}</span>
                      {rule.secondary && (
                        <span className={`text-[9px] font-normal ${currentTheme.hintText}`}>{rule.secondary}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          </div>
      </div>

      {/* Footer */}
      <div className={`pt-2 border-t flex items-center justify-between text-[9px] font-mono ${currentTheme.footer}`}>
        <span>{guide.welcome_title}</span>
        <span>Digital Guest Guide</span>
      </div>
    </div>
  );
}

