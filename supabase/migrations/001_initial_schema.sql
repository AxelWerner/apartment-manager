-- ==============================================================================
-- UNIFIED MASTER SCHEMA MIGRATION: Multi-Tenant Airbnb Apartment Manager
-- ==============================================================================

-- Drop existing tables & types cleanly if rerunning
DROP TABLE IF EXISTS damages CASCADE;
DROP TABLE IF EXISTS recurring_bill_templates CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS property_invitations CASCADE;
DROP TABLE IF EXISTS property_members CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS invitation_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
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
CREATE TYPE user_role AS ENUM ('SUPER_USER', 'OWNER', 'ADMINISTRATOR', 'CLEANER', 'VIEWER');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

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

-- 3. PROFILES TABLE (Linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. PROPERTIES TABLE (Multi-tenant apartments)
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT DEFAULT 'Medellín',
  currency VARCHAR(3) DEFAULT 'COP',
  default_nightly_rate NUMERIC(12, 0) DEFAULT 250000,
  default_cleaning_fee NUMERIC(12, 0) DEFAULT 80000,
  monthly_revenue_target NUMERIC(12, 0) DEFAULT 3000000,
  management_fee_rate NUMERIC(5, 2) DEFAULT 20.0,
  check_in_time TIME DEFAULT '15:00',
  check_out_time TIME DEFAULT '11:00',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. PROPERTY MEMBERS TABLE (User <-> Property RBAC)
CREATE TABLE property_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'VIEWER',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT property_members_property_user_key UNIQUE (property_id, user_id)
);

CREATE TRIGGER property_members_updated_at BEFORE UPDATE ON property_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_property_members_user ON property_members(user_id);
CREATE INDEX idx_property_members_property ON property_members(property_id);

-- 6. PROPERTY INVITATIONS TABLE (48-hour expiration)
CREATE TABLE property_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'VIEWER',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status invitation_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '48 hours'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER property_invitations_updated_at BEFORE UPDATE ON property_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_property_invitations_email ON property_invitations(email);
CREATE INDEX idx_property_invitations_token ON property_invitations(token);
CREATE INDEX idx_property_invitations_property ON property_invitations(property_id);

-- 7. BOOKINGS TABLE (Airbnb Income in COP)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  airbnb_confirmation_code TEXT,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  number_of_guests INT DEFAULT 1,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  number_of_nights INT NOT NULL,
  booking_date DATE,
  
  -- Financial Breakdown in COP
  nightly_rate NUMERIC(12, 0) NOT NULL,
  gross_amount NUMERIC(12, 0) NOT NULL,
  cleaning_fee_collected NUMERIC(12, 0) DEFAULT 0,
  airbnb_service_fee NUMERIC(12, 0) DEFAULT 0,
  taxes_withheld NUMERIC(12, 0) DEFAULT 0,
  net_payout NUMERIC(12, 0) NOT NULL,
  management_fee NUMERIC(12, 0) DEFAULT 0,
  owner_payout NUMERIC(12, 0) DEFAULT 0,
  
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

-- 8. EXPENSES TABLE (Fixed, Utilities, Supplies, Maintenance)
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

-- 9. RECURRING BILL TEMPLATES (Planilla mensual preconfigurada)
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

-- 10. DAMAGES & INCIDENTS TABLE
CREATE TABLE damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  discovery_date DATE NOT NULL,
  reported_by TEXT NOT NULL,
  severity damage_severity NOT NULL DEFAULT 'medium',
  estimated_cost NUMERIC(12, 0) DEFAULT 0,
  actual_cost NUMERIC(12, 0) DEFAULT 0,
  guest_paid_amount NUMERIC(12, 0) DEFAULT 0,
  aircover_payout_amount NUMERIC(12, 0) DEFAULT 0,
  claim_status claim_status NOT NULL DEFAULT 'discovered',
  claim_number TEXT,
  resolution_notes TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  receipt_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER damages_updated_at BEFORE UPDATE ON damages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_damages_property ON damages(property_id);
CREATE INDEX idx_damages_booking ON damages(booking_id);

