-- Migration: 013_support_booking_decimal_amounts.sql
-- Description: Convert monetary columns to NUMERIC(14, 2) across bookings, properties, and expenses to support exact decimals (2) from Airbnb payouts and receipts

ALTER TABLE bookings
  ALTER COLUMN nightly_rate TYPE NUMERIC(14, 2),
  ALTER COLUMN gross_amount TYPE NUMERIC(14, 2),
  ALTER COLUMN cleaning_fee_collected TYPE NUMERIC(14, 2),
  ALTER COLUMN airbnb_service_fee TYPE NUMERIC(14, 2),
  ALTER COLUMN taxes_withheld TYPE NUMERIC(14, 2),
  ALTER COLUMN net_payout TYPE NUMERIC(14, 2),
  ALTER COLUMN management_fee TYPE NUMERIC(14, 2),
  ALTER COLUMN owner_payout TYPE NUMERIC(14, 2);

-- Check extra_amount if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'extra_amount'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN extra_amount TYPE NUMERIC(14, 2);
  END IF;
END $$;

-- Properties financial defaults & targets
ALTER TABLE properties
  ALTER COLUMN default_nightly_rate TYPE NUMERIC(14, 2),
  ALTER COLUMN default_cleaning_fee TYPE NUMERIC(14, 2),
  ALTER COLUMN monthly_revenue_target TYPE NUMERIC(14, 2);

-- Expenses
ALTER TABLE expenses
  ALTER COLUMN amount TYPE NUMERIC(14, 2);

COMMENT ON COLUMN bookings.net_payout IS 'Pago neto recibido de Airbnb o canal directo con precisión de 2 decimales';
COMMENT ON COLUMN bookings.management_fee IS 'Comisión de administración calculada con precisión de 2 decimales';
COMMENT ON COLUMN bookings.owner_payout IS 'Liquidación final para el propietario con precisión de 2 decimales';
