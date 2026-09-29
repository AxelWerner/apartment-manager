-- Migration: Add booking_date column (Buchungsdatum / fecha en que se realizó la reserva)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date DATE;
