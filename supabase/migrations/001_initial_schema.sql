# SQL migration for Supabase
# Run this in the Supabase SQL Editor or via supabase CLI

-- Enums
CREATE TYPE booking_status AS ENUM ('confirmed', 'completed', 'cancelled');
CREATE TYPE expense_category AS ENUM ('fixed_cost', 'cleaning', 'supervisor', 'maintenance', 'supplies', 'other');
CREATE TYPE recurrence_rule AS ENUM ('monthly', 'quarterly', 'annual');

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nightly_rate NUMERIC(10,2) NOT NULL,
  total_payout NUMERIC(10,2) NOT NULL,
  airbnb_fees NUMERIC(10,2) DEFAULT 0,
  cleaning_fee NUMERIC(10,2) DEFAULT 0,
  status booking_status DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  recurring BOOLEAN DEFAULT false,
  recurrence_rule recurrence_rule,
  paid BOOLEAN DEFAULT false,
  linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security (optional, for multi-user later)
-- ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

