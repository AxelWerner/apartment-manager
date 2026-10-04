-- ==============================================================================
-- MIGRATION 002: Fix Property Invitations RLS & Permission Functions
-- ==============================================================================

-- 1. Helper function for property admin check:
-- Includes explicit check for property creator, members table, and SUPER_USER
CREATE OR REPLACE FUNCTION public.is_property_admin(p_id uuid, u_id uuid DEFAULT auth.uid())
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
      WHERE property_id = p_id AND user_id = u_id AND role IN ('OWNER', 'ADMINISTRATOR', 'SUPER_USER')
    )
    OR (
      COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
      OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
    )
  );
$$;

-- 2. Helper function for property owner check:
CREATE OR REPLACE FUNCTION public.is_property_owner(p_id uuid, u_id uuid DEFAULT auth.uid())
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
      WHERE property_id = p_id AND user_id = u_id AND role IN ('OWNER', 'SUPER_USER')
    )
    OR (
      COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
      OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
    )
  );
$$;

-- 3. Fix property_invitations RLS policies:
-- Replace (SELECT email FROM auth.users) with auth.jwt() ->> 'email' to prevent "permission denied for table users"
DROP POLICY IF EXISTS "View invitations" ON property_invitations;
CREATE POLICY "View invitations"
  ON property_invitations FOR SELECT
  USING (
    auth.role() = 'anon' OR
    invited_by = auth.uid() OR
    lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')) OR
    public.is_property_admin(property_id)
  );

DROP POLICY IF EXISTS "Owners and Admins can create and manage invitations" ON property_invitations;
CREATE POLICY "Owners and Admins can create and manage invitations"
  ON property_invitations FOR ALL
  USING (
    auth.role() = 'anon' OR
    public.is_property_admin(property_id)
  )
  WITH CHECK (
    auth.role() = 'anon' OR
    public.is_property_admin(property_id)
  );

-- 4. Backfill property_members for any properties missing an OWNER entry for their creator
INSERT INTO public.property_members (property_id, user_id, role)
SELECT p.id, p.created_by, 'OWNER'::user_role
FROM public.properties p
WHERE p.created_by IS NOT NULL
ON CONFLICT (property_id, user_id) DO NOTHING;
