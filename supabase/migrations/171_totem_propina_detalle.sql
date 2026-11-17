-- 171: propina y monto realmente pagado de los pagos del totem en maquina. Aditiva y re-ejecutable.
--  * kiosk_payments.tip_amount: propina que el cliente agrego en la maquina (va 100% al profesional, como en el POS).
--  * kiosk_payments.provider_detail: montos y medio de pago que informo Mercado Pago/TUU (sin datos del pagador), para revisar.
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS tip_amount integer NOT NULL DEFAULT 0;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS provider_detail jsonb;

-- Verificacion: 2 columnas nuevas.
SELECT count(*) AS columnas_2 FROM information_schema.columns WHERE table_name='kiosk_payments' AND column_name IN ('tip_amount','provider_detail');
