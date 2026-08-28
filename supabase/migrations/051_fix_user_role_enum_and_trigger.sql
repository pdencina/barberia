-- Fix: the user_role enum was missing 'super_admin' and 'client', which the app uses.
-- Any attempt to save a profile with role='super_admin' failed on the enum cast, and the
-- handle_new_user trigger could error (leaving auth users with NO profile row = orphans).
--
-- NOTE: In PostgreSQL, ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- together with statements that use the new value. If applying this by hand in the
-- Supabase SQL editor, run the two ALTER TYPE lines FIRST (each on its own), then the rest.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';

-- Make the auto-profile trigger resilient: never fail the auth user creation just because
-- the role metadata is missing/invalid. Fall back to 'barber' and never overwrite an
-- existing profile row.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  BEGIN
    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'barber');
  EXCEPTION WHEN others THEN
    v_role := 'barber';
  END;

  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
