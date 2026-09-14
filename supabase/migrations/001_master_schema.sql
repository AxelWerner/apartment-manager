-- ==============================================================================
-- MASTER SCHEMA MIGRATION: Airbnb Apartment Manager (Colombia / COP)
-- ==============================================================================

-- Drop existing tables & types cleanly if rerunning
DROP TABLE IF EXISTS damages CASCADE;
DROP TABLE IF EXISTS recurring_bill_templates CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS properties CASCADE;

DROP TYPE IF EXISTS claim_status CASCADE;
DROP TYPE IF EXISTS damage_severity CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS recurrence_period CASCADE;
DROP TYPE IF EXISTS expense_type CASCADE;
DROP TYPE IF EXISTS expense_category CASCADE;
DROP TYPE IF EXISTS payout_status CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;

-- 1. ENUMS
CREATE TYPE booking_status AS ENUM ('confirmed', 'checked_in', 'completed', 'cancelled');
CREATE TYPE payout_status AS ENUM ('pending', 'paid');

CREATE TYPE expense_category AS ENUM (
  'hoa_administration',   -- Cuota mensual de Administración del edificio
  'electricity',          -- Servicio de Luz / Energía (EPM)
  'water',                -- Servicio de Agua / Acueducto (EPM)
  'gas',                  -- Servicio de Gas (EPM)
  'internet_cable',       -- Internet Wi-Fi y televisión
  'insurance_annual',     -- Póliza de Seguro del Apto
  'cleaning_laundry',     -- Limpieza por estadía y lavandería de blancos
  'supplies_restock',     -- Insumos de vez en cuando (Café, papel, jabón, reposiciones)
  'maintenance_repairs',  -- Mantenimiento y reparaciones locativas
  'platform_fees',        -- Comisiones de software, cerradura inteligente
  'other'                 -- Otros imprevistos
);

CREATE TYPE expense_type AS ENUM (
  'fixed_monthly',        -- Gasto fijo mensual regular (Administración, Internet)
  'utility_monthly',      -- Factura mensual variable (Luz, Agua, Gas)
  'annual',               -- Gasto de pago anual (Seguro de hogar)
  'per_stay',             -- Gasto generado por estadía (Limpieza/Lavandería)
  'occasional'            -- Compra esporádica (Insumos, arreglos)
);

CREATE TYPE recurrence_period AS ENUM ('monthly', 'bimonthly', 'quarterly', 'yearly');
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'scheduled');

CREATE TYPE damage_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE claim_status AS ENUM (
  'discovered',               -- Hallado en inspección de salida
  'guest_contacted',          -- Mensaje directo enviado al huésped
  'aircover_claim_submitted', -- Reclamo formal en AirCover / Centro de Resoluciones
  'approved',                 -- Aprobado para reembolso
  'reimbursed',               -- Dinero efectivamente recibido
  'written_off'               -- Pérdida asumida por el anfitrión
);

-- 2. TRIGGER FUNCTION FOR updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. PROPERTIES TABLE (Multi-unit ready, default single property)
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT DEFAULT 'Medellín',
  currency VARCHAR(3) DEFAULT 'COP',
  default_nightly_rate NUMERIC(12, 0) DEFAULT 250000,
  default_cleaning_fee NUMERIC(12, 0) DEFAULT 80000,
  monthly_revenue_target NUMERIC(12, 0) DEFAULT 3000000,
  check_in_time TIME DEFAULT '15:00',
  check_out_time TIME DEFAULT '11:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. BOOKINGS TABLE (Airbnb Income in COP)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  airbnb_confirmation_code TEXT UNIQUE,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  number_of_guests INT DEFAULT 1,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  number_of_nights INT NOT NULL,
  
  -- Financial Breakdown in COP
  nightly_rate NUMERIC(12, 0) NOT NULL,
  gross_amount NUMERIC(12, 0) NOT NULL,
  cleaning_fee_collected NUMERIC(12, 0) DEFAULT 0,
  airbnb_service_fee NUMERIC(12, 0) DEFAULT 0,
  taxes_withheld NUMERIC(12, 0) DEFAULT 0,
  net_payout NUMERIC(12, 0) NOT NULL,
  
  status booking_status DEFAULT 'confirmed',
  payout_status payout_status DEFAULT 'pending',
  payout_date DATE,
  source TEXT DEFAULT 'airbnb',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_bookings_dates ON bookings(property_id, check_in, check_out);
