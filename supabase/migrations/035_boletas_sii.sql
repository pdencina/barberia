-- Boletas electrónicas emitidas al SII
CREATE TABLE IF NOT EXISTS boletas_emitidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  folio INT,
  tipo_dte INT NOT NULL DEFAULT 39, -- 39 = Boleta, 41 = Boleta Exenta, 33 = Factura
  monto_total NUMERIC(10,0) NOT NULL,
  pdf_url TEXT,
  client_rut TEXT,
  status TEXT NOT NULL DEFAULT 'emitida', -- emitida, anulada
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_boletas_emitidas_tx ON boletas_emitidas(transaction_id);
CREATE INDEX idx_boletas_emitidas_folio ON boletas_emitidas(folio);

ALTER TABLE boletas_emitidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boletas_emitidas_all" ON boletas_emitidas FOR ALL TO authenticated USING (true);

-- Add boleta fields to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS boleta_folio INT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS boleta_emitida BOOLEAN NOT NULL DEFAULT false;

-- Add RUT to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rut TEXT;
