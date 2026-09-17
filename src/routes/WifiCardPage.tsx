import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGuestGuide } from '@/hooks/use-guest-guide';
import { QrCodeSvg } from '@/components/guide/QrCodeSvg';
import {
  Wifi,
  Copy,
  Check,
  Eye,
  EyeOff,
  Compass,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  Building2,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function WifiCardPage() {
  const { propertyId } = useParams();
  const { data: guide, isLoading } = useGuestGuide(propertyId);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isLoading || !guide) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center animate-pulse mb-3">
          <Wifi className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Cargando credenciales de Wi-Fi...</p>
      </div>
    );
  }

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(guide.wifi_password);
      setCopied(true);
      toast.success('¡Contraseña de Wi-Fi copiada!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('No se pudo copiar automáticamente');
    }
  };

  // Standard Wi-Fi connection string: WIFI:T:WPA;S:Network;P:Password;;
  const wifiConnectQr = `WIFI:T:WPA;S:${guide.wifi_ssid};P:${guide.wifi_password};;`;

  // WhatsApp link format
  const sanitizedPhone = guide.host_phone.replace(/[^0-9]/g, '');
  const whatsappMessage = encodeURIComponent(
    `¡Hola ${guide.host_name || 'Anfitrión'}! Me encuentro en ${guide.welcome_title} y tengo una duda sobre el Wi-Fi o mi estadía:`
  );
  const whatsappUrl = `https://wa.me/${sanitizedPhone}?text=${whatsappMessage}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Wi-Fi - ${guide.welcome_title}`,
          text: `Red Wi-Fi: ${guide.wifi_ssid} | Clave: ${guide.wifi_password}`,
          url: window.location.href,
        });
      } catch {
        // Share cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(
          `Red Wi-Fi: ${guide.wifi_ssid}\nContraseña: ${guide.wifi_password}`
        );
        toast.success('Datos de Wi-Fi copiados al portapapeles');
      } catch {
        toast.error('No se pudo copiar');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-10 antialiased selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-indigo-600/20 via-rose-500/10 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px]">
              {guide.welcome_title}
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              {guide.apartment_number} • Conexión Rápida
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Compartir datos de Wi-Fi"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </header>

      {/* Central Glass Card */}
      <main className="max-w-md w-full mx-auto my-auto py-6 space-y-5 z-10">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl text-center space-y-6">
          {/* Badge & Title */}
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Internet de Alta Velocidad
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Conexión Wi-Fi
            </h2>
            <p className="text-xs text-slate-400">
              Apunta la cámara de tu teléfono al código para conectarte sin escribir la contraseña
            </p>
          </div>

          {/* High-Resolution QR Card */}
          <div className="flex justify-center">
            <div className="p-4 rounded-3xl bg-white shadow-xl shadow-indigo-950/50 border border-indigo-100 flex flex-col items-center">
              <QrCodeSvg value={wifiConnectQr} size={200} />
              <p className="text-[10px] font-mono text-slate-500 mt-2 font-semibold tracking-wider">
                ESCANEAR PARA CONECTAR
              </p>
            </div>
          </div>

          {/* Credentials Box */}
          <div className="space-y-2.5 text-left pt-1">
            {/* SSID */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Nombre de Red (SSID)
              </span>
              <p className="text-sm sm:text-base font-bold text-white font-mono select-all truncate mt-0.5">
                {guide.wifi_ssid}
              </p>
            </div>

            {/* Password */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
              <div className="min-w-0 pr-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Contraseña
                </span>
                <p className="text-sm sm:text-base font-bold text-white font-mono select-all truncate mt-0.5">
                  {showPassword ? guide.wifi_password : '••••••••••••'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Support & Full Guide Links */}
          <div className="pt-2 grid grid-cols-2 gap-2.5">
            <Link
              to={propertyId ? `/guide/${propertyId}` : '/guide'}
              className="inline-flex items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 transition-colors"
            >
              <Compass className="w-4 h-4 text-rose-400" />
              <span>Ver Guía Completa</span>
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 p-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Ayuda Anfitrión</span>
            </a>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Red privada segura para huéspedes de {guide.welcome_title}</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-600 z-10">
        {guide.apartment_number} • {guide.address}
      </footer>
    </div>
  );
}
