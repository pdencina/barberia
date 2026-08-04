-- Client personality/profile tags
ALTER TABLE clients ADD COLUMN IF NOT EXISTS personality_tags TEXT[] DEFAULT '{}';
-- Tags: 'reservado', 'extrovertido', 'puntual', 'impuntual', 'VIP', 'conversador', 'apurado', 'detallista'
