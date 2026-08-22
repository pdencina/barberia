-- Booking deposit/advance payment configuration per tenant
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER NOT NULL DEFAULT 30; -- 30% by default
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS deposit_min_amount INTEGER DEFAULT NULL; -- minimum deposit in CLP (optional)
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS cancellation_free_hours INTEGER NOT NULL DEFAULT 24; -- hours before appointment to cancel without penalty
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS deposit_message TEXT DEFAULT 'Este servicio requiere un abono para confirmar tu cita.';

-- Track deposit payments on appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_amount INTEGER DEFAULT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT NULL; -- 'pending', 'paid', 'refunded'
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_payment_id TEXT DEFAULT NULL; -- MP payment ID
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ DEFAULT NULL;
