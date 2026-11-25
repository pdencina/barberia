-- Segundo número de WhatsApp para el mismo negocio (por ejemplo el piloto y el número de siempre atendiendo a la vez).
-- Aditiva y re-ejecutable. El número principal (phone_number_id) sigue usándose para recordatorios y campañas;
-- el segundo solo RECIBE y responde (el agente responde desde el número que recibió el mensaje).
ALTER TABLE public.agent_whatsapp_settings ADD COLUMN IF NOT EXISTS phone_number_id_2 text;
ALTER TABLE public.agent_whatsapp_settings DROP CONSTRAINT IF EXISTS agent_whatsapp_settings_phone_number_id_2_check;
ALTER TABLE public.agent_whatsapp_settings ADD CONSTRAINT agent_whatsapp_settings_phone_number_id_2_check
  CHECK (phone_number_id_2 IS NULL OR (phone_number_id_2 ~ '^[0-9]{1,32}$' AND phone_number_id_2 IS DISTINCT FROM phone_number_id));
CREATE UNIQUE INDEX IF NOT EXISTS agent_whatsapp_settings_phone_number_id_2_key ON public.agent_whatsapp_settings (phone_number_id_2) WHERE phone_number_id_2 IS NOT NULL;

-- Verificación (debe salir la columna phone_number_id_2):
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_whatsapp_settings' AND column_name='phone_number_id_2';
