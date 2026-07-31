-- Código personal por profesional (para modo Standby)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS personal_pin TEXT;

-- Asignar PINs default a los barberos existentes
UPDATE profiles SET personal_pin = LPAD(floor(random() * 9999)::text, 4, '0')
WHERE role = 'barber' AND personal_pin IS NULL;
