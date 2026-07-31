-- Modalidad de trabajo por profesional: comisión o arriendo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_mode TEXT NOT NULL DEFAULT 'commission';
-- 'commission' = porcentaje de cada venta
-- 'rental' = monto fijo por día trabajado (arriendo de sillón)

-- Campos para modo arriendo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rental_daily_rate NUMERIC(10,0) DEFAULT 29000; -- valor día ($29.000 default)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rental_min_days INTEGER DEFAULT 5; -- mínimo días/semana
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rental_max_days INTEGER DEFAULT 6; -- máximo días/semana
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rental_deductions NUMERIC(10,0) DEFAULT 0; -- descuentos fijos (aseo, consumibles)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rental_notes TEXT; -- observaciones
