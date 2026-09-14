# 🏢 Apartment Manager (Airbnb Gestor de Apartamentos)

Plataforma integral de gestión operativa y financiera diseñada específicamente para la administración de apartamentos de alquiler vacacional / corta estancia (Airbnb, reservas directas) en Colombia, con cálculo y visualización financiera en **Pesos Colombianos (COP)**.

Permite a propietarios y anfitriones tener control total sobre sus ingresos netos, comisiones, pagos de administración y servicios públicos, pólizas anuales de seguro, control de daños/reclamaciones de AirCover y métricas clave de rentabilidad hotelera (ADR, RevPAR, tasa de ocupación).

---

## 🚀 Características Principales

### 1. 📊 Panel de Control Financiero y Métricas (Dashboard)
- **KPIs en tiempo real:**
  - **Beneficio Neto (Net Profit):** Ingresos netos menos gastos operativos totales.
  - **Ingresos por Liquidaciones (Net Payouts):** Dinero real recibido de las plataformas.
  - **Gastos Operativos:** Desglose entre costos fijos y variables.
  - **Tasa de Ocupación (%):** Porcentaje de noches reservadas en el periodo seleccionado.
  - **Tarifa Promedio Diaria (ADR):** Ingreso promedio generado por noche vendida.
  - **Meta Mensual de Ingresos:** Barra de progreso visual hacia el objetivo mensual de facturación.
- **Gráficos interactivos (Recharts):**
  - Flujo de caja mensual: Comparativa de Ingresos vs. Gastos y línea de tendencia de ganancia neta.
  - Distribución de gastos por categoría (gráfico de dona).
- **Widgets operativos rápidos:** Próximos check-ins y check-outs (7 días), facturas por vencer o vencidas, e incidentes de daños abiertos.
- **Filtro de periodo:** Selección por mes actual, mes anterior, año a la fecha (YTD) o rango personalizado.

---

### 2. 📅 Reservas e Importador Airbnb (Bookings)
- **Registro manual de reservas:**
  - Cálculo automático del número de noches según fechas de entrada y salida.
  - Desglose financiero: Tarifa por noche, tarifa de limpieza cobrada al huésped, comisión estimada de anfitrión Airbnb (~3%) y cálculo sugerido del pago neto (payout).
  - Posibilidad de ajustar manualmente el valor exacto liquidado por la plataforma.
- **Importador Inteligente de CSV de Airbnb:**
  - Asistente para cargar archivos CSV descargados del historial de transacciones o reservas de Airbnb.
  - Mapeo automático de columnas y detección de códigos de confirmación duplicados (`HM...`) para evitar duplicaciones accidentales.
  - Vista previa interactiva antes de importar en lote.
- **Seguimiento de estados:**
  - Estado de la reserva: *Confirmada*, *En curso (Checked-in)*, *Completada*, *Cancelada*.
  - Estado del pago: *Pendiente* o *Pagado* con fecha de cobro.

---

### 3. 💸 Gestión de Gastos y Facturas Recurrentes (Expenses)
Diseñado para la realidad operativa de un apartamento en arriendo turístico:
- **Lista de Chequeo Mensual (Monthly Checklist):**
  - **Costos Fijos:** Cuota de Administración del edificio (HOA) y suscripción a Internet / Wi-Fi.
  - **Servicios Públicos Variables (EPM / Acueducto):** Luz, Agua y Gas con fecha de vencimiento y registro del valor facturado.
  - Indicadores visuales de estado: 🟢 *Pagado*, 🟡 *Por vencer pronto (< 5 días)* y 🔴 *Vencido*.
  - Registro de pago en un clic y soporte para adjuntar foto del comprobante/factura.
- **Pólizas y Seguros Anuales:**
  - Seguimiento de la póliza de seguro del apartamento (fechas de inicio y renovación, valor anual y alertas a 30 días de vencer).
  - Cálculo amortizado de rentabilidad: opción de prorratear $1/12$ del costo de la póliza cada mes para análisis de flujo neto real.
- **Gastos Operativos Ocasionales y por Estadía:**
  - **Insumos y Reabastecimiento:** Compras de toallas, sábanas, café, artículos de aseo, etc.
  - **Limpieza y Lavandería por Turno:** Vinculación directa con una estadía específica para contrastar la tarifa de aseo cobrada vs. pagada.
  - **Mantenimiento y Reparaciones:** Arreglos locativos, plomería, cerrajería o pintura.

---

