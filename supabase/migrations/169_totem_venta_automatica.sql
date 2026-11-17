-- 169: los pagos del totem se registran solos como una VENTA normal (billetera del profesional, dashboard, cierre, caja, puntos, boleta).
-- Aditiva y re-ejecutable.
--  * kiosk_payments.transaction_id: la venta que se creo por este pago (una sola por pago).
--  * kiosk_payments.sale_status: null = sin registrar, 'working' = registrandose, 'done' = lista, 'error' = fallo (se avisa al equipo).
--  * kiosk_payments.card_type: debito/credito elegido en el totem (TUU lo exige; sirve para registrar el medio de pago).
--  * tenants.kiosk_auto_sale: interruptor por negocio (encendido por defecto: es lo que se pidio; se puede apagar).
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS sale_status text;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS sale_error text;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS card_type text;
ALTER TABLE kiosk_payments ADD COLUMN IF NOT EXISTS payment_type text;  -- tipo real informado por Mercado Pago (debit_card, credit_card, account_money...)
CREATE UNIQUE INDEX IF NOT EXISTS kiosk_payments_transaction_uq ON kiosk_payments (transaction_id) WHERE transaction_id IS NOT NULL;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_auto_sale boolean NOT NULL DEFAULT true;

-- Verificacion: 5 columnas nuevas en kiosk_payments, 1 en negocios.
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='kiosk_payments' AND column_name IN ('transaction_id','sale_status','sale_error','card_type','payment_type')) AS columnas_pagos_5,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='tenants' AND column_name='kiosk_auto_sale') AS interruptor_1;
