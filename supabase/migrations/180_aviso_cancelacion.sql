-- Aviso "no has respondido" y cancelación automática de citas sin confirmar. Apagado por defecto. Aditiva y re-ejecutable.
ALTER TABLE public.agent_whatsapp_settings ADD COLUMN IF NOT EXISTS aviso_cancelacion_activo boolean NOT NULL DEFAULT false;

-- El registro de envíos admite un segundo propósito (una confirmación y un aviso por cita, como máximo).
ALTER TABLE public.agent_reminder_deliveries DROP CONSTRAINT IF EXISTS agent_reminder_deliveries_purpose_check;
ALTER TABLE public.agent_reminder_deliveries ADD CONSTRAINT agent_reminder_deliveries_purpose_check
  CHECK (purpose IN ('recordatorio-cita-v1', 'aviso-cancelacion-v1'));

-- Verificación (debe salir 1 y el texto con los dos propósitos):
SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name='agent_whatsapp_settings' AND column_name='aviso_cancelacion_activo') AS columna,
       (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='agent_reminder_deliveries_purpose_check') AS propositos;
