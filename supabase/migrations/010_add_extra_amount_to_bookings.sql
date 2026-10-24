-- Migration: 010_add_extra_amount_to_bookings.sql
-- Description: Add extra_amount and extra_description to bookings table for late checkouts, extra hours, and custom fees

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extra_amount NUMERIC(12, 0) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extra_description TEXT;

COMMENT ON COLUMN bookings.extra_amount IS 'Valor adicional cobrado al huésped en COP (ej. late check-out, horas extras, persona extra)';
COMMENT ON COLUMN bookings.extra_description IS 'Descripción o concepto del cobro extra (ej. Late check-out 5 horas)';
