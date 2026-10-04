-- ==============================================================================
-- MIGRATION 007: Unified Roles System (Elimination of is_owner flag)
-- ==============================================================================

-- 1. Ensure 'PRIMARY_OWNER' exists in user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PRIMARY_OWNER';

-- 2. Drop existing RLS policies on property_members that reference is_owner
DROP POLICY IF EXISTS "Owners and Admins can update members" ON property_members;
DROP POLICY IF EXISTS "Owners and Admins can delete members" ON property_members;

-- 3. Backfill existing roles and drop is_owner columns safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'property_members' AND column_name = 'is_owner'
  ) THEN
    UPDATE public.property_members pm
    SET role = 'PRIMARY_OWNER'
    FROM public.properties p
    WHERE pm.property_id = p.id
      AND (pm.user_id = p.primary_owner_id OR (p.primary_owner_id IS NULL AND pm.user_id = p.created_by));

    UPDATE public.property_members
    SET role = 'OWNER'
    WHERE is_owner = true AND role != 'PRIMARY_OWNER';

    ALTER TABLE public.property_members DROP COLUMN is_owner;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'property_invitations' AND column_name = 'is_owner'
  ) THEN
    UPDATE public.property_invitations
    SET role = 'OWNER'
    WHERE is_owner = true;

    ALTER TABLE public.property_invitations DROP COLUMN is_owner;
  END IF;
END $$;

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
      WHERE property_id = p_id AND user_id = u_id AND role IN ('PRIMARY_OWNER', 'OWNER')
    )
    OR EXISTS (
      SELECT 1 FROM properties
      WHERE id = p_id AND (primary_owner_id = u_id OR created_by = u_id)
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
      WHERE property_id = p_id AND user_id = u_id AND role IN ('PRIMARY_OWNER', 'OWNER', 'ADMINISTRATOR', 'SUPER_USER')
    )
    OR EXISTS (
      SELECT 1 FROM properties
      WHERE id = p_id AND (primary_owner_id = u_id OR created_by = u_id)
    )
    OR (
      COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
      OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
    )
  );
$$;

-- 6. Update on_property_created trigger to assign PRIMARY_OWNER
CREATE OR REPLACE FUNCTION public.handle_property_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    IF NEW.primary_owner_id IS NULL THEN
      NEW.primary_owner_id := NEW.created_by;
    END IF;

    INSERT INTO public.property_members (property_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'PRIMARY_OWNER')
    ON CONFLICT (property_id, user_id) 
    DO UPDATE SET role = 'PRIMARY_OWNER';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update transfer_primary_ownership RPC
CREATE OR REPLACE FUNCTION public.transfer_primary_ownership(
  p_property_id UUID,
  p_new_primary_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_current_primary_owner_id UUID;
  v_is_super_user BOOLEAN := false;
BEGIN
  SELECT primary_owner_id INTO v_current_primary_owner_id
  FROM public.properties
  WHERE id = p_property_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El apartamento no existe.';
  END IF;

  v_is_super_user := (
    COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_USER'
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'SUPER_USER'
  );

  IF v_caller_id != v_current_primary_owner_id AND NOT v_is_super_user THEN
    RAISE EXCEPTION 'Solo el Dueño Principal actual puede transferir la titularidad del apartamento.';
  END IF;

  IF p_new_primary_owner_id = v_current_primary_owner_id THEN
    RAISE EXCEPTION 'El usuario seleccionado ya es el Dueño Principal.';
  END IF;

  -- 1. Actualizar titular en properties
  UPDATE public.properties
  SET primary_owner_id = p_new_primary_owner_id,
      updated_at = now()
  WHERE id = p_property_id;

  -- 2. El titular anterior pasa a ser OWNER (Copropietario)
  UPDATE public.property_members
  SET role = 'OWNER',
      updated_at = now()
  WHERE property_id = p_property_id AND user_id = v_current_primary_owner_id;

  -- 3. El nuevo titular pasa a ser PRIMARY_OWNER
  UPDATE public.property_members
  SET role = 'PRIMARY_OWNER',
      updated_at = now()
  WHERE property_id = p_property_id AND user_id = p_new_primary_owner_id;

  RETURN jsonb_build_object(
    'success', true,
    'property_id', p_property_id,
    'new_primary_owner_id', p_new_primary_owner_id
  );
END;
$$;

-- 8. Update accept_property_invitation RPC
DROP FUNCTION IF EXISTS public.accept_property_invitation(text);
CREATE OR REPLACE FUNCTION public.accept_property_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para aceptar una invitación.';
  END IF;

  SELECT * INTO v_invitation
  FROM property_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La invitación no es válida o ha expirado.';
  END IF;

  INSERT INTO property_members (property_id, user_id, role)
  VALUES (
    v_invitation.property_id,
    v_user_id,
    v_invitation.role
  )
  ON CONFLICT (property_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = now();

  UPDATE property_invitations
  SET status = 'accepted',
      updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'property_id', v_invitation.property_id,
    'role', v_invitation.role
  );
END;
$$;

-- 9. Update check_member_hierarchy_guard trigger function
CREATE OR REPLACE FUNCTION public.check_member_hierarchy_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role user_role;
  v_property_primary_owner UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT primary_owner_id INTO v_property_primary_owner
  FROM public.properties
  WHERE id = COALESCE(OLD.property_id, NEW.property_id);

  -- Regla 1: No auto-modificación de rol ni auto-eliminación
  IF v_caller_id = OLD.user_id THEN
    IF TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'No puedes modificar tu propio rol ni revocar tu propio acceso.';
    END IF;
  END IF;

  -- Regla 2: Inmunidad del Dueño Principal
  IF OLD.role = 'PRIMARY_OWNER' OR OLD.user_id = v_property_primary_owner THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'El Dueño Principal posee inmunidad y no puede ser eliminado del apartamento.';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'El Dueño Principal no puede ser degradado. Transfiere la titularidad primero si es necesario.';
    END IF;
  END IF;

  -- Regla 3: No se puede asignar PRIMARY_OWNER mediante update simple
  IF TG_OP = 'UPDATE' AND NEW.role = 'PRIMARY_OWNER' AND OLD.role != 'PRIMARY_OWNER' THEN
    RAISE EXCEPTION 'La titularidad principal solo puede transferirse mediante la función dedicada.';
  END IF;

  -- Regla 4: Administradores no pueden tocar a los Dueños (PRIMARY_OWNER o OWNER)
  IF OLD.role IN ('PRIMARY_OWNER', 'OWNER') THEN
    SELECT role INTO v_caller_role
    FROM public.property_members
    WHERE property_id = OLD.property_id AND user_id = v_caller_id;

    IF v_caller_role NOT IN ('PRIMARY_OWNER', 'OWNER') AND 
       COALESCE(auth.jwt() ->> 'role', '') != 'SUPER_USER' AND 
       COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') != 'SUPER_USER' THEN
      RAISE EXCEPTION 'Los administradores no tienen permisos para modificar o revocar a un Dueño.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Re-create RLS policies on property_members without is_owner
CREATE POLICY "Owners and Admins can update members"
  ON property_members FOR UPDATE
  USING (
    auth.role() = 'anon' OR
    public.is_property_owner(property_id) OR
    (public.is_property_admin(property_id) AND role NOT IN ('PRIMARY_OWNER', 'OWNER'))
  );

CREATE POLICY "Owners and Admins can delete members"
  ON property_members FOR DELETE
  USING (
    auth.role() = 'anon' OR
    public.is_property_owner(property_id) OR
    (public.is_property_admin(property_id) AND role NOT IN ('PRIMARY_OWNER', 'OWNER'))
  );
