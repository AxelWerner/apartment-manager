-- ==============================================================================
-- MIGRATION 003: Add email to profiles and allow fellow property members to view profiles
-- ==============================================================================

-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill email for existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 3. Update handle_new_user trigger to save email and default full_name if missing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Update RLS policies on profiles:
-- Allow users to view their own profile and profiles of fellow members in their properties
DROP POLICY IF EXISTS "Users can view and update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.role() = 'anon' OR
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.property_members pm1
      JOIN public.property_members pm2 ON pm1.property_id = pm2.property_id
      WHERE pm1.user_id = auth.uid() AND pm2.user_id = profiles.id
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR auth.role() = 'anon')
  WITH CHECK (auth.uid() = id OR auth.role() = 'anon');
