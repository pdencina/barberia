-- Registro de conversaciones del agente de WhatsApp para que el dueño las revise (apagado por defecto, por negocio).
-- Guarda el texto de los mensajes SOLO mientras el negocio tenga encendido registrar_chats, y se borra solo a los 14 días.
-- Aditiva y re-ejecutable.
ALTER TABLE public.agent_whatsapp_settings ADD COLUMN IF NOT EXISTS registrar_chats boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.agent_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_hash text NOT NULL,
  telefono text,
  direccion text NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
  tipo text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'boton', 'imagen', 'documento', 'audio', 'plantilla', 'lista', 'archivo', 'otro')),
  texto text NOT NULL CHECK (char_length(texto) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_chats_tenant_contacto_idx ON public.agent_chats (tenant_id, contact_hash, created_at);
CREATE INDEX IF NOT EXISTS agent_chats_tenant_fecha_idx ON public.agent_chats (tenant_id, created_at DESC);
ALTER TABLE public.agent_chats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_chats FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_chats TO service_role;

-- Verificación (debe salir la tabla, la columna y 0 filas):
SELECT to_regclass('public.agent_chats') AS tabla,
       (SELECT count(*) FROM information_schema.columns WHERE table_name='agent_whatsapp_settings' AND column_name='registrar_chats') AS columna,
       (SELECT count(*) FROM public.agent_chats) AS filas;