CREATE INDEX idx_bookings_confirmation ON bookings(airbnb_confirmation_code);

-- 5. EXPENSES TABLE (Fixed, Utilities, Insumos, Turnovers)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category expense_category NOT NULL,
  expense_type expense_type NOT NULL DEFAULT 'occasional',
  description TEXT NOT NULL,
  amount NUMERIC(12, 0) NOT NULL,
  date DATE NOT NULL,
  due_date DATE,
  billing_month VARCHAR(7), -- Format: 'YYYY-MM'
  payment_status payment_status DEFAULT 'paid',
  
  is_recurring BOOLEAN DEFAULT false,
  recurrence_period recurrence_period,
  
  linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_expenses_date ON expenses(property_id, date);
CREATE INDEX idx_expenses_category ON expenses(property_id, category);
CREATE INDEX idx_expenses_billing_month ON expenses(property_id, billing_month);

-- 6. RECURRING BILL TEMPLATES (Planilla mensual preconfigurada)
CREATE TABLE recurring_bill_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category expense_category NOT NULL,
  expense_type expense_type NOT NULL,
  name TEXT NOT NULL,
  default_amount NUMERIC(12, 0) DEFAULT 0,
  typical_due_day INT,
  annual_due_month INT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER recurring_templates_updated_at BEFORE UPDATE ON recurring_bill_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. DAMAGES & INCIDENTS TABLE
CREATE TABLE damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date_discovered DATE NOT NULL DEFAULT CURRENT_DATE,
  severity damage_severity DEFAULT 'medium',
  
  estimated_repair_cost NUMERIC(12, 0) NOT NULL DEFAULT 0,
  actual_repair_cost NUMERIC(12, 0) DEFAULT 0,
  reimbursement_amount NUMERIC(12, 0) DEFAULT 0,
  
  claim_status claim_status DEFAULT 'discovered',
  aircover_case_number TEXT,
  resolution_notes TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER damages_updated_at BEFORE UPDATE ON damages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_damages_booking ON damages(linked_booking_id);
CREATE INDEX idx_damages_status ON damages(property_id, claim_status);

-- 7.1 ROW LEVEL SECURITY (RLS)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bill_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow public all access on properties" ON properties FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public all access on bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public all access on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public all access on recurring_bill_templates" ON recurring_bill_templates FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public all access on damages" ON damages FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. INITIAL SEED DATA
INSERT INTO properties (id, name, address, city, currency, default_nightly_rate, default_cleaning_fee, monthly_revenue_target)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Reserva del Mar II', 'Playa Salguero, Santa Marta', 'Santa Marta', 'COP', 280000, 60000, 3000000)
ON CONFLICT (id) DO NOTHING;

-- Seed default recurring templates for the apartment
INSERT INTO recurring_bill_templates (property_id, category, expense_type, name, default_amount, typical_due_day, annual_due_month)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'hoa_administration', 'fixed_monthly', 'Administración Edificio', 380000, 10, NULL),
  ('a0000000-0000-0000-0000-000000000001', 'internet_cable', 'fixed_monthly', 'Internet Fibra Óptica (Tigo/Claro)', 125000, 15, NULL),
  ('a0000000-0000-0000-0000-000000000001', 'electricity', 'utility_monthly', 'Energía / Luz (EPM)', 0, 18, NULL),
  ('a0000000-0000-0000-0000-000000000001', 'water', 'utility_monthly', 'Agua y Alcantarillado (EPM)', 0, 18, NULL),
  ('a0000000-0000-0000-0000-000000000001', 'gas', 'utility_monthly', 'Gas Natural (EPM)', 0, 18, NULL),
  ('a0000000-0000-0000-0000-000000000001', 'insurance_annual', 'annual', 'Seguro Todo Riesgo Apartamento', 1350000, NULL, 6);

-- 9. STORAGE BUCKET CONFIGURATION (for Supabase Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('apartment-media', 'apartment-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read and authenticated/anon uploads to apartment-media bucket
DO $$
BEGIN
  CREATE POLICY "Public Read Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'apartment-media');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Public Insert Access"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'apartment-media');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
