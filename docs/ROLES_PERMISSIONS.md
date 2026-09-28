# Matriz de Roles y Permisos — Apto Manager

Este documento define la matriz de control de acceso basado en roles (**RBAC** - *Role-Based Access Control*) implementada en la aplicación y en la base de datos de Supabase.

---

## 1. Definición de Roles

| Rol | Identificador en Código / BD | Color de Badge en UI | Descripción y Propósito |
| :--- | :--- | :--- | :--- |
| **Super Usuario** | `SUPER_USER` | Púrpura | Acceso maestro e irrestricto. Puede administrar roles de otros usuarios, cambiar configuraciones críticas, eliminar datos y auditar toda la plataforma. |
| **Administrador** | `ADMINISTRATOR` | Rosa / Coral | Gestor operativo y financiero de las propiedades (*Property Manager* o *Co-Host*). Administra reservas, gastos, checklist de servicios y daños sin alterar la gestión de usuarios del sistema. |
| **Propietario** | `OWNER` | Azul | Dueño del inmueble. Supervisa el rendimiento del apartamento, ingresos brutos, pago neto al propietario (80%), comisiones de administración (20%), gastos y ocupación. |
| **Personal de Limpieza** | `CLEANER` | Esmeralda | Equipo operativo de aseo, lavandería e inspección. Consulta fechas de entrada/salida para preparar la propiedad, reporta daños encontrados y accede a guías. **Sin acceso a montos financieros**. |
| **Lector / Auditor** | `VIEWER` | Gris pizarra | Perfil con permisos exclusivos de solo lectura. Puede auditar la actividad y consultar el calendario y guía, sin capacidad de edición ni borrado. |

---

## 2. Matriz de Acceso a Módulos y Navegación

| Módulo / Ruta | Ruta URL | `SUPER_USER` | `ADMINISTRATOR` | `OWNER` | `CLEANER` | `VIEWER` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | `/` |  Total |  Total |  Total | ❌ Oculto | 👁️ Lectura |
| **Reservas** | `/bookings` |  Total |  Total |  Total | 👁️ Operativo* | 👁️ Lectura |
| **Gastos y Servicios** | `/expenses` |  Total |  Total | 👁️ Lectura / Edición | ❌ Bloqueado | ❌ Bloqueado |
| **Daños e Incidentes** | `/damages` |  Total |  Total | 👁️ Lectura / Reporte | ✍️ Reporte / Fotos | 👁️ Lectura |
| **Guía Huésped (Admin)** | `/guest-guide` |  Total |  Total | 👁️ Lectura / Edición | 👁️ Lectura | 👁️ Lectura |
| **Configuración** | `/settings` |  Total |  Propiedad | ❌ Bloqueado | ❌ Bloqueado | ❌ Bloqueado |
| **Portal Huésped (Público)** | `/guide/:id` |  Público |  Público |  Público |  Público |  Público |
| **Tarjeta Wi-Fi (Público)** | `/wifi/:id` |  Público |  Público |  Público |  Público |  Público |
| **Póster Imprimible** | `/guide/poster/:id` |  Público |  Público |  Público |  Público |  Público |

*\*En el módulo de Reservas, el rol `CLEANER` únicamente accede a los datos logísticos de estancia (fechas, noches, huéspedes), manteniendo ocultas las columnas y tarjetas de montos en dinero.*

---

## 3. Matriz Detallada de Acciones y Operaciones

### 3.1. Dashboard y Métricas Financieras
| Funcionalidad / Operación | `SUPER_USER` | `ADMINISTRATOR` | `OWNER` | `CLEANER` | `VIEWER` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Visualizar Ingresos Netos y Brutos (COP) |  |  |  | ❌ | 👁️ |
| Visualizar Gastos Totales del Mes |  |  |  | ❌ | ❌ |
| Visualizar Balance / Beneficio Neto |  |  |  | ❌ | 👁️ |
| Visualizar Tasa y Días de Ocupación |  |  |  | ❌ | 👁️ |
| Configurar / Modificar Meta de Ingresos |  |  | ❌ | ❌ | ❌ |
| Navegar por histórico de meses anteriores |  |  |  | ❌ | 👁️ |

---

### 3.2. Gestión de Reservas (`/bookings`)
| Funcionalidad / Operación | `SUPER_USER` | `ADMINISTRATOR` | `OWNER` | `CLEANER` | `VIEWER` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Ver Calendario de Entrada y Salida |  |  |  |  | 👁️ |
| Ver Nombre y Teléfono del Huésped |  |  |  |  | 👁️ |
| Ver Desglose Financiero (Neto, Comisión, Payout) |  |  |  | ❌ | 👁️ |
| Crear Reserva Manual (Directa 10% / Directa 25%) |  |  | ❌ | ❌ | ❌ |
| Editar Detalles de una Reserva |  |  | ❌ | ❌ | ❌ |
| Eliminar / Cancelar Reserva |  |  | ❌ | ❌ | ❌ |
| Importar Reservas desde CSV de Airbnb |  |  | ❌ | ❌ | ❌ |
| Marcar Payout como Pagado / Pendiente |  |  | ❌ | ❌ | ❌ |

---