### 4. 🛠️ Hub de Daños, Incidentes y AirCover (Damages)
- **Registro de incidentes:**
  - Título, descripción y fecha del incidente.
  - Vinculación opcional con la reserva responsable del daño.
  - Nivel de severidad: *Bajo* (ej. copa rota), *Medio* (ej. toalla manchada), *Alto* (electrodoméstico averiado) o *Crítico* (inundación, cerradura rota).
  - Registro de costo estimado vs. costo real de reparación o reemplazo.
- **Galería de evidencia:** Almacenamiento y previsualización de fotografías del daño antes y después de reparar.
- **Flujo de reclamación:**
  - Pipeline de estados: `Detectado` ➡️ `Huésped contactado` ➡️ `Reclamación AirCover radicada` ➡️ `Aprobado / Reembolsado` ➡️ `Cerrado / Asumido`.
  - Número de caso de AirCover / Airbnb Resolution Center y notas de resolución.
- **Conversión a Gasto:** Botón directo para convertir el costo de reparación en un registro contable dentro del módulo de gastos (`maintenance_repairs`).

---

### 5. ⚙️ Configuración y Exportación de Datos (Settings)
- Datos del inmueble (nombre, dirección, ciudad, tarifa base por noche, tarifa de aseo por defecto, meta mensual de ingresos).
- Exportación y copia de seguridad de datos en formato JSON / CSV.

---

## 🛠️ Stack Tecnológico

