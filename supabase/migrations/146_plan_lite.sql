-- 146: plan «Lite», pago único de $1.000 (IVA incluido) para evitar cuentas fantasma.
-- Agenda + Oti con Billetera + Horarios y breaks; el resto del menú queda bloqueado. Sin mensajes de WhatsApp ni correos de marketing.
-- price_clp es NETO: 840 + 19% de IVA = $1.000. Aditiva y re-ejecutable.
INSERT INTO plan_limits (plan, name, max_professionals, max_branches, max_clients, price_clp, features, whatsapp_quota, email_quota, included_professionals, extra_professional_price_clp)
VALUES ('lite', 'Lite', 1, 1, 100, 840, '["booking","calendar","oti","wallet"]'::jsonb, 0, 0, 1, 0)
ON CONFLICT (plan) DO NOTHING;

-- Verificación
SELECT plan, name, price_clp, round(price_clp * 1.19) AS total_con_iva, features FROM plan_limits WHERE plan = 'lite';