### 3.3. Gastos y Servicios Públicos (`/expenses`)
| Funcionalidad / Operación | `SUPER_USER` | `ADMINISTRATOR` | `OWNER` | `CLEANER` | `VIEWER` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Ver Libro Diario de Gastos |  |  |  | ❌ | ❌ |
| Ver Checklist Mensual de Servicios (Luz, Agua, Gas, Admin) |  |  |  | ❌ | ❌ |
| Registrar Nuevo Gasto Ordinario / Extraordinario |  |  | ✍️ Opcional | ❌ | ❌ |
| Modificar Gasto o Factura Existente |  |  | ❌ | ❌ | ❌ |
| Eliminar Gasto |  |  | ❌ | ❌ | ❌ |
| Modificar Plantillas de Facturación Recurrente |  |  | ❌ | ❌ | ❌ |
| Marcar Factura como Pagada |  |  | ❌ | ❌ | ❌ |
| Subir / Ver Comprobante o Recibo de Pago |  |  | 👁️ Ver | ❌ | ❌ |

---

### 3.4. Daños e Incidentes (`/damages`)
| Funcionalidad / Operación | `SUPER_USER` | `ADMINISTRATOR` | `OWNER` | `CLEANER` | `VIEWER` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Consultar Historial de Daños Reportados |  |  |  |  | 👁️ |
| Reportar Nuevo Daño (Título, Descripción, Fotos) |  |  |  |  | ❌ |
| Subir Fotos de Evidencia a Supabase Storage |  |  |  |  | ❌ |
| Modificar Estado del Reclamo (AirCover, Resuelto, etc.) |  |  | 👁️ Ver | ❌ | ❌ |
| Registrar Costo Estimado y Monto Reembolsado |  |  | 👁️ Ver | ❌ | ❌ |
| Vincular Daño con un Gasto de Reparación |  |  | ❌ | ❌ | ❌ |
| Eliminar Registro de Daño |  |  | ❌ | ❌ | ❌ |

---

### 3.5. Guía del Huésped y Configuración (`/guest-guide` y `/settings`)
| Funcionalidad / Operación | `SUPER_USER` | `ADMINISTRATOR` | `OWNER` | `CLEANER` | `VIEWER` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Consultar Guía del Huésped y Red Wi-Fi |  |  |  |  | 👁️ |
| Imprimir / Descargar Tarjeta Wi-Fi y Póster QR |  |  |  |  | 👁️ |
| Editar Credenciales Wi-Fi y Código de Cerradura |  |  | ❌ | ❌ | ❌ |
| Modificar Recomendaciones Locales y Reglas |  |  | ❌ | ❌ | ❌ |
| Modificar Tasa de Comisión de Administración (20%) |  | ❌ | ❌ | ❌ | ❌ |
| Modificar Tarifas Base por Noche y Tarifa de Aseo |  |  | ❌ | ❌ | ❌ |
| Gestionar Roles de Usuarios (`profiles.role`) |  | ❌ | ❌ | ❌ | ❌ |

---

## 4. Matriz de Confidencialidad de Datos

| Tipo de Información | `SUPER_USER` | `ADMINISTRATOR` | `OWNER` | `CLEANER` | `VIEWER` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Ingreso Bruto de Alquiler |  Visible |  Visible |  Visible | 🔒 Oculto |  Visible |
| Comisión Airbnb / Directa |  Visible |  Visible |  Visible | 🔒 Oculto |  Visible |
| Comisión Administradora (20%) |  Visible |  Visible |  Visible | 🔒 Oculto | 🔒 Oculto |
| Pago Neto al Propietario (80%) |  Visible |  Visible |  Visible | 🔒 Oculto | 🔒 Oculto |
| Facturas y Servicios Públicos |  Visible |  Visible |  Visible | 🔒 Oculto | 🔒 Oculto |
| Nombres y Teléfonos de Huéspedes |  Visible |  Visible |  Visible |  Visible |  Visible |
| Códigos de Acceso / Cerradura |  Visible |  Visible |  Visible |  Visible | 🔒 Oculto |

---

## 5. Implementación en el Código

1. **Definición de Tipos TypeScript:**
   - [`src/types/database.ts`](file:///Users/axelwerner/Documents/Projects/Private/apartment-manager/src/types/database.ts): Tipos `UserRole` y `UserProfile`.
2. **Contexto de Autenticación:**
   - [`src/context/AuthContext.tsx`](file:///Users/axelwerner/Documents/Projects/Private/apartment-manager/src/context/AuthContext.tsx): Expone `role`, flags booleanos (`isSuperUser`, `isAdmin`, `isOwner`, `isCleaner`, `isViewer`) y la función utilitaria `hasRole()`.
3. **Rutas Protegidas:**
   - [`src/components/auth/ProtectedRoute.tsx`](file:///Users/axelwerner/Documents/Projects/Private/apartment-manager/src/components/auth/ProtectedRoute.tsx): Verifica `allowedRoles`. Si el usuario no tiene permiso, bloquea la navegación con una vista clara de acceso no autorizado.
4. **Navegación Dinámica:**
   - [`src/components/layout/AppLayout.tsx`](file:///Users/axelwerner/Documents/Projects/Private/apartment-manager/src/components/layout/AppLayout.tsx): Oculta los enlaces de módulos no permitidos en el sidebar y en el menú móvil, mostrando el badge con el rol correspondiente.
5. **Seguridad a Nivel de Base de Datos (PostgreSQL RLS):**
   - [`supabase/migrations/003_add_user_roles.sql`](file:///Users/axelwerner/Documents/Projects/Private/apartment-manager/supabase/migrations/003_add_user_roles.sql): Aplica Row Level Security en la tabla `profiles` y función `get_my_role()`.
