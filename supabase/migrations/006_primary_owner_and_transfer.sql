-- ==============================================================================
-- MIGRATION 006: Primary Owner, Immunity Guard & Ownership Transfer
-- ==============================================================================

-- 1. Add primary_owner_id to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS primary_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill primary_owner_id with created_by
UPDATE properties
SET primary_owner_id = created_by
WHERE primary_owner_id IS NULL AND created_by IS NOT NULL;

-- 2. Update handle_property_created trigger to set primary_owner_id and initial member
CREATE OR REPLACE FUNCTION public.handle_property_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    IF NEW.primary_owner_id IS NULL THEN
      UPDATE properties SET primary_owner_id = NEW.created_by WHERE id = NEW.id;
    END IF;

    INSERT INTO public.property_members (property_id, user_id, role, is_owner)
    VALUES (NEW.id, NEW.created_by, 'OWNER', true)
    ON CONFLICT (property_id, user_id) 
    DO UPDATE SET is_owner = true, role = 'OWNER';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Transfer Primary Ownership RPC function
CREATE OR REPLACE FUNCTION public.transfer_primary_ownership(
  p_property_id UUID,
  p_new_primary_owner_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_current_owner_id UUID;
  v_caller_id UUID := auth.uid();
  v_is_super_user BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  v_is_super_user := (
    COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
  );

  SELECT primary_owner_id INTO v_current_owner_id
  FROM properties
  WHERE id = p_property_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Propiedad no encontrada');
  END IF;

  -- Only current primary owner or platform SUPER_USER can transfer
  IF v_current_owner_id <> v_caller_id AND NOT v_is_super_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo el Dueño Principal puede transferir la titularidad');
  END IF;

  -- Verify target user is a member of the property
  IF NOT EXISTS (
    SELECT 1 FROM property_members
    WHERE property_id = p_property_id AND user_id = p_new_primary_owner_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El nuevo dueño principal debe ser miembro del apartamento');
  END IF;

  -- Update property primary_owner_id
  UPDATE properties
  SET primary_owner_id = p_new_primary_owner_id, updated_at = now()
  WHERE id = p_property_id;

  -- Elevate new primary owner to OWNER with is_owner = true
  UPDATE property_members
  SET role = 'OWNER', is_owner = true, updated_at = now()
  WHERE property_id = p_property_id AND user_id = p_new_primary_owner_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Inviolable Immunity and Hierarchy Guard Trigger on property_members
CREATE OR REPLACE FUNCTION public.check_member_hierarchy_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_prop_primary_owner_id UUID;
  v_caller_is_owner BOOLEAN;
  v_is_super_user BOOLEAN;
BEGIN
  -- If executed by system/triggers (e.g. auth.uid() is null), bypass
  IF v_caller_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_is_super_user := (
    COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
  );

  IF v_is_super_user THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT primary_owner_id INTO v_prop_primary_owner_id
  FROM properties
  WHERE id = OLD.property_id;

  -- Rule 1: No user can modify or delete the Primary Owner
  IF OLD.user_id = v_prop_primary_owner_id THEN
    -- If trying to change role, ownership or delete
    IF TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM OLD.role OR NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
      RAISE EXCEPTION 'El Dueño Principal tiene inmunidad total y no puede ser modificado ni eliminado.';
    END IF;
  END IF;

  -- Rule 2: Anti self-promotion / self-demotion
  IF OLD.user_id = v_caller_id THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
      RAISE EXCEPTION 'No puedes modificar tu propio rol o condición de Dueño.';
    END IF;
  END IF;

  -- Rule 3: An admin cannot modify or delete an Owner (is_owner = true or role = 'OWNER')
  IF OLD.is_owner = true OR OLD.role = 'OWNER' THEN
    v_caller_is_owner := (
      v_caller_id = v_prop_primary_owner_id
      OR EXISTS (
        SELECT 1 FROM property_members
        WHERE property_id = OLD.property_id AND user_id = v_caller_id AND (is_owner = true OR role = 'OWNER')
      )
    );
    IF NOT v_caller_is_owner THEN
      RAISE EXCEPTION 'Solo un Dueño puede modificar a otro Dueño.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_member_hierarchy_guard ON property_members;
CREATE TRIGGER trg_member_hierarchy_guard
  BEFORE UPDATE OR DELETE ON property_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_member_hierarchy_guard();

-- 5. Update is_property_owner helper function
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
      WHERE id = p_id AND (primary_owner_id = u_id OR created_by = u_id)
    )
    OR EXISTS (
      SELECT 1 FROM property_members
      WHERE property_id = p_id AND user_id = u_id AND (is_owner = true OR role = 'OWNER')
    )
    OR (
      COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
      OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
    )
  );
$$;
