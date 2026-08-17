-- Add category to services for grouping in POS and booking
ALTER TABLE services ADD COLUMN IF NOT EXISTS category TEXT;
-- Examples: "Cortes", "Barba", "Especiales", "Paquetes"
