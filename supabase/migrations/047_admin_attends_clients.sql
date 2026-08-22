-- Allow admins to also appear as professionals in booking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS also_attends_clients BOOLEAN NOT NULL DEFAULT false;
