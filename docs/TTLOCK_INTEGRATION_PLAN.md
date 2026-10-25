# Plan de Integración: TTLock One-Time PIN en Reservas

Este documento define la arquitectura, diseño de base de datos, reglas de negocio y pasos de implementación para integrar cerraduras inteligentes **TTLock** en el sistema de gestión de reservas, manteniendo un desacoplamiento total del modelo de datos principal.

---

## 1. Contexto y Objetivos

* **Objetivo Principal:** Permitir a los anfitriones/operadores generar de forma manual un código PIN de un solo uso (**One-Time Passcode**) para el huésped de una reserva.
* **Desacoplamiento Estricto:** No modificar ni sobrecargar la tabla `bookings` ni la entidad de huéspedes con columnas específicas del vendor TTLock. Toda la información de cerraduras y códigos reside en tablas independientes con claves foráneas.
* **Control 100% Manual:** No se ejecutan procesos automáticos en segundo plano ni crons de generación imprevista. El anfitrión decide cuándo emitir el código.

---

## 2. Antecedentes: Branch `ttlock` y Stash previo

En la investigación del historial del repositorio se encontró trabajo preliminar en la rama `ttlock` (guardado en `git stash`):
* **Archivos explorados:**
  * `supabase/functions/ttlock-passcode/index.ts`
  * `supabase/migrations/006_add_smart_lock_fields.sql`
  * `src/lib/ttlock-service.ts`
* **Lecciones y cambios respecto a la versión anterior:**
  1. **Se descarta:** La migración anterior que agregaba columnas (`smart_lock_pin`, `smart_lock_pin_id`, `pin_status`, etc.) directamente sobre la tabla `bookings`.
  2. **Se descarta:** La lógica de autogeneración desatendida 1 hora antes del check-in.
  3. **Se rescata y reutiliza:** La lógica de comunicación con la API v3 de TTLock (endpoints `/oauth/token` y `/v3/keyboardPwd/add`), el manejo de tokens de acceso y la simulación/mock local para desarrollo cuando no hay credenciales configuradas en `.env`.

---

## 3. Reglas de Negocio para la Generación de PIN

Para que una reserva pueda recibir un One-Time PIN, debe satisfacer **todas** las siguientes condiciones:

### 3.1. Estado de la Reserva y Exclusión de Reservas Viejas
* La reserva debe estar confirmada (`confirmed`) o con check-in en curso (`checked_in`).
* **Reservas Viejas Excluidas:** No se puede generar PIN para reservas que ya finalizaron ($\text{check\_out} < T_{\text{hoy}}$) ni reservas canceladas (`cancelled`) o completadas (`completed`).

### 3.2. Regla de Generación: SOLO Máximo 2 Reservas Habilitadas
Por cada propiedad, el sistema permite generar PINs únicamente para un máximo de **2 reservas** a la vez:

1. **Caso 1 - Reserva Actual (Estancia Activa):**
   * $\text{check\_in} \le T_{\text{hoy}} \le \text{check\_out}$
   * Si hay una reserva activa en este momento, **debe poder generar PIN**.

2. **Caso 2 - Primera Reserva Próxima en Ventana de 7 Días:**
   * $\text{check\_in} > T_{\text{hoy}}$ y $(\text{check\_in} - T_{\text{hoy}}) \le 7\text{ días}$.
   * Si en la ventana de los próximos 7 días existen reservas, **únicamente la primera reserva (la de check-in más próximo a hoy)** tiene habilitada la generación de PIN.

3. **Reservas Posteriores (En Espera):**
   * Si existen reservas adicionales dentro de la misma ventana de 7 días (ej. entra una en 2 días y otra en 5 días), la segunda reserva permanece bloqueada con estado *"En espera: Solo se habilita para la primera reserva próxima"*.
   * Reservas que inicien a más de 7 días no muestran acción de generación.

### 3.4. Ciclo de Vida del One-Time PIN
* **Tipo:** One-time passcode (Tipo `1` en TTLock).
* **Validez:** Se invalida tras el primer uso en la cerradura física o al vencer el periodo de check-in configurado.
* **Persistencia:** Una vez generado, se muestra el PIN junto con una opción de copia rápida al portapapeles y auditoría de fecha de creación.

---

## 4. Diseño del Modelo de Datos (Desacoplado)

