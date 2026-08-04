-- Bio y video para presentación del profesional en booking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intro_video_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_experience INT;
