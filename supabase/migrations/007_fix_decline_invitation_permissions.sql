-- Migration 007: Fix Decline Invitation Permissions & Policies

-- 1. Robust decline_property_invitation RPC function
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

  -- Fallback para obtener email desde auth.users si no viene en el token JWT
  IF v_user_email IS NULL OR v_user_email = '' THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  -- Fallback secundario a profiles si auth.users no devolvió
  IF v_user_email IS NULL OR v_user_email = '' THEN
    SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;
  END IF;

  SELECT * INTO v_invitation
  FROM public.property_invitations
  WHERE token = p_token
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La invitación no es válida o ya ha sido procesada.';
  END IF;

  -- Verificar que el usuario sea el destinatario, el que invitó, o administrador del apartamento
  IF (v_user_email IS NULL OR lower(trim(v_invitation.email)) != lower(trim(v_user_email))) 
     AND (v_invitation.invited_by IS NULL OR v_invitation.invited_by != v_user_id)
     AND NOT public.is_property_admin(v_invitation.property_id, v_user_id) THEN
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

-- 2. Allow invited users to update their invitation status to 'declined'
DROP POLICY IF EXISTS "Invited users can decline invitations" ON public.property_invitations;
CREATE POLICY "Invited users can decline invitations"
  ON public.property_invitations FOR UPDATE
  USING (
    lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
    OR auth.uid() IN (SELECT id FROM auth.users WHERE lower(trim(email)) = lower(trim(property_invitations.email)))
  )
  WITH CHECK (
    status = 'declined'
  );
