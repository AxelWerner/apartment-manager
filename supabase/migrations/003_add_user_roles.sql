-- ==============================================================================
-- MIGRATION 003: User Roles and Profiles
-- Roles: SUPER_USER, OWNER, ADMINISTRATOR, CLEANER, VIEWER
-- ==============================================================================

-- 1. Create enum for user roles
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'SUPER_USER',
    'OWNER',
    'ADMINISTRATOR',
    'CLEANER',
    'VIEWER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create public profiles table linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'VIEWER',
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for updated_at on profiles
DO $$ BEGIN
  CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Enable Row Level Security (RLS) on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to inspect the role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles Policies
DO $$ BEGIN
  -- Users can view their own profile
  CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Super users and administrators can view all user profiles
  CREATE POLICY "Super users and administrators can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.get_my_role() IN ('SUPER_USER', 'ADMINISTRATOR'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Super users can update any user profile (e.g. promote/demote roles)
  CREATE POLICY "Super users can update any profile"
    ON public.profiles FOR UPDATE
    USING (public.get_my_role() = 'SUPER_USER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Users can update their own personal info (excluding role changes enforced via app/trigger)
  CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Trigger to automatically provision profiles when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role := 'VIEWER';
  role_input text;
BEGIN
  role_input := NEW.raw_user_meta_data->>'role';

  IF role_input IN ('SUPER_USER', 'OWNER', 'ADMINISTRATOR', 'CLEANER', 'VIEWER') THEN
    assigned_role := role_input::user_role;
  END IF;

  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    assigned_role,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
