-- RECUPERAR la campana de Retencion enviada ANTES de que existiera el historial (la de "CEJAS GRATIS", 23 oct 2026).
--
-- Que hace: agrega UNA fila al historial ("Campañas enviadas") con el nombre, el mensaje y el cupon, y con la FECHA y la
-- CANTIDAD tomadas de los registros de cupo (message_usage), que es lo unico que quedo guardado de esos envios.
-- Los destinatarios NO se pueden recuperar (nunca se guardaron): esa campana mostrara "los destinatarios no quedaron registrados".
--
-- NO corre sola. Debe correrla Nico, en el proyecto de PRODUCCION (EstudioLevels), con respaldo del dia (Supabase hace uno diario).
-- Requisito: la migracion 115 ya aplicada (tablas retention_campaigns / retention_campaign_recipients).
-- Es de una sola fila y se puede deshacer (paso 4).

-- ======================================================================================================
-- PASO 1 (solo lectura). Mira cuando salieron los correos de Retencion de Estudio Levels en los ultimos 7 dias.
-- Debe verse un grupo grande (alrededor de 270) el 23 oct. Si NO aparece, es que ese envio no se completo: no sigas.
-- ======================================================================================================
SELECT date_trunc('minute', u.created_at AT TIME ZONE 'America/Santiago') AS minuto_hora_chile,
       u.channel,
       count(*) AS mensajes
FROM message_usage u
JOIN tenants t ON t.id = u.tenant_id
WHERE t.name = 'Estudio Levels'
  AND u.category = 'retention'
  AND u.created_at > now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- ======================================================================================================
-- PASO 2 (solo lectura). Cuantos correos de Retencion hubo en la ventana de la campana (edita las horas si hace falta).
-- Ventana por defecto: 23 oct 2026, de 13:00 a 14:30 hora de Chile (UTC-3).
-- ======================================================================================================
SELECT count(*) AS correos_en_la_ventana,
       min(u.created_at AT TIME ZONE 'America/Santiago') AS primero,
       max(u.created_at AT TIME ZONE 'America/Santiago') AS ultimo
FROM message_usage u
JOIN tenants t ON t.id = u.tenant_id
WHERE t.name = 'Estudio Levels'
  AND u.category = 'retention'
  AND u.channel = 'email'
  AND u.created_at >= '2026-10-23 13:00:00-03'
  AND u.created_at <  '2026-10-23 14:30:00-03';

-- ======================================================================================================
-- PASO 3 (ESCRIBE). Registra la campana con la cantidad y la fecha del paso 2. Revisa el nombre, el mensaje y el rango antes de correrlo.
-- Si el paso 2 dio 0, no inserta nada.
-- ======================================================================================================
INSERT INTO retention_campaigns (
  tenant_id, channel, created_at, created_by, created_by_name, name, message,
  coupon_code, coupon_detail, range_min_days, range_max_days, include_never,
  planned_total, sent_count, failed_count, quota_exceeded, excluded_count, manual_count, source
)
SELECT
  t.id,
  'email',
  min(u.created_at),                       -- fecha y hora del primer correo
  NULL,
  'Recuperada del registro de cupo',
  'Campaña 23 oct · 25–45 días (recuperada)',
  E'🎁 ¡TENEMOS UN REGALO PARA TI!\n\nDel 23 al 28 de octubre, presenta el cupón de este correo en nuestra recepción y ¡recibe tu regalo!\n\n¡Te esperamos en Estudio Levels!',
  'CEJAS GRATIS',
  'CEJAS GRATIS · Muestra este cupón en recepción y no pagas las cejas!',
  25, 45, false,
  count(*), count(*), 0, false, 0, 0,
  'recuperada'
FROM message_usage u
JOIN tenants t ON t.id = u.tenant_id
WHERE t.name = 'Estudio Levels'
  AND u.category = 'retention'
  AND u.channel = 'email'
  AND u.created_at >= '2026-10-23 13:00:00-03'
  AND u.created_at <  '2026-10-23 14:30:00-03'
GROUP BY t.id
HAVING count(*) > 0;

-- Verificacion (debe mostrar 1 fila con la cantidad del paso 2):
SELECT name, created_at AT TIME ZONE 'America/Santiago' AS fecha_hora_chile, planned_total, sent_count, source
FROM retention_campaigns
WHERE source = 'recuperada'
ORDER BY created_at DESC;

-- ======================================================================================================
-- PASO 4 (deshacer, solo si hace falta). Borra unicamente la campana recuperada:
--   DELETE FROM retention_campaigns WHERE source = 'recuperada' AND name = 'Campaña 23 oct · 25–45 días (recuperada)';
-- ======================================================================================================
