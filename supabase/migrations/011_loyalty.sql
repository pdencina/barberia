-- Programa de fidelidad / Puntos

-- Configuracion del programa
CREATE TABLE IF NOT EXISTS loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_clp INTEGER NOT NULL DEFAULT 1000, -- 1 punto por cada X CLP gastados
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recompensas canjeables
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'discount', -- discount, free_service, product
  discount_value NUMERIC(10,0), -- valor del descuento en CLP
  service_id UUID REFERENCES services(id), -- servicio gratis
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Balance de puntos por cliente
CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  points INTEGER NOT NULL, -- positivo = ganados, negativo = canjeados
  reason TEXT NOT NULL, -- 'purchase', 'redeem', 'bonus', 'adjustment'
  transaction_id UUID REFERENCES transactions(id),
  reward_id UUID REFERENCES loyalty_rewards(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_points_client ON loyalty_points(client_id);

ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_config_all" ON loyalty_config FOR ALL TO authenticated USING (true);
CREATE POLICY "loyalty_rewards_all" ON loyalty_rewards FOR ALL TO authenticated USING (true);
CREATE POLICY "loyalty_points_all" ON loyalty_points FOR ALL TO authenticated USING (true);

-- Agregar campo de puntos acumulados al cliente (cache para performance)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

-- Insert default config
INSERT INTO loyalty_config (points_per_clp) VALUES (1000);

-- Insert default rewards
INSERT INTO loyalty_rewards (name, description, points_required, reward_type, discount_value) VALUES
  ('Descuento $3.000', '3.000 de descuento en tu proxima visita', 10, 'discount', 3000),
  ('Descuento $5.000', '5.000 de descuento en tu proxima visita', 20, 'discount', 5000),
  ('Corte Gratis', 'Un corte clasico gratis', 50, 'discount', 8000),
  ('Servicio Premium', 'Un servicio premium a eleccion', 80, 'discount', 15000);
