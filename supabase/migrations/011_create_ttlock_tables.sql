-- Migration: 011_create_ttlock_tables.sql
-- Description: Creates property_locks and booking_ttlock_pins tables for decoupled TTLock smart lock integration.

-- 1. Property locks table: maps a property to a physical TTLock lock & optional gateway
CREATE TABLE IF NOT EXISTS public.property_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  lock_id BIGINT NOT NULL,
  lock_name TEXT,
  gateway_id BIGINT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Booking TTLock pins table: stores one-time PINs generated for bookings
CREATE TABLE IF NOT EXISTS public.booking_ttlock_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lock_id BIGINT,
  keyboard_pwd_id BIGINT,
  pin TEXT NOT NULL,
  pin_type TEXT NOT NULL DEFAULT 'one_time',
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'used' | 'expired' | 'revoked' | 'mock'
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_mock BOOLEAN DEFAULT false,
  error_message TEXT,
  generated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_property_locks_property ON public.property_locks(property_id);
CREATE INDEX IF NOT EXISTS idx_booking_ttlock_pins_booking ON public.booking_ttlock_pins(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_ttlock_pins_property ON public.booking_ttlock_pins(property_id);
CREATE INDEX IF NOT EXISTS idx_booking_ttlock_pins_status ON public.booking_ttlock_pins(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.property_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_ttlock_pins ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for property_locks
CREATE POLICY "Property members can view property locks"
  ON public.property_locks FOR SELECT
  USING (
    auth.role() = 'anon' OR
    public.is_property_member(property_id)
  );

CREATE POLICY "Property managers can manage property locks"
  ON public.property_locks FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  )
  WITH CHECK (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  );

-- 6. RLS Policies for booking_ttlock_pins
CREATE POLICY "Property members can view booking ttlock pins"
  ON public.booking_ttlock_pins FOR SELECT
  USING (
    auth.role() = 'anon' OR
    public.is_property_member(property_id)
  );

CREATE POLICY "Property managers can manage booking ttlock pins"
  ON public.booking_ttlock_pins FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  )
  WITH CHECK (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  );
