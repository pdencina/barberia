-- Pagos compartidos (split payments)
-- Una transaccion puede tener multiples metodos de pago
CREATE TABLE IF NOT EXISTS transaction_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  amount NUMERIC(10,0) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_payments ON transaction_payments(transaction_id);

ALTER TABLE transaction_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transaction_payments_all" ON transaction_payments FOR ALL TO authenticated USING (true);
