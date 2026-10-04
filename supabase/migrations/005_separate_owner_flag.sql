-- ==============================================================================
-- MIGRATION 005: Separate Owner Flag (is_owner) from Operational Roles
-- ==============================================================================

-- 1. Add is_owner column to property_members
ALTER TABLE property_members 
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- 2. Add is_owner column to property_invitations
ALTER TABLE property_invitations 
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- 3. Backfill existing members and invitations:
-- Anyone with role 'OWNER' becomes 'ADMINISTRATOR' with is_owner = true
UPDATE property_members 
SET is_owner = true, role = 'ADMINISTRATOR' 
WHERE role = 'OWNER';

UPDATE property_invitations 
SET is_owner = true, role = 'ADMINISTRATOR' 
WHERE role = 'OWNER';

-- 4. Update helper function is_property_owner
CREATE OR REPLACE FUNCTION public.is_property_owner(p_id uuid, u_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM property_members
      WHERE property_id = p_id AND user_id = u_id AND (is_owner = true OR role = 'OWNER')
    )
    OR EXISTS (
      SELECT 1 FROM properties
      WHERE id = p_id AND created_by = u_id
    )
    OR (
      COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
      OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
    )
  );
$$;

-- 5. Update helper function is_property_admin
CREATE OR REPLACE FUNCTION public.is_property_admin(p_id uuid, u_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM property_members
      WHERE property_id = p_id AND user_id = u_id AND (role IN ('ADMINISTRATOR', 'OWNER', 'SUPER_USER') OR is_owner = true)
    )
    OR EXISTS (
      SELECT 1 FROM properties
      WHERE id = p_id AND created_by = u_id
    )
    OR (
      COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
      OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
    )
  );
$$;

-- 6. Update on_property_created trigger function to set is_owner = true
CREATE OR REPLACE FUNCTION public.handle_property_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.property_members (property_id, user_id, role, is_owner)
    VALUES (NEW.id, NEW.created_by, 'ADMINISTRATOR', true)
    ON CONFLICT (property_id, user_id) 
    DO UPDATE SET is_owner = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Update accept_property_invitation function to preserve is_owner flag
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
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitación inválida o expirada');
  END IF;

  INSERT INTO property_members (property_id, user_id, role, is_owner)
  VALUES (
    v_invitation.property_id,
    v_user_id,
    v_invitation.role,
    COALESCE(v_invitation.is_owner, false)
  )
  ON CONFLICT (property_id, user_id)
  DO UPDATE SET 
    role = EXCLUDED.role,
    is_owner = EXCLUDED.is_owner,
    updated_at = now();

  UPDATE property_invitations
  SET status = 'accepted', updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object('success', true, 'property_id', v_invitation.property_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Protect owners from being deleted or modified by non-owner admins
DROP POLICY IF EXISTS "Owners and Admins can manage members" ON property_members;
DROP POLICY IF EXISTS "Owners and Admins can insert members" ON property_members;
DROP POLICY IF EXISTS "Owners and Admins can update members" ON property_members;
DROP POLICY IF EXISTS "Owners and Admins can delete members" ON property_members;

CREATE POLICY "Owners and Admins can insert members"
  ON property_members FOR INSERT
  WITH CHECK (
    auth.role() = 'anon' OR
    public.is_property_admin(property_id)
  );

CREATE POLICY "Owners and Admins can update members"
  ON property_members FOR UPDATE
  USING (
    auth.role() = 'anon' OR
    public.is_property_owner(property_id) OR
    (public.is_property_admin(property_id) AND is_owner = false)
  );

CREATE POLICY "Owners and Admins can delete members"
  ON property_members FOR DELETE
  USING (
    auth.role() = 'anon' OR
    public.is_property_owner(property_id) OR
    (public.is_property_admin(property_id) AND is_owner = false)
  );