Para no alterar la tabla `bookings`, creamos un esquema modular dedicado a cerraduras y códigos:

```
┌─────────────────┐           ┌───────────────────────────┐
│   properties    │ 1       1 │       property_locks      │
│  (existente)    │───────────│    (cerradura física)     │
└─────────────────┘           └───────────────────────────┘
         │
         │ 1
         │
         ▼ *
┌─────────────────┐           ┌───────────────────────────┐
│    bookings     │ 1       * │    booking_ttlock_pins    │
│  (existente)    │───────────│    (códigos generados)    │
└─────────────────┘           └───────────────────────────┘
```

### 4.1. Tabla `property_locks`
Asocia una propiedad con su cerradura física en TTLock (opcional si se prefiere una sola columna en properties, pero ideal para desacoplar al 100%):
```sql
CREATE TABLE property_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
  lock_id BIGINT NOT NULL,              -- ID de la cerradura física en TTLock
  lock_name TEXT,                       -- Nombre o alias (ej. "Puerta Principal Apto 302")
  gateway_id BIGINT,                    -- ID del Gateway G2 (si aplica para conexión remota)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2. Tabla `booking_ttlock_pins`
Almacena el historial y estado de los códigos emitidos para cada reserva:
```sql
CREATE TABLE booking_ttlock_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Datos TTLock
  lock_id BIGINT,                       -- Lock de TTLock donde se programó
  keyboard_pwd_id BIGINT,               -- ID asignado por TTLock API
  pin TEXT NOT NULL,                    -- Código de 6 dígitos
  pin_type TEXT NOT NULL DEFAULT 'one_time',
  
  -- Estado y Vigencia
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'used' | 'expired' | 'revoked' | 'mock'
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  
  -- Metadatos y Auditoría
  is_mock BOOLEAN DEFAULT false,
  error_message TEXT,
  generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX idx_booking_ttlock_pins_booking ON booking_ttlock_pins(booking_id);
CREATE INDEX idx_booking_ttlock_pins_property ON booking_ttlock_pins(property_id);
```

---

## 5. Integración con TTLock API v3

### 5.1. Variables de Entorno (`.env.local` / Supabase Secrets)
```bash
TTLOCK_CLIENT_ID="tu_client_id"
TTLOCK_CLIENT_SECRET="tu_client_secret"
TTLOCK_USERNAME="usuario_cuenta_ttlock"
TTLOCK_PASSWORD_MD5="contrasena_en_md5"
TTLOCK_API_URL="https://euapi.ttlock.com" # o https://api.ttlock.com
```

### 5.2. Flujo de Generación
1. **Autenticación:**
   * Llamada `POST /oauth/token` con `grant_type=password` para obtener un `access_token`.
2. **Creación del One-Time Passcode:**
   * Llamada `POST /v3/keyboardPwd/add` enviando:
     * `lockId`: ID de la cerradura.
     * `keyboardPwdType`: `1` (One-time).
     * `keyboardPwd`: PIN deseado (o dejar que la API lo genere).
     * `startDate` y `endDate`: Periodo de validez en milisegundos.
     * `addType`: `1` (Enviar a través del Gateway G2 a la cerradura).
3. **Modo Mock / Fallback:**
   * Si las credenciales no están presentes en el entorno o la API externa no está disponible, el servicio genera un PIN de 6 dígitos local marcado como `is_mock = true`. Esto permite desarrollar, testear y utilizar la interfaz sin dependencias bloqueantes de hardware.

---

## 6. Algoritmo de Elegibilidad (`src/lib/ttlock-eligibility.ts`)

Pseudocódigo del servicio de validación:

```typescript
export interface PinEligibilityResult {
  canGenerate: boolean;
  reason?: 'already_has_pin' | 'cancelled' | 'not_in_7_days_window' | 'not_closest_booking' | 'no_lock_configured';
  message: string;
  activePin?: string;
  isClosest: boolean;
}

