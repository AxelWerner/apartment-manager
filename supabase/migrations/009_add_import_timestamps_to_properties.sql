-- Migration: 009_add_import_timestamps_to_properties.sql
-- Description: Add last_airbnb_import_completed and last_airbnb_import_pending to properties

ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_airbnb_import_completed TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_airbnb_import_pending TIMESTAMPTZ;

COMMENT ON COLUMN properties.last_airbnb_import_completed IS 'Timestamp of the last successful import of completed Airbnb reservations';
COMMENT ON COLUMN properties.last_airbnb_import_pending IS 'Timestamp of the last successful import of pending Airbnb reservations';
