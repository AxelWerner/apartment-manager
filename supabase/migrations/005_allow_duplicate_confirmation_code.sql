-- Migration 005: Allow duplicate confirmation codes
-- In Airbnb, duplicate confirmation codes or guest names can legitimately occur
-- (e.g. payout adjustments, multiple stays by the same guest, or split bookings)

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_airbnb_confirmation_code_key;

-- Ensure non-unique index exists for performance when querying by confirmation code
DROP INDEX IF EXISTS idx_bookings_confirmation;
CREATE INDEX IF NOT EXISTS idx_bookings_confirmation ON bookings(airbnb_confirmation_code);
