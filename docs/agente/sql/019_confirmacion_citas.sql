-- Confirmación de citas por WhatsApp: interruptor por negocio (apagado por defecto) y reprogramaciones en curso.
-- Aditiva y re-ejecutable.
ALTER TABLE public.agent_whatsapp_settings ADD COLUMN IF NOT EXISTS confirmacion_activa boolean NOT NULL DEFAULT false;

-- Cuando el cliente toca «Modificar mi cita», se anota cuál cita va a reemplazar: al agendar la nueva, se cancela la anterior.
-- Solo guarda ids (nada de nombre ni correo) y vence a los 30 minutos.
CREATE TABLE IF NOT EXISTS public.agent_reprogramaciones (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_hash text NOT NULL,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, contact_hash)
);
ALTER TABLE public.agent_reprogramaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_reprogramaciones FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_reprogramaciones TO service_role;

-- Verificación (debe salir la columna y la tabla):
SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name='agent_whatsapp_settings' AND column_name='confirmacion_activa') AS columna,
       to_regclass('public.agent_reprogramaciones') AS tabla;
