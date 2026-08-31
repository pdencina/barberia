-- Tip is now a separate, informational field recorded AFTER the card payment is
-- approved (the client adds it on the terminal itself), instead of being bundled into
-- the amount charged from the POS screen. Previously the tip was added to "total"
-- before the amount was sent to the MercadoPago terminal, so a $17.000 service with a
-- $1.000 tip charged $18.000 as a single opaque amount, and the app never recorded
-- how much of that was tip vs. service.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,0) NOT NULL DEFAULT 0;
