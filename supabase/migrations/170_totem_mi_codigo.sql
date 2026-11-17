-- 170: «Ver mi código» del totem. El cliente que no recuerda su código escanea un QR en la pantalla, escribe su correo en su celular y el totem
-- recibe su código solo. Aditiva y re-ejecutable.
--  * kiosk_links: una sesion corta (6 minutos) entre una pantalla del totem y el celular del cliente.
CREATE TABLE IF NOT EXISTS kiosk_links (
  token       text PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  modo        text NOT NULL DEFAULT 'llegue' CHECK (modo IN ('llegue','pagar')),
  client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
  code        text,                         -- código del cliente (solo se entrega al totem una vez)
  accion      text CHECK (accion IN ('llegue','pagar')),   -- lo que el cliente eligió en su celular
  intentos    integer NOT NULL DEFAULT 0,   -- correos probados en este QR (tope)
  entregado   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiosk_links_negocio_idx ON kiosk_links (tenant_id, created_at DESC);
ALTER TABLE kiosk_links ENABLE ROW LEVEL SECURITY;  -- sin politicas: solo el servidor (llave de servicio) accede

-- Verificacion: tabla = 1.
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'kiosk_links') AS tabla_1;
