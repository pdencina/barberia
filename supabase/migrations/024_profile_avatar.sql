-- Foto de perfil del profesional
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
