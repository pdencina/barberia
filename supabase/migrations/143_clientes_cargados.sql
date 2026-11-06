-- 143: separar los clientes que se CARGARON (importación inicial) de los que nacieron en re-booking.
-- imported_at: cuándo se cargó el cliente desde un archivo. NULL = nació en re-booking (reserva, POS, alta manual).
-- Aditiva y re-ejecutable. Los clientes ya cargados se marcan aparte (con el OK de quien administra el negocio).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS imported_at timestamptz;
CREATE INDEX IF NOT EXISTS clients_imported_at_idx ON clients (tenant_id) WHERE imported_at IS NOT NULL;

-- Verificación
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'imported_at';
