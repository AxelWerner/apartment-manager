import { useState } from 'react';
import { useGuestGuide, useUpdateGuestGuide } from '@/hooks/use-guest-guide';
import { QrCodeSvg } from '@/components/guide/QrCodeSvg';
import {
  QrPrintTemplate,
  type FixedTemplateOptions,
  type TemplateVariant,
} from '@/components/guide/QrPrintTemplate';
import {
  Sparkles,
  Save,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Smartphone,
  Wifi,
  Lock,
  MessageCircle,
  FileText,
  Printer,
  LayoutTemplate,
  Clock,
  Navigation,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { GuestGuideData, KeyDistance } from '@/types/database';

export default function GuestGuideAdmin() {
  const { data: guide, isLoading } = useGuestGuide();
  const updateGuideMutation = useUpdateGuestGuide();

  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'share' | 'poster'>('editor');
  const [formData, setFormData] = useState<GuestGuideData | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWifiLink, setCopiedWifiLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const [posterOptions, setPosterOptions] = useState<FixedTemplateOptions>({
    variant: 'essential',
    size: 'a5',
    language: 'bilingual',
    theme: 'sage',
  });

  const handleUpdateDistance = (index: number, updatedItem: Partial<KeyDistance>) => {
    if (!formData) return;
    const list = [...(formData.key_distances || [])];
    list[index] = { ...list[index], ...updatedItem };
    setFormData({ ...formData, key_distances: list });
  };

  const handleAddDistance = () => {
    if (!formData) return;
    const newDistance: KeyDistance = {
      id: `dist-${Date.now()}`,
      name: '',
      category: 'beach',
      distance: '',
      travel_time: '',
      description: '',
      maps_url: '',
    };
    setFormData({
      ...formData,
      key_distances: [...(formData.key_distances || []), newDistance],
    });
  };

  const handleDeleteDistance = (index: number) => {
    if (!formData) return;
    const list = (formData.key_distances || []).filter((_, i) => i !== index);
    setFormData({ ...formData, key_distances: list });
  };

  // Initialize form state once loaded
  if (guide && !formData) {
    setFormData(guide);
  }

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">Cargando datos de la guía...</p>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/guide`;
  const wifiUrl = `${window.location.origin}/wifi`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateGuideMutation.mutateAsync(formData);
      toast.success('Guía del huésped guardada correctamente');
    } catch {
      toast.error('Error al guardar la guía');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      toast.success('Enlace de la guía copiado al portapapeles');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleCopyWifiLink = async () => {
    try {
      await navigator.clipboard.writeText(wifiUrl);
      setCopiedWifiLink(true);
      toast.success('Enlace de Wi-Fi copiado al portapapeles');
      setTimeout(() => setCopiedWifiLink(false), 2500);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const welcomeTemplate = `¡Hola! 👋 Te damos una muy cordial bienvenida a ${formData.welcome_title}.

Para que disfrutes al máximo de tu estancia, aquí tienes el enlace directo a nuestra **Guía Digital del Apartamento**:
🔗 ${publicUrl}

Allí encontrarás:
📶 Nombre y contraseña de la red Wi-Fi
🔑 Instrucciones de llegada y acceso
📍 Distancias al aeropuerto, playas y puntos de interés
💡 Uso de aire acondicionado y servicios
🍽️ Recomendaciones de restaurantes y supermercados cercanos

¡Cualquier duda o asistencia que necesites, escríbenos directamente por este chat de Airbnb!`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(welcomeTemplate);
      setCopiedMessage(true);
      toast.success('Mensaje de bienvenida copiado al portapapeles');
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handlePrint = () => {
    window.print();
  };


  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Guía Digital del Huésped
            </h1>
            <span className="text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-200/60 dark:border-rose-800/40">
              Guest Portal
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configura la información visible para tus huéspedes, genera el código QR y comparte el enlace público
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/guide/poster"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-xs hover:opacity-90 transition-opacity"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Lámina QR</span>
          </a>

          <a
            href="/guide"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors"
          >
            <span>Abrir Portal Público</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'editor'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Editor de Contenidos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('poster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'poster'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <LayoutTemplate className="w-4 h-4 text-rose-500" />
          <span>Plantilla Imprimible QR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('share')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'share'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Enlaces y QR Rápido</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'preview'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Previsualización Móvil</span>
        </button>
      </div>


      {/* TAB 1: EDITOR */}
      {activeTab === 'editor' && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* 1. General & Welcome */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Información de Bienvenida y Ubicación
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título de Bienvenida *
                </label>
                <input
                  type="text"
                  value={formData.welcome_title}
                  onChange={(e) => setFormData({ ...formData, welcome_title: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Número o Nombre de Unidad *
                </label>
                <input
                  type="text"
                  value={formData.apartment_number}
                  onChange={(e) => setFormData({ ...formData, apartment_number: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="ej. Apto 502"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mensaje de Bienvenida
                </label>
                <textarea
                  value={formData.welcome_message}
                  onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección Completa
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enlace de Google Maps / Waze
                </label>
                <input
                  type="url"
                  value={formData.maps_url}
                  onChange={(e) => setFormData({ ...formData, maps_url: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="https://maps.google.com/?q=..."
                />
              </div>
            </div>
          </div>

          {/* 2. Wi-Fi Settings */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Wifi className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Configuración de Red Wi-Fi
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de Red (SSID) *
                </label>
                <input
                  type="text"
                  value={formData.wifi_ssid}
                  onChange={(e) => setFormData({ ...formData, wifi_ssid: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña de Wi-Fi *
                </label>
                <input
                  type="text"
                  value={formData.wifi_password}
                  onChange={(e) => setFormData({ ...formData, wifi_password: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. Access & Smart Lock */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Acceso, Horarios y Cerradura Inteligente
                </h2>
              </div>
            </div>

            {/* Toggle: Show/Hide Access Code publicly */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  ¿Mostrar código de cerradura públicamente en la guía?
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Si lo desactivas, los huéspedes verán un mensaje indicando que el código se enviará en privado por el chat de Airbnb.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={formData.show_access_code}
                  onChange={(e) => setFormData({ ...formData, show_access_code: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Código de Cerradura (PIN)
                </label>
                <input
                  type="text"
                  value={formData.access_code}
                  onChange={(e) => setFormData({ ...formData, access_code: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  placeholder="ej. 4820 #"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Horario Check-In
                </label>
                <input
                  type="text"
                  value={formData.check_in_time}
                  onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="15:00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Horario Check-Out
                </label>
                <input
                  type="text"
                  value={formData.check_out_time}
                  onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="11:00"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Instrucciones de Llegada y Portería
                </label>
                <textarea
                  value={formData.access_instructions}
                  onChange={(e) => setFormData({ ...formData, access_instructions: e.target.value })}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Instrucciones de Salida (Check-Out)
                </label>
                <textarea
                  value={formData.check_out_instructions}
                  onChange={(e) => setFormData({ ...formData, check_out_instructions: e.target.value })}
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 4. Host & Airbnb Contact */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <MessageCircle className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Contacto del Anfitrión (Chat de Airbnb)
              </h2>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300">
              Todas las consultas y solicitudes de los huéspedes en la guía digital se canalizan directamente al chat oficial de la reserva en Airbnb.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Anfitrión
                </label>
                <input
                  type="text"
                  value={formData.host_name}
                  onChange={(e) => setFormData({ ...formData, host_name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Ej: Axel Werner"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono de Respaldo / Emergencias
                </label>
                <input
                  type="text"
                  value={formData.host_phone}
                  onChange={(e) => setFormData({ ...formData, host_phone: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  placeholder="+57 300 123 4567"
                />
              </div>
            </div>
          </div>

          {/* 5. Distancias a Lugares Clave */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Navigation className="w-4 h-4 text-rose-500" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Distancias y Puntos de Interés Clave
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Información sobre distancias al aeropuerto, centros, playas y hospitales
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddDistance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Destino</span>
              </button>
            </div>

            {/* List of Distances */}
            <div className="space-y-3">
              {(formData.key_distances || []).map((dist, idx) => (
                <div
                  key={dist.id || idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      #{idx + 1} Lugar / Destino
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteDistance(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      title="Eliminar este lugar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Nombre del Lugar o Punto de Interés *
                      </label>
                      <input
                        type="text"
                        value={dist.name}
                        onChange={(e) => handleUpdateDistance(idx, { name: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="Ej: Aeropuerto Internacional Simón Bolívar (SMR)"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Categoría
                      </label>
                      <select
                        value={dist.category}
                        onChange={(e) =>
                          handleUpdateDistance(idx, {
                            category: e.target.value as KeyDistance['category'],
                          })
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="airport">✈️ Aeropuerto</option>
                        <option value="beach">🏖️ Playa</option>
                        <option value="center">🏙️ Centro Urbano</option>
                        <option value="hospital">🏥 Salud / Urgencias</option>
                        <option value="attraction">🌴 Turismo / Naturaleza</option>
                        <option value="supermarket">🛒 Supermercado</option>
                        <option value="transport">🚗 Transporte</option>
                        <option value="other">📍 Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Distancia (km / metros) *
                      </label>
                      <input
                        type="text"
                        value={dist.distance}
                        onChange={(e) => handleUpdateDistance(idx, { distance: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="Ej: 10 km o 50 metros"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Tiempo Estimado de Traslado
                      </label>
                      <input
                        type="text"
                        value={dist.travel_time || ''}
                        onChange={(e) => handleUpdateDistance(idx, { travel_time: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="Ej: 15 min en taxi / 2 min a pie"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Enlace Google Maps (Opcional)
                      </label>
                      <input
                        type="url"
                        value={dist.maps_url || ''}
                        onChange={(e) => handleUpdateDistance(idx, { maps_url: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="https://maps.google.com/..."
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Descripción o Tips para el Huésped
                      </label>
                      <input
                        type="text"
                        value={dist.description || ''}
                        onChange={(e) => handleUpdateDistance(idx, { description: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="Ej: Terminal aérea con vuelos directos a Bogotá, Medellín y Cali."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit button bar */}
          <div className="sticky bottom-4 z-20 flex justify-end">
            <button
              type="submit"
              disabled={updateGuideMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{updateGuideMutation.isPending ? 'Guardando...' : 'Guardar Cambios de la Guía'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB: PRINTABLE QR POSTER TEMPLATE */}
      {activeTab === 'poster' && (
        <div className="space-y-6">
          {/* Header & Quick actions for Poster */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                  Lámina de Bienvenida para Marco o Mesa
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Plantillas Fijas de Lámina Imprimible con QR
                </h2>
                <p className="text-xs text-slate-500 max-w-xl mt-0.5">
                  Elige entre las 3 variantes listas para imprimir según la información que deseas destacar en el apartamento.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/guide/poster"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pantalla Completa</span>
                </a>
                <button
                  type="button"
                  onClick={() => window.open('/guide/poster', '_blank')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Lámina</span>
                </button>
              </div>
            </div>

            {/* 2 Fixed Variants Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  {
                    id: 'essential' as TemplateVariant,
                    title: '1. Guía Digital e Información Clave',
                    desc: 'QR Guía + Horarios de Entrada/Salida + Normas del Apto + Contacto',
                    icon: Clock,
                  },
                  {
                    id: 'wifi_only' as TemplateVariant,
                    title: '2. Solo Conexión Wi-Fi',
                    desc: 'QR Wi-Fi Directo + Red (SSID) y Clave en grande',
                    icon: Wifi,
                  },
                ]
              ).map((v) => {

                const Icon = v.icon;
                const isSelected = posterOptions.variant === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setPosterOptions({ ...posterOptions, variant: v.id })}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">{v.title}</p>
                      <p
                        className={`text-[10px] mt-0.5 leading-snug ${
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

            {/* Fixed Format & Theme Picker */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Formato:</span>
                <span className="px-2.5 py-1 rounded-lg font-semibold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  A5 • Bilingüe (Español + English)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Tema Pastel:</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'sage' as const, label: 'Salvia', dot: 'bg-emerald-500' },
                    { id: 'sky' as const, label: 'Cielo', dot: 'bg-sky-500' },
                    { id: 'sand' as const, label: 'Arena', dot: 'bg-amber-400' },
                    { id: 'lavender' as const, label: 'Lavanda', dot: 'bg-purple-400' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPosterOptions({ ...posterOptions, theme: t.id })}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs border transition-colors cursor-pointer ${
                        (posterOptions.theme || 'sage') === t.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview of the Sheet */}
          <div className="flex justify-center p-4 sm:p-8 bg-slate-100 dark:bg-slate-950/60 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <QrPrintTemplate
              guide={formData}
              options={posterOptions}
              guideUrl={publicUrl}
            />
          </div>
        </div>
      )}


      {/* TAB 3: SHARE & QUICK QR CODE */}
      {activeTab === 'share' && (
        <div className="space-y-6">
          {/* Highlight Banner: Complete Printable Poster */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white shadow-lg space-y-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                Recomendado para el Apartamento
              </span>
              <h3 className="text-xl font-extrabold tracking-tight">
                Plantilla Imprimible con QR e Información Clave
              </h3>
              <p className="text-xs text-rose-100 max-w-xl">
                Diseñada para marcos de fotos o atriles. Muestra el Wi-Fi, horarios, normas y contacto directamente en papel, con el QR hacia la guía interactiva completa.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('poster')}
                className="px-4 py-2.5 rounded-xl bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Personalizar Plantilla
              </button>
              <a
                href="/guide/poster"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-black/20 hover:bg-black/30 text-white transition-colors"
                title="Abrir en pantalla completa e imprimir"
              >
                <Printer className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. In-Apartment Physical Wi-Fi QR Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-col items-center text-center space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                Para el Apartamento
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">
                  📶 Código QR Físico (Enmarcado / Mesa)
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Lámina Wi-Fi para el Inmueble
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Código QR directo para imprimir y colocar en el salón o mesita de noche. Al escanearlo, el huésped entra a la página exclusiva de Wi-Fi y conexión instantánea.
                </p>
              </div>


              {/* QR Code */}
              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 shadow-inner">
                <QrCodeSvg value={wifiUrl} size={180} />
              </div>

              <div className="space-y-1.5 w-full">
                <p className="text-xs font-mono text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 p-2 rounded-xl select-all truncate border border-indigo-200/60 dark:border-indigo-800/40">
                  {wifiUrl}
                </p>
                <div className="flex justify-between text-[11px] text-slate-500 px-1">
                  <span>Red: <strong className="font-mono text-slate-700 dark:text-slate-300">{formData.wifi_ssid}</strong></span>
                  <span>Clave: <strong className="font-mono text-slate-700 dark:text-slate-300">{formData.wifi_password}</strong></span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2 justify-center w-full">
                <a
                  href="/wifi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Lámina Wi-Fi</span>
                </a>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Lámina</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyWifiLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {copiedWifiLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar Enlace</span>
                </button>
              </div>

            </div>

            {/* 2. Full Digital Guide QR Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-col items-center text-center space-y-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold tracking-widest text-rose-600 dark:text-rose-400 uppercase">
                  📖 Portal Digital Completo
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Guía Digital del Huésped
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Enlace completo para compartir por el chat de Airbnb con normas, electrodomésticos, mapas, horarios y servicios.
                </p>
              </div>

              {/* QR Code */}
              <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 shadow-inner">
                <QrCodeSvg value={publicUrl} size={180} />
              </div>

              <div className="space-y-1.5 w-full">
                <p className="text-xs font-mono text-rose-900 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 p-2 rounded-xl select-all truncate border border-rose-200/60 dark:border-rose-800/40">
                  {publicUrl}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formData.welcome_title} • {formData.apartment_number}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap gap-2 justify-center w-full">
                <a
                  href="/guide"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver Portal</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar Enlace</span>
                </button>
              </div>
            </div>
          </div>

          {/* Airbnb Welcome Template */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Plantilla de Mensaje para Enviar al Huésped (Chat de Airbnb)
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {copiedMessage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMessage ? '¡Copiado!' : 'Copiar Mensaje'}</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-sans text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {welcomeTemplate}
            </div>
          </div>
        </div>
      )}


      {/* TAB 3: MOBILE PREVIEW */}
      {activeTab === 'preview' && (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-xs text-slate-500">
            Vista simulada del portal en pantalla de teléfono móvil:
          </p>

          <div className="w-full max-w-[400px] h-[750px] rounded-[40px] border-[8px] border-slate-800 dark:border-slate-700 bg-slate-950 overflow-hidden shadow-2xl relative">
            <iframe
              src="/guide"
              title="Guest Portal Live Preview"
              className="w-full h-full border-none bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
}
