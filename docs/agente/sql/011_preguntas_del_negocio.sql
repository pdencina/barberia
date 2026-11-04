-- Preguntas y respuestas propias de cada negocio para el agente de WhatsApp (curso, políticas, cómo llegar, pagos...).
-- Aditiva y re-ejecutable. Se prueba primero en "rebooking Base"; producción con OK de Nico.
-- Las escribe el administrador; el agente las usa antes que las reglas fijas. No guarda mensajes de clientes.
CREATE TABLE IF NOT EXISTS public.agent_faq_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 120),
  claves text[] NOT NULL CHECK (cardinality(claves) BETWEEN 1 AND 20),
  respuesta text NOT NULL CHECK (char_length(respuesta) BETWEEN 1 AND 700),
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_faq_custom_tenant_idx ON public.agent_faq_custom (tenant_id, activo, orden);
ALTER TABLE public.agent_faq_custom ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_faq_custom FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_faq_custom TO service_role;

-- Verificación (debe salir la tabla y 0 filas):
SELECT to_regclass('public.agent_faq_custom') AS tabla, (SELECT count(*) FROM public.agent_faq_custom) AS filas;