| Capa | Herramienta | Propósito |
| :--- | :--- | :--- |
| **Frontend** | [React 19](https://react.dev/) + [Vite](https://vite.dev/) + [TypeScript](https://www.typescriptlang.org/) | SPA rápida, tipado estricto y excelente experiencia de desarrollo (DX). |
| **Estilos e UI** | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) | Componentes modernos, accesibles y diseño responsivo para móvil y escritorio. |
| **Iconografía** | [Lucide React](https://lucide.dev/) | Iconografía minimalista y coherente. |
| **Base de Datos** | [Supabase](https://supabase.com/) (PostgreSQL 15+) | Almacenamiento relacional con Row Level Security (RLS) y cliente REST tipado. |
| **Almacenamiento (Archivos)** | Supabase Storage (`apartment-media`) | Subida de fotos de comprobantes de pago y evidencias de daños. |
| **Estado y Caché** | [TanStack React Query v5](https://tanstack.com/query/latest) | Manejo de peticiones asíncronas, caché inteligente y revalidación automática. |
| **Formularios** | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) | Validación rigurosa de formularios y datos de entrada. |
| **Visualización** | [Recharts](https://recharts.org/) | Gráficas de barras, líneas y donas interactivas. |
| **Parseo CSV** | [PapaParse](https://www.papaparse.com/) | Procesamiento en cliente de archivos exportados por Airbnb. |
| **Manejo de Fechas** | [date-fns](https://date-fns.org/) | Operaciones de calendarios, noches de estancia y formateo en español. |
| **Moneda** | `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` | Moneda estándar en Pesos Colombianos sin decimales innecesarios (ej. `$ 350.000 COP`). |

---

## 🏛️ Arquitectura y Funcionamiento

```
┌────────────────────────────────────────────────────────┐
│                   React 19 + Vite UI                   │
│   (Dashboard, Bookings, Expenses, Damages, Settings)   │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│                   TanStack Query Hooks                 │
│         (useBookings, useExpenses, useDamages, etc.)   │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│                   API Service Layer                    │
│   (src/lib/api-service.ts con fallback automático)     │
└───────┬────────────────────────────────────────┬───────┘
        │                                        │
        ▼ (Si Supabase está configurado)         ▼ (Offline / Local Fallback)
┌────────────────────────────────┐       ┌────────────────────────────────┐
│       Supabase Database        │       │      Navegador (LocalStorage)  │
│  (PostgreSQL + RLS + Storage)  │       │     (Datos persistidos local)  │
└────────────────────────────────┘       └────────────────────────────────┘
```

### Tolerancia a Fallos y Modo Offline
La capa de servicio (`src/lib/api-service.ts`) implementa una arquitectura híbrida:
- Si las variables de Supabase están configuradas en `.env.local` y el servicio está en línea, todas las operaciones de lectura y escritura se sincronizan en la nube.
- Si no hay conexión o no se ha configurado Supabase aún, la aplicación almacena y sincroniza de inmediato todos los datos en `localStorage`, permitiendo probar y usar la plataforma en local sin dependencias externas obligatorias.

---

## 📂 Estructura del Proyecto

```
apartment-manager/
├── data/                       # Muestras de CSV de Airbnb para pruebas
├── docs/
│   └── BLUEPRINT.md            # Especificación técnica y funcional detallada
├── scripts/
│   └── seed.ts                 # Script para poblar Supabase con datos de prueba
├── src/
│   ├── components/
│   │   ├── bookings/           # Modales de nueva reserva e importador CSV
│   │   ├── damages/            # Modales de reporte e inspección de incidentes
│   │   ├── dashboard/          # Tarjetas de métricas y gráficos del panel
│   │   ├── expenses/           # Checklist mensual, póliza anual y formularios
│   │   ├── layout/             # Barra de navegación superior y diseño responsivo
│   │   └── ui/                 # Primitivas reutilizables (inputs de moneda, modales, etc.)
│   ├── hooks/                  # Custom React Hooks con TanStack Query
│   ├── lib/
│   │   ├── api-service.ts      # Cliente unificado de datos (Supabase + LocalStorage)
│   │   ├── formatters.ts       # Formateadores de moneda COP y fechas en español
│   │   ├── mock-data.ts        # Datos iniciales de demostración
│   │   └── supabase.ts         # Inicialización del cliente Supabase
│   ├── routes/                 # Páginas principales (Dashboard, Bookings, Expenses, etc.)
│   ├── types/                  # Definiciones TypeScript de la base de datos y entidades
│   └── App.tsx                 # Enrutador principal de React Router
└── supabase/
    └── migrations/
        └── 001_master_schema.sql # Esquema SQL maestro (tablas, enums, índices y RLS)
```

---

## ⚙️ Instalación y Puesta en Marcha

### Prerrequisitos
- [Node.js](https://nodejs.org/) v20 o superior
- [pnpm](https://pnpm.io/) instalado globalmente (`npm install -g pnpm`)

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone git@github.com:AxelWerner/apartment-manager.git
cd apartment-manager
pnpm install
```

### 2. Configurar variables de entorno (Opcional para Supabase)
Copia el archivo de ejemplo o crea `.env.local`:
```bash
cp .env.example .env.local
```

Define tus credenciales de Supabase:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

> **Nota:** La aplicación funcionará con datos de demostración y almacenamiento local (`localStorage`) incluso si omites este paso.

### 3. Configurar la base de datos en Supabase (Si usas Supabase)
1. Abre la consola de tu proyecto en [Supabase](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta el script contenido en `supabase/migrations/001_master_schema.sql`.
3. Crea un bucket público de almacenamiento llamado `apartment-media` en **Storage**.
4. (Opcional) Ejecuta el seeder para poblar la base de datos con datos de demostración:
   ```bash
   pnpm seed
   ```

### 4. Iniciar el servidor de desarrollo
```bash
pnpm dev
```
Abre en tu navegador [http://localhost:5173](http://localhost:5173).

---

## 🧪 Scripts Disponibles

```bash
pnpm dev             # Inicia el servidor de desarrollo Vite con Hot Module Replacement (HMR)
pnpm build           # Ejecuta comprobación de tipos de TypeScript y compila para producción
pnpm preview         # Previsualiza la compilación de producción en local
pnpm lint            # Analiza el código fuente con ESLint
pnpm test            # Ejecuta la suite de pruebas unitarias con Vitest
pnpm test:watch      # Ejecuta las pruebas en modo observador interactivo
pnpm test:coverage   # Genera informe de cobertura de pruebas
pnpm seed            # Pobla la base de datos Supabase con datos iniciales de prueba
```

---

## 📋 Fórmulas y Métricas Implementadas

- **Beneficio Neto (Net Cash Flow):**
  $$\text{Ganancia Neta} = \sum \text{Pagos Netos (Reservas)} - \sum \text{Gastos Operativos}$$
- **Margen de Ganancia (%):**
  $$\text{Margen (\%)} = \left( \frac{\text{Ganancia Neta}}{\text{Ingresos Brutos}} \right) \times 100$$
- **Tasa de Ocupación (%):**
  $$\text{Ocupación (\%)} = \left( \frac{\text{Noches Reservadas en el Periodo}}{\text{Días Calendario del Periodo}} \right) \times 100$$
- **Tarifa Promedio Diaria (ADR):**
  $$\text{ADR} = \frac{\sum \text{Ingresos Brutos por Noche}}{\sum \text{Noches Reservadas}}$$
- **RevPAR (Ingreso por Noche Disponible):**
  $$\text{RevPAR} = \text{ADR} \times \left( \frac{\text{Tasa de Ocupación}}{100} \right)$$
- **Tasa de Recuperación de Daños (%):**
  $$\text{Tasa de Recuperación} = \left( \frac{\sum \text{Reembolsos Recibidos}}{\sum \text{Costo Real de Reparaciones}} \right) \times 100$$

---

## 📄 Licencia

Este proyecto es privado y de uso personal. Todos los derechos reservados.
