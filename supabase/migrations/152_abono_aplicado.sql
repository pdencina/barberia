-- 152: Marca cuándo un abono (pago al reservar) ya se descontó en una venta, para reconocerlo aunque la clienta cambie la cita
-- y para no descontarlo dos veces. Aditiva y re-ejecutable.
ALTER TABLE public.booking_deposits ADD COLUMN IF NOT EXISTS applied_transaction_id uuid;
ALTER TABLE public.booking_deposits ADD COLUMN IF NOT EXISTS applied_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_booking_deposits_pendientes ON public.booking_deposits (tenant_id, lower(payer_email)) WHERE applied_transaction_id IS NULL;

-- Verificación: debe devolver 2 filas
SELECT column_name FROM information_schema.columns WHERE table_name = 'booking_deposits' AND column_name IN ('applied_transaction_id', 'applied_at');
