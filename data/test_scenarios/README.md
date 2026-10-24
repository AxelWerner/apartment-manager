# 🧪 Escenarios de Prueba para Importador de Reservas Airbnb

Esta carpeta contiene archivos CSV preparados para probar y validar cada uno de los comportamientos del nuevo sistema de importación:

---

### 1. `1_completadas_oct_nov.csv`
- **Pestaña recomendada:** `Reservas ya hechas`
- **Objetivo:** Probar la importación de nuevas reservas finalizadas/pagadas (Octubre y Noviembre 2026).
- **Qué verificar:**
  - En la tabla de vista previa aparecen 3 reservas con estado `Completadas`.
  - Al confirmar la importación, el timestamp se guarda en Supabase y el banner muestra: *"Última importación: [fecha actual] — Supabase Sync"*.

---

### 2. `2_futuras_con_duplicados_modificacion.csv`
- **Pestaña recomendada:** `Reservas futuras`
- **Objetivo:** Probar la deduplicación automática de reservas modificadas antes de la estadía (mismo `Bestätigungs-Code`).
- **Detalle:** La reserva `HMPEND_DUP99` viene en 2 filas (la original con 1 huésped y la modificada con 2 huéspedes).
- **Qué verificar:**
  - El modal consolida las 2 filas en **1 sola reserva**.
  - Muestra el banner azul: *"Se consolidaron 1 líneas duplicadas por modificación de reserva con el mismo código de confirmación"*.
  - El total muestra 2 reservas en vez de 3.

---

### 3. `3_filtro_incremental_mixto.csv`
- **Pestaña recomendada:** `Reservas ya hechas`
- **Objetivo:** Probar el filtro incremental por fecha de corte.
- **Detalle:** Contiene 2 reservas antiguas (reservadas en Agosto y Septiembre) y 2 reservas nuevas (reservadas el 20 y 24 de Octubre).
- **Qué verificar:**
  - Si ya existe un timestamp de importación reciente en Supabase, el modal omite automáticamente las 2 reservas viejas.
  - Muestra el aviso amarillo: *"Se omitieron 2 reservas anteriores al último import..."*.
  - Al pulsar el botón **"Incluir todas (2)"**, se agregan las 2 omitidas a la tabla.

---

### 4. `4_futuras_diciembre_enero.csv`
- **Pestaña recomendada:** `Reservas futuras`
- **Objetivo:** Probar reservas de fin de año y transición entre años (Diciembre 2026 y Enero 2027).
- **Qué verificar:**
  - Muestra las reservas de temporada alta (Navidad, Año Nuevo, Reyes).
  - Reconoce múltiples años (`Años: 2026, 2027`).
  - Al importar, quedan con estado `confirmed` y cobro `pending` sin alterar ninguna reserva directa existente.

---

### 5. `5_reservas_cabeceras_espanol.csv`
- **Pestaña recomendada:** Cualquiera de las dos.
- **Objetivo:** Probar la flexibilidad lingüística del analizador con encabezados estándar en español (`Código de confirmación`, `Fecha de reserva`, `Huésped`, `Ingreso bruto`, etc.).
- **Qué verificar:**
  - Detecta todas las columnas y formatea las tarifas y fechas correctamente sin requerir el CSV alemán de Airbnb.
