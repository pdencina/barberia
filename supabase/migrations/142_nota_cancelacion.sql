-- 142 · Cancelaciones: texto libre cuando el motivo es «Otro motivo» (obligatorio). Aditiva y re-ejecutable.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_note text;

-- Verificación (debe devolver 1 fila):
-- SELECT column_name FROM information_schema.columns WHERE table_name='appointments' AND column_name='cancel_note';
