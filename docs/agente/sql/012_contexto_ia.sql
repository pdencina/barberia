-- Modo "Avanzado (IA)" del agente de WhatsApp: contexto del negocio (texto) que escribe o pega el administrador.
-- Aditiva y re-ejecutable. Se prueba primero en "rebooking Base"; producción con OK de Nico.
-- ia_activa queda en false: guardar el contexto NO enciende ninguna respuesta con IA (eso es otra etapa, con su propio interruptor).
-- No guarda mensajes de clientes. El contexto es información comercial del negocio (sin datos personales de clientes ni claves).
CREATE TABLE IF NOT EXISTS public.agent_ai_context (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  contexto text NOT NULL DEFAULT '' CHECK (char_length(contexto) <= 12000),
  ia_activa boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_ai_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_ai_context FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_ai_context TO service_role;

-- Verificación (la tabla existe; negocios con IA activa debe ser 0):
SELECT to_regclass('public.agent_ai_context') AS tabla, (SELECT count(*) FROM public.agent_ai_context WHERE ia_activa) AS con_ia_activa;
