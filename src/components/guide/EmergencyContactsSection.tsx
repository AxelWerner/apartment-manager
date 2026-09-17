import type { EmergencyContact } from '@/types/database';
import {
  PhoneCall,
  Shield,
  AlertTriangle,
  HeartPulse,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  PhoneCall,
  Shield,
  AlertTriangle,
  HeartPulse,
};

interface EmergencyContactsSectionProps {
  contacts: EmergencyContact[];
  hostPhone: string;
  hostName: string;
  propertyName: string;
}

export function EmergencyContactsSection({
  contacts,
  hostPhone,
  hostName,
  propertyName,
}: EmergencyContactsSectionProps) {
  // WhatsApp link format
  const sanitizedPhone = hostPhone.replace(/[^0-9]/g, '');
  const whatsappMessage = encodeURIComponent(
    `¡Hola ${hostName || 'Anfitrión'}! Me encuentro hospedado en ${propertyName} y tengo una consulta sobre mi estancia:`
  );
  const whatsappUrl = `https://wa.me/${sanitizedPhone}?text=${whatsappMessage}`;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Contactos de Soporte y Emergencia</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Atención del anfitrión, administración del edificio y líneas de auxilio
        </p>
      </div>

      {/* Host Direct WhatsApp Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-full bg-white/20">
              <MessageCircle className="w-4 h-4 text-white" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Chat Directo de Asistencia
            </span>
          </div>
          <h4 className="text-base font-bold text-white">¿Tienes alguna duda durante tu estadía?</h4>
          <p className="text-xs text-emerald-50">
            Escríbele directamente a tu anfitrión por WhatsApp ({hostName || 'Anfitrión'}).
          </p>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-800 font-bold text-xs shadow-md hover:bg-emerald-50 active:scale-95 transition-all shrink-0 cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 fill-emerald-600 text-white" />
          <span>Escribir por WhatsApp</span>
        </a>
      </div>

      {/* Other Contacts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {contacts.map((contact) => {
          const Icon = (contact.icon && iconMap[contact.icon]) || HelpCircle;
          const cleanTel = contact.phone.replace(/[^0-9+]/g, '');

          return (
            <div
              key={contact.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {contact.title}
                  </h4>
                  {contact.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {contact.description}
                    </p>
                  )}
                  <p className="text-xs font-mono text-slate-700 dark:text-slate-300 font-semibold mt-0.5">
                    {contact.phone}
                  </p>
                </div>
              </div>

              <a
                href={`tel:${cleanTel}`}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
                title={`Llamar a ${contact.title}`}
                aria-label={`Llamar a ${contact.title}`}
              >
                <PhoneCall className="w-4 h-4" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
