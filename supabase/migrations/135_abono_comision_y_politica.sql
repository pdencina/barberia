-- 135 · Abono: (1) la venta recuerda cuanto se pago por adelantado, para que la comision se calcule sobre el precio completo;
-- (2) politica de devolucion del abono que el cliente ve antes de pagar. Aditiva y re-ejecutable.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS prepaid_amount integer NOT NULL DEFAULT 0;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS deposit_refund_policy text;      -- 'none' | 'until_hours' | 'always'
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS deposit_refund_hours integer;    -- horas de anticipacion (si es 'until_hours')
ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_deposit_refund_policy_chk;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_deposit_refund_policy_chk
  CHECK (deposit_refund_policy IS NULL OR deposit_refund_policy IN ('none','until_hours','always'));

-- Verificacion (debe devolver 3 filas):
-- SELECT column_name FROM information_schema.columns WHERE column_name IN ('prepaid_amount','deposit_refund_policy','deposit_refund_hours');
