-- ==============================================================================
-- MIGRATION 002: Add Property Management Fee (20%) to Bookings and Properties
-- ==============================================================================

-- 1. Agregar campo configurable de tasa de comisión administradora a properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS management_fee_rate NUMERIC(5, 2) DEFAULT 20.0;

-- 2. Agregar campos a bookings para comisión administradora y pago neto al propietario
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS management_fee NUMERIC(12, 0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_payout NUMERIC(12, 0) DEFAULT 0;

-- 3. Actualización retroactiva segura de reservas existentes:
--    - base_alojamiento = net_payout - cleaning_fee_collected (al Betrag se le resta el aseo)
--    - management_fee   = 20% de base_alojamiento (comisión administradora)
--    - owner_payout     = base_alojamiento * 80% (neto de alojamiento para el dueño, restando el aseo)
--    - nightly_rate     = (base_alojamiento * 80%) / noches (tarifa por noche neta para el propietario)
UPDATE bookings
SET
  management_fee = ROUND(GREATEST(0, net_payout - COALESCE(cleaning_fee_collected, 0)) * 0.20),
  owner_payout = ROUND(GREATEST(0, net_payout - COALESCE(cleaning_fee_collected, 0)) * 0.80),
  nightly_rate = CASE
    WHEN number_of_nights > 0 THEN ROUND(GREATEST(0, net_payout - COALESCE(cleaning_fee_collected, 0)) * 0.80 / number_of_nights)
    ELSE nightly_rate
  END
WHERE net_payout > 0;
