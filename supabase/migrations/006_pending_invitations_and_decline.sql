-- Migration 006: User Pending Invitations and Decline RPC

-- 1. Allow invited users to view property basic info if they have a pending invitation
DROP POLICY IF EXISTS "Invited users can view basic property info" ON public.properties;
CREATE POLICY "Invited users can view basic property info"
  ON public.properties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.property_invitations
      WHERE public.property_invitations.property_id = public.properties.id
        AND lower(public.property_invitations.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND public.property_invitations.status = 'pending'
        AND public.property_invitations.expires_at > now()
    )
  );

-- 2. Decline property invitation RPC function
CREATE OR REPLACE FUNCTION public.decline_property_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id uuid := auth.uid();
  v_user_email text := auth.jwt() ->> 'email';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para rechazar una invitación.';
  END IF;

  SELECT * INTO v_invitation
  FROM public.property_invitations
  WHERE token = p_token
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La invitación no es válida o ya ha sido procesada.';
  END IF;

  -- Verify recipient matches current user email or was created by them
  IF (v_user_email IS NULL OR lower(v_invitation.email) != lower(v_user_email)) 
     AND (v_invitation.invited_by IS NULL OR v_invitation.invited_by != v_user_id) THEN
    RAISE EXCEPTION 'No tienes permiso para responder a esta invitación.';
  END IF;

  UPDATE public.property_invitations
  SET status = 'declined',
      updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_invitation.id
  );
END;
$$;

-- 3. Get my pending invitations RPC function (Security Definer for fast & reliable lookup)
CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS TABLE (
  id uuid,
  property_id uuid,
  email text,
  role user_role,
  invited_by uuid,
  inviter_name text,
  inviter_email text,
  token text,
  status invitation_status,
  expires_at timestamptz,
  created_at timestamptz,
  property_name text,
  property_city text,
  property_address text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text := auth.jwt() ->> 'email';
BEGIN
  IF v_user_email IS NULL OR v_user_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pi.id,
    pi.property_id,
    pi.email,
    pi.role,
    pi.invited_by,
    prof.full_name AS inviter_name,
    prof.email AS inviter_email,
    pi.token,
    pi.status,
    pi.expires_at,
    pi.created_at,
    p.name AS property_name,
    p.city AS property_city,
    p.address AS property_address
  FROM public.property_invitations pi
  JOIN public.properties p ON p.id = pi.property_id
  LEFT JOIN public.profiles prof ON prof.id = pi.invited_by
  WHERE lower(pi.email) = lower(v_user_email)
    AND pi.status = 'pending'
    AND pi.expires_at > now()
  ORDER BY pi.created_at DESC;
END;
$$;
