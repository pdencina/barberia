-- 115: Historial de campanas de Retencion (Email masivo y lista de difusion de WhatsApp).
-- Hasta ahora un envio masivo solo descontaba cupo (message_usage): no quedaba que mensaje salio, con que cupon, a quien ni cuando.
-- Esto permite ver las campanas ya hechas (para no repetirlas) y avisar cuando alguien ya recibio una hace poco.
--
-- ADITIVA y RE-EJECUTABLE. El codigo tolera que falte esta migracion (el envio funciona igual, solo que no queda historial).
-- Antes de correr en produccion: probar en `rebooking-pruebas`, y tener respaldo (Supabase hace uno diario).

CREATE TABLE IF NOT EXISTS retention_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,                       -- quien lo envio (sin FK, igual que transactions.created_by)
  created_by_name TEXT,
  name TEXT,                             -- nombre que le puso quien la envio, para distinguirla (ej. "Campaña octubre semana 3 / 30-45 días")
  message TEXT,                          -- el mensaje personalizado tal como se escribio (vacio = el mensaje por defecto)
  coupon_code TEXT,
  coupon_detail TEXT,                    -- el cupon como estaba en ese momento ("CEJAS GRATIS · $1.000 de descuento" o su descripcion)
  range_min_days INTEGER,                -- rango de "dias sin venir" que se eligio
  range_max_days INTEGER,
  include_never BOOLEAN NOT NULL DEFAULT false,
  planned_total INTEGER NOT NULL DEFAULT 0,   -- cuantos iban a recibirlo
  sent_count INTEGER NOT NULL DEFAULT 0,      -- correos enviados / contactos preparados para la difusion
  failed_count INTEGER NOT NULL DEFAULT 0,
  quota_exceeded BOOLEAN NOT NULL DEFAULT false,  -- se corto porque se agoto el cupo del plan
  excluded_count INTEGER NOT NULL DEFAULT 0,      -- clientes desmarcados antes de enviar
  manual_count INTEGER NOT NULL DEFAULT 0,        -- clientes agregados a mano
  source TEXT NOT NULL DEFAULT 'app'              -- 'app' = registrada al enviar; 'recuperada' = reconstruida despues
);

-- Por si la tabla ya existia sin la columna del nombre (re-ejecutable).
ALTER TABLE retention_campaigns ADD COLUMN IF NOT EXISTS name TEXT;

CREATE INDEX IF NOT EXISTS idx_retention_campaigns_tenant_date ON retention_campaigns(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS retention_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES retention_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID,                        -- sin FK: si despues borran al cliente, queda el registro de que se le envio
  name TEXT,
  contact TEXT,                          -- correo o telefono al que se envio
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_recipients_campaign ON retention_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_retention_recipients_client ON retention_campaign_recipients(tenant_id, client_id, created_at DESC);

ALTER TABLE retention_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_campaign_recipients ENABLE ROW LEVEL SECURITY;
-- Sin policies de usuario final: se escribe y se lee siempre con el cliente admin desde el servidor
-- (igual que message_usage y audit_log), nunca directo desde el navegador.

-- Verificacion (debe devolver las 2 tablas y 0 filas en cada una):
--   SELECT 'retention_campaigns' AS tabla, count(*) FROM retention_campaigns
--   UNION ALL SELECT 'retention_campaign_recipients', count(*) FROM retention_campaign_recipients;
