import { DEFAULT_PROPERTY_ID } from './supabase';
import type { Booking, Expense, Damage, RecurringBillTemplate, Property } from '@/types/database';

export const INITIAL_PROPERTY: Property = {
  id: DEFAULT_PROPERTY_ID,
  name: 'Reserva del Mar II',
  address: 'Playa Salguero, Santa Marta',
  city: 'Santa Marta',
  currency: 'COP',
  default_nightly_rate: 280000,
  default_cleaning_fee: 60000,
  monthly_revenue_target: 3000000,
  management_fee_rate: 20.0,
  check_in_time: '15:00',
  check_out_time: '11:00',
};

export const INITIAL_TEMPLATES: RecurringBillTemplate[] = [
  {
    id: 'tmpl-1',
    property_id: DEFAULT_PROPERTY_ID,
    category: 'hoa_administration',
    expense_type: 'fixed_monthly',
    name: 'Administración del Edificio',
    default_amount: 380000,
    typical_due_day: 10,
    annual_due_month: null,
    is_active: true,
    notes: 'Pago antes del día 10 para descuento de pronto pago',
  },
  {
    id: 'tmpl-2',
    property_id: DEFAULT_PROPERTY_ID,
    category: 'internet_cable',
    expense_type: 'fixed_monthly',
    name: 'Internet Fibra 300MB (Tigo)',
    default_amount: 125000,
    typical_due_day: 15,
    annual_due_month: null,
    is_active: true,
    notes: 'Débito automático bancario',
  },
  {
    id: 'tmpl-3',
    property_id: DEFAULT_PROPERTY_ID,
    category: 'electricity',
    expense_type: 'utility_monthly',
    name: 'Energía / Luz (EPM)',
    default_amount: 290000,
    typical_due_day: 20,
    annual_due_month: null,
    is_active: true,
    notes: 'Medidor de luz del apartamento',
  },
  {
    id: 'tmpl-4',
    property_id: DEFAULT_PROPERTY_ID,
    category: 'water',
    expense_type: 'utility_monthly',
    name: 'Agua y Alcantarillado (EPM)',
    default_amount: 110000,
    typical_due_day: 20,
    annual_due_month: null,
    is_active: true,
    notes: 'Factura conjunta EPM',
  },
  {
    id: 'tmpl-5',
    property_id: DEFAULT_PROPERTY_ID,
    category: 'gas',
    expense_type: 'utility_monthly',
    name: 'Gas Domiciliario (EPM)',
    default_amount: 35000,
    typical_due_day: 20,
    annual_due_month: null,
    is_active: true,
    notes: 'Calentador y estufa',
  },
  {
    id: 'tmpl-6',
    property_id: DEFAULT_PROPERTY_ID,
    category: 'insurance_annual',
    expense_type: 'annual',
    name: 'Póliza Todo Riesgo Apartamento (SURA)',
    default_amount: 1350000,
    typical_due_day: 15,
    annual_due_month: 6,
    is_active: true,
    notes: 'Vence el 15 de Junio de cada año',
  },
];

