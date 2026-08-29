-- Allow reviews to be linked to a transaction (POS sale), not just an appointment.
-- The receipt email links to /review/{transactionId} for walk-in / no-appointment sales
-- (most POS sales don't have an appointment_id at all), but the reviews table only
-- supported appointment_id, so those reviews always failed with "Cita no encontrada".
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS transaction_id UUID UNIQUE REFERENCES transactions(id);
CREATE INDEX IF NOT EXISTS idx_reviews_transaction ON reviews(transaction_id);
