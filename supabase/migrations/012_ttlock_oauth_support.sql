-- Migration: 012_ttlock_oauth_support.sql
-- Description: Adds OAuth token fields and allows lock_id to be nullable in property_locks for SaaS multi-owner support.

ALTER TABLE public.property_locks
  ALTER COLUMN lock_id DROP NOT NULL;

ALTER TABLE public.property_locks
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ttlock_openid BIGINT,
  ADD COLUMN IF NOT EXISTS account_email TEXT,
  ADD COLUMN IF NOT EXISTS lock_alias TEXT;

CREATE INDEX IF NOT EXISTS idx_property_locks_prop_active 
  ON public.property_locks (property_id, is_active);
