-- 132 · Bloqueo temporal del horario mientras el cliente paga el abono. Aditiva y re-ejecutable.
-- El bloqueo es una fila normal de barber_blocks (asi todo lo que ya respeta bloqueos —disponibilidad, reserva, primer profesional disponible— lo respeta),
-- marcada con hold_expires_at: si el cliente no paga, deja de valer a esa hora y se borra sola.
ALTER TABLE barber_blocks ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;
ALTER TABLE barber_blocks ADD COLUMN IF NOT EXISTS hold_ref text;
CREATE INDEX IF NOT EXISTS idx_barber_blocks_hold ON barber_blocks (hold_expires_at) WHERE hold_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_barber_blocks_hold_ref ON barber_blocks (hold_ref) WHERE hold_ref IS NOT NULL;

-- Verificacion (debe devolver 2 filas):
-- SELECT column_name FROM information_schema.columns WHERE table_name='barber_blocks' AND column_name IN ('hold_expires_at','hold_ref');
