import { useState } from 'react';
import { Wifi, Copy, Check, Eye, EyeOff, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { QrCodeSvg } from './QrCodeSvg';

interface WifiCardProps {
  ssid: string;
  password: string;
}

export function WifiCard({ ssid, password }: WifiCardProps) {
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success('¡Contraseña de Wi-Fi copiada al portapapeles!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('No se pudo copiar automáticamente');
    }
  };

  // Standard WIFI QR format: WIFI:T:WPA;S:MyNetwork;P:MyPassword;;
  const wifiQrString = `WIFI:T:WPA;S:${ssid};P:${password};;`;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-xl border border-indigo-500/20">
      {/* Background ambient decoration */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-indigo-300 border border-white/10 shadow-inner">
              <Wifi className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Conexión a Internet</p>
              <h3 className="text-lg font-bold text-white tracking-tight">Red Wi-Fi de Alta Velocidad</h3>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setShowQrModal(!showQrModal)}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition-colors border border-white/10 flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="Ver código QR para conectar rápido"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Código QR</span>
          </button>
        </div>

        {/* Network & Password Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* SSID */}
          <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Nombre de Red (SSID)</span>
            <p className="text-base font-bold text-white font-mono select-all truncate">{ssid || 'Sin configurar'}</p>
          </div>

          {/* Password */}
          <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Contraseña</span>
              <p className="text-base font-bold text-white font-mono select-all truncate">
                {showPassword ? (password || '••••••••') : '••••••••••••'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label="Ver u ocultar contraseña"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
                title="Copiar contraseña"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* QR Modal / Drawer preview */}
        {showQrModal && (
          <div className="mt-4 p-5 rounded-2xl bg-black/40 border border-indigo-400/20 backdrop-blur-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <p className="text-xs font-medium text-slate-300 mb-3">
              Escanea con la cámara de tu teléfono para conectarte automáticamente:
            </p>
            <QrCodeSvg value={wifiQrString} size={160} />
            <p className="text-[11px] text-slate-400 mt-2 font-mono">{ssid}</p>
          </div>
        )}
      </div>
    </div>
  );
}