export const INITIAL_BOOKINGS: Booking[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_DAMAGES: Damage[] = [];

export const INITIAL_GUEST_GUIDE: import('@/types/database').GuestGuideData = {
  property_id: DEFAULT_PROPERTY_ID,
  welcome_title: '¡Bienvenido a Reserva del Mar II!',
  welcome_message: 'Esperamos que disfrutes al máximo de tu estadía frente al mar en Santa Marta. Aquí tienes toda la información clave para una experiencia perfecta e inolvidable.',
  apartment_number: 'Apto 502',
  address: 'Carrera 1 # 24-45, Playa Salguero, Santa Marta, Colombia',
  maps_url: 'https://maps.google.com/?q=Playa+Salguero+Santa+Marta',
  
  // Wi-Fi
  wifi_ssid: 'ReservaMar_502_5G',
  wifi_password: 'PlayaSalguero2026!',
  
  // Access & Keys
  show_access_code: true,
  access_code: '4820 #',
  access_instructions: 'Al llegar a la portería principal del edificio, indica tu nombre completo y número de cédula/pasaporte. El vigilante te entregará las manillas del conjunto. En la puerta del apto 502, toca la pantalla de la cerradura táctil para encenderla, ingresa el código y presiona la tecla #.',
  check_in_time: '15:00',
  check_out_time: '11:00',
  check_out_instructions: 'Por favor apaga los aires acondicionados y luces, deposita la basura en el shut de basuras del piso (frente a los ascensores) y cierra la puerta jalando firmemente hasta escuchar el pitido de seguro. ¡Buen viaje de regreso!',
  
  // Host Contact
  host_name: 'Axel Werner',
  host_phone: '+57 300 123 4567',
  host_email: 'contacto@reservaaptos.com',
  
  // Building & Services
  building_amenities: [
    'Piscinas infinitas (Piso 1 y Rooftop)',
    'Acceso directo privado a la playa',
    'Jacuzzis climatizados',
    'Gimnasio con vista al mar (Piso 18)',
    'Zona de sauna y turco',
    'Canchas de squash',
    'Seguridad y recepción 24 horas',
  ],
  house_rules: [
    {
      id: 'hr-1',
      icon: 'Volume2',
      title: 'Horas de Silencio y Tranquilidad',
      description: 'Por convivencia del conjunto, el volumen de música y ruidos debe ser moderado después de las 10:00 PM.',
    },
    {
      id: 'hr-2',
      icon: 'CigaretteOff',
      title: 'Espacio 100% Libre de Humo',
      description: 'Está estrictamente prohibido fumar o vapear dentro del apartamento y en los balcones.',
    },
    {
      id: 'hr-3',
      icon: 'Users',
      title: 'Registro de Visitantes',
      description: 'Solo las personas registradas en la reserva tienen permitido el ingreso a las instalaciones y zonas comunes.',
    },
    {
      id: 'hr-4',
      icon: 'Sparkles',
      title: 'Cuidado de Toallas y Lencería',
      description: 'Las toallas blancas son de uso exclusivo para el interior del apto. Para la piscina y playa, favor usar las toallas azules provistas.',
    },
  ],
  appliances: [
    {
      id: 'app-1',
      title: 'Aires Acondicionados',
      icon: 'AirVent',
      steps: [
        'Usa el control remoto apuntando directamente al split.',
        'Recomendamos temperatura en 22°C - 24°C modo "COOL" (ícono de copo de nieve).',
        'Mantén ventanas y puertas corredizas cerradas para optimizar el enfriamiento.',
      ],
      tips: 'Apágalos al salir del apartamento para proteger los equipos y evitar sobrecalentamiento.',
    },
    {
      id: 'app-2',
      title: 'Smart TV & Streaming',
      icon: 'Tv',
      steps: [
        'Enciende la pantalla con el botón rojo del control.',
        'Dispones de aplicaciones como Netflix, YouTube y Prime Video.',
        'Puedes iniciar sesión con tus propias cuentas personales.',
      ],
      tips: 'Al hacer check-out se cierran automáticamente las sesiones activas.',
    },
    {
      id: 'app-3',
      title: 'Agua Caliente (Calentador)',
      icon: 'Flame',
      steps: [
        'El calentador es automático y se activa con la presión del agua.',
        'Gira la llave de la ducha completamente hacia la izquierda y espera 30 segundos.',
      ],
      tips: 'Si sientes el agua demasiado caliente, mezcla suavemente con la llave derecha.',
    },
    {
      id: 'app-4',
      title: 'Torre Lavadora / Secadora',
      icon: 'Waves',
      steps: [
        'Coloca la ropa sin sobrecargar el tambor.',
        'Añade una tapa de detergente líquido en el compartimento superior.',
        'Selecciona el ciclo "Lavado Rápido 30min" o "Normal" y presiona Inicio.',
      ],
      tips: 'Encuentras detergente de cortesía en el mueble bajo el lavadero.',
    },
  ],
  recommendations: [
    {
      id: 'rec-1',
      title: 'Restaurante Donde Chucho Blue',
      category: 'restaurant',
      description: 'Famoso por su cazuela de mariscos, pescados frescos y vista espectacular al atardecer.',
      address: 'Playa Salguero',
      distance: 'A 4 min a pie',
      maps_url: 'https://maps.google.com/?q=Donde+Chucho+Blue+Santa+Marta',
    },
    {
      id: 'rec-2',
      title: 'Café Bonsái & Bakery',
      category: 'cafe',
      description: 'Excelente café colombiano de especialidad, desayunos saludables y repostería artesanal.',
      address: 'Calle 23 # 2-18, Rodadero Sur',
      distance: 'A 6 min a pie',
      maps_url: 'https://maps.google.com/?q=Cafe+Bonsai+Santa+Marta',
    },
    {
      id: 'rec-3',
      title: 'Supermercado Éxito Express',
      category: 'supermarket',
      description: 'Ideal para compras rápidas, bebidas, snacks y víveres del día a día.',
      address: 'Carrera 2 con Calle 20',
      distance: 'A 500 metros',
      maps_url: 'https://maps.google.com/?q=Exito+Express+Rodadero+Sur',
    },
    {
      id: 'rec-4',
      title: 'Droguería La Rebaja / Farmacia',
      category: 'pharmacy',
      description: 'Medicamentos, artículos de aseo personal, bloqueador solar y servicio 24 horas a domicilio.',
      address: 'Av. Tamacá # 15-20',
      distance: 'A 800 metros',
      maps_url: 'https://maps.google.com/?q=Drogueria+La+Rebaja+Rodadero',
    },
    {
      id: 'rec-5',
      title: 'Taxis y Transporte Seguro',
      category: 'transport',
      description: 'Recomendamos pedir taxi a través de InDrive o solicitarlo en la portería del edificio.',
      address: 'Portería Principal',
      distance: 'En el lobby',
    },
  ],
  emergency_contacts: [
    {
      id: 'em-1',
      title: 'Recepción & Portería 24H',
      phone: '+57 (605) 420 8899',
      description: 'Guardas de seguridad y administración del edificio',
      icon: 'Shield',
    },
    {
      id: 'em-2',
      title: 'WhatsApp Anfitrión (Soporte Directo)',
      phone: '+57 300 123 4567',
      description: 'Axel Werner - Atención y dudas de la estadía',
      icon: 'PhoneCall',
    },
    {
      id: 'em-3',
      title: 'Línea de Emergencias Nacional',
      phone: '123',
      description: 'Policía Nacional, Bomberos y Ambulancias',
      icon: 'AlertTriangle',
    },
    {
      id: 'em-4',
      title: 'Clínica Portoazul / Centro Médico',
      phone: '+57 (605) 438 0000',
      description: 'Atención médica prioritaria y urgencias',
      icon: 'HeartPulse',
    },
  ],
};