export function checkBookingPinEligibility(
  targetBooking: Booking,
  allPropertyBookings: Booking[],
  existingPins: BookingTtlockPin[],
  todayStr: string // YYYY-MM-DD
): PinEligibilityResult {
  // 1. Validar estado
  if (targetBooking.status === 'cancelled') {
    return { canGenerate: false, reason: 'cancelled', message: 'Reserva cancelada', isClosest: false };
  }

  // 2. Verificar si ya tiene PIN
  const currentPin = existingPins.find(p => p.booking_id === targetBooking.id && p.status === 'active');
  if (currentPin) {
    return { canGenerate: false, reason: 'already_has_pin', message: `PIN activo: ${currentPin.pin}`, activePin: currentPin.pin, isClosest: true };
  }

  // 3. Filtrar reservas elegibles de la propiedad (activas o próximos 7 días, no canceladas)
  const eligibleCandidates = allPropertyBookings
    .filter(b => b.status !== 'cancelled')
    .filter(b => {
      const isActive = b.check_in <= todayStr && b.check_out >= todayStr;
      const daysUntilCheckIn = calculateDaysDifference(todayStr, b.check_in);
      const isUpcoming7Days = b.check_in > todayStr && daysUntilCheckIn >= 0 && daysUntilCheckIn <= 7;
      return isActive || isUpcoming7Days;
    })
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  // 4. Si la reserva objetivo no califica en la ventana
  const isCandidate = eligibleCandidates.some(b => b.id === targetBooking.id);
  if (!isCandidate) {
    return { canGenerate: false, reason: 'not_in_7_days_window', message: 'Solo disponible para estancias activas o en los próximos 7 días', isClosest: false };
  }

  // 5. Verificar si es la más cercana al día actual
  const closestBooking = eligibleCandidates[0];
  const isClosest = closestBooking.id === targetBooking.id;

  if (!isClosest) {
    return {
      canGenerate: false,
      reason: 'not_closest_booking',
      message: `Bloqueado temporalmente: Primero debe procesarse la reserva de ${closestBooking.guest_name} (${closestBooking.check_in})`,
      isClosest: false,
    };
  }

  return {
    canGenerate: true,
    message: 'Listo para generar One-Time PIN',
    isClosest: true,
  };
}
```

---

## 7. Experiencia de Usuario (UI en `Bookings.tsx`)

1. **Columna / Badge en cada fila de reserva:**
   * **Con PIN existente:** Badge verde con candado abierto `PIN: 849201` + botón para copiar con toast de Sonner.
   * **Habilitada (Más cercana en $\le 7$ días):** Botón con estilo primario/amber `Generar One-Time PIN`.
   * **No más cercana (dentro de los 7 días):** Badge gris con tooltip explicativo: *"En espera: Hay una reserva más cercana antes"*.
   * **Fuera de rango ($> 7$ días):** Espacio libre o badge discreto *"Disponible en ventana de 7 días"*.
2. **Modal de Confirmación al Generar:**
   * Explicación de que el código es de **un solo uso** para el huésped.
   * Muestra el nombre del huésped y fechas de la estadía.
   * Botón de acción `Confirmar y Generar`.
   * Retorna el PIN con animación y opción instantánea de copia o envío.

---

## 8. Pasos para Retomar la Implementación

Cuando estemos listos para continuar, ejecutaremos el siguiente plan paso a paso:

- [x] **Paso 1:** Crear la migración SQL `supabase/migrations/011_create_ttlock_tables.sql` con las tablas `booking_ttlock_pins` y `property_locks`, políticas RLS e índices.
- [x] **Paso 2:** Actualizar los tipos TypeScript en [src/types/database.ts](file:///Users/axelwerner/Documents/Projects/Private/apartment-manager/src/types/database.ts).
- [x] **Paso 3:** Implementar el módulo de lógica y elegibilidad `src/lib/ttlock-eligibility.ts` acompañado de su suite de tests unitarios exhaustivos con Vitest (`src/lib/ttlock-eligibility.test.ts`).
- [x] **Paso 4:** Implementar el servicio `src/lib/ttlock-service.ts` (con soporte para llamada a Edge Function y fallback local mock).
- [x] **Paso 5:** Crear la Edge Function `supabase/functions/ttlock-passcode/index.ts` y endpoint `api/ttlock-passcode.ts` con soporte para TTLock v3 API.
- [x] **Paso 6:** Integrar los controles visuales, badges y modal en [src/routes/Bookings.tsx](file:///Users/axelwerner/Documents/Projects/Private/apartment-manager/src/routes/Bookings.tsx).
- [x] **Paso 7:** Validar con pruebas unitarias (`pnpm test`), lint (`pnpm lint`) y build (`pnpm build`).
