-- ==============================================================================
-- MIGRATION 004: Add new enum values to user_role
-- ==============================================================================
-- NOTE: In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be used in the same
-- transaction as statements that reference the new value. Therefore, adding the
-- enum values is isolated in this migration so it commits before migration 005 runs.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'OPERATOR';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PRIMARY_OWNER';