-- 11. AUTOMATIC PROFILE PROVISIONING TRIGGER (auth.users -> profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. AUTOMATIC PROPERTY CREATOR MEMBERSHIP (When a property is created, set creator as OWNER)
CREATE OR REPLACE FUNCTION public.handle_property_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.property_members (property_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'OWNER')
    ON CONFLICT (property_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_property_created ON properties;
CREATE TRIGGER on_property_created
  AFTER INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION public.handle_property_created();

-- 13. HELPER FUNCTION: Accept an invitation
CREATE OR REPLACE FUNCTION public.accept_property_invitation(invitation_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invitation property_invitations%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invitation
  FROM property_invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitación inválida o expirada');
  END IF;

  -- Optional: verify email matches if strict matching desired
  -- IF LOWER(v_invitation.email) <> LOWER(v_user_email) THEN ... END IF;

  INSERT INTO property_members (property_id, user_id, role)
  VALUES (v_invitation.property_id, v_user_id, v_invitation.role)
  ON CONFLICT (property_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  UPDATE property_invitations
  SET status = 'accepted', updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object('success', true, 'property_id', v_invitation.property_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 14. HELPER FUNCTIONS FOR RLS (Security Definer to prevent infinite recursion)
CREATE OR REPLACE FUNCTION public.is_property_member(p_id uuid, u_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_members
    WHERE property_id = p_id AND user_id = u_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_property_admin(p_id uuid, u_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_members
    WHERE property_id = p_id AND user_id = u_id AND role IN ('OWNER', 'ADMINISTRATOR')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_property_owner(p_id uuid, u_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_members
    WHERE property_id = p_id AND user_id = u_id AND role = 'OWNER'
  );
$$;

-- 15. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bill_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view their own profile or fellow members
CREATE POLICY "Users can view and update own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id OR auth.role() = 'anon');

-- Properties: Members can view properties, authenticated users can create
CREATE POLICY "Users can view properties they belong to"
  ON properties FOR SELECT
  USING (
    auth.role() = 'anon' OR
    created_by = auth.uid() OR
    public.is_property_member(id)
  );

CREATE POLICY "Authenticated users can create properties"
  ON properties FOR INSERT
  WITH CHECK (auth.role() = 'anon' OR auth.uid() IS NOT NULL);

CREATE POLICY "Owners and Admins can update properties"
  ON properties FOR UPDATE
  USING (
    auth.role() = 'anon' OR
    created_by = auth.uid() OR
    public.is_property_admin(id)
  );

CREATE POLICY "Owners can delete properties"
  ON properties FOR DELETE
  USING (
    auth.role() = 'anon' OR
    created_by = auth.uid() OR
    public.is_property_owner(id)
  );

-- Property Members:
CREATE POLICY "Members can view other members of their properties"
  ON property_members FOR SELECT
  USING (
    auth.role() = 'anon' OR
    user_id = auth.uid() OR
    public.is_property_member(property_id)
  );

CREATE POLICY "Owners and Admins can manage members"
  ON property_members FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_admin(property_id)
  );

-- Property Invitations:
CREATE POLICY "View invitations"
  ON property_invitations FOR SELECT
  USING (
    auth.role() = 'anon' OR
    invited_by = auth.uid() OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    public.is_property_admin(property_id)
  );

CREATE POLICY "Owners and Admins can create and manage invitations"
  ON property_invitations FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_admin(property_id)
  );

-- Bookings, Expenses, Templates, Damages: Accessible to property members
CREATE POLICY "Property members can view bookings"
  ON bookings FOR SELECT
  USING (
    auth.role() = 'anon' OR
    public.is_property_member(property_id)
  );

CREATE POLICY "Property managers can modify bookings"
  ON bookings FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_admin(property_id)
  );

CREATE POLICY "Property members can view expenses"
  ON expenses FOR SELECT
  USING (
    auth.role() = 'anon' OR
    public.is_property_member(property_id)
  );

CREATE POLICY "Property managers can modify expenses"
  ON expenses FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_admin(property_id)
  );

CREATE POLICY "Property members can view recurring templates"
  ON recurring_bill_templates FOR SELECT
  USING (
    auth.role() = 'anon' OR
    public.is_property_member(property_id)
  );

CREATE POLICY "Property managers can modify recurring templates"
  ON recurring_bill_templates FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_admin(property_id)
  );

CREATE POLICY "Property members can view damages"
  ON damages FOR SELECT
  USING (
    auth.role() = 'anon' OR
    public.is_property_member(property_id)
  );

CREATE POLICY "Property members can report/modify damages"
  ON damages FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_member(property_id)
  );

-- 15. STORAGE BUCKET FOR APARTMENT MEDIA (Receipts, Damages, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('apartment-media', 'apartment-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public Read Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'apartment-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public Insert Access"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'apartment-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
