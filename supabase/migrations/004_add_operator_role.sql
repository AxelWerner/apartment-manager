-- ==============================================================================
-- MIGRATION 004: Add OPERATOR role for day-to-day property management
-- ==============================================================================

-- 1. Add OPERATOR to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'OPERATOR';

-- 2. Helper function for property operator check:
-- Operators can operate bookings, expenses, damages, and templates, but cannot edit base property finances/members.
CREATE OR REPLACE FUNCTION public.is_property_operator(p_id uuid, u_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM properties
      WHERE id = p_id AND created_by = u_id
    )
    OR EXISTS (
      SELECT 1 FROM property_members
      WHERE property_id = p_id AND user_id = u_id AND role IN ('OWNER', 'ADMINISTRATOR', 'OPERATOR', 'SUPER_USER')
    )
    OR (
      COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
      OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
    )
  );
$$;

-- 3. Update bookings RLS policy to allow OPERATOR
DROP POLICY IF EXISTS "Property managers can modify bookings" ON bookings;
CREATE POLICY "Property managers can modify bookings"
  ON bookings FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  )
  WITH CHECK (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  );

-- 4. Update expenses RLS policy to allow OPERATOR
DROP POLICY IF EXISTS "Property managers can modify expenses" ON expenses;
CREATE POLICY "Property managers can modify expenses"
  ON expenses FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  )
  WITH CHECK (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  );

-- 5. Update recurring_bill_templates RLS policy to allow OPERATOR
DROP POLICY IF EXISTS "Property managers can modify recurring templates" ON recurring_bill_templates;
CREATE POLICY "Property managers can modify recurring templates"
  ON recurring_bill_templates FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  )
  WITH CHECK (
    auth.role() = 'anon' OR
    public.is_property_operator(property_id)
  );
