-- Reserva por WhatsApp: memoria mínima de la conversación e indicadores diarios. Aditiva y re-ejecutable.
-- Se prueba primero en Supabase "rebooking Base" (pruebas); producción solo con respaldo y OK de Nico.
-- Privacidad: la memoria NO guarda texto de mensajes, nombre, correo ni teléfono; solo qué horas se ofrecieron (profesional,
-- fecha, hora) y expira sola. Los indicadores son contadores por día, sin datos personales.

CREATE TABLE IF NOT EXISTS public.agent_chat_state (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_hash text NOT NULL CHECK (contact_hash ~ '^[a-f0-9]{64}$'),
  etapa text NOT NULL CHECK (etapa IN ('oferta', 'datos')),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, contact_hash)
);
CREATE INDEX IF NOT EXISTS agent_chat_state_expira_idx ON public.agent_chat_state (expires_at);
ALTER TABLE public.agent_chat_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_chat_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_chat_state TO service_role;

CREATE TABLE IF NOT EXISTS public.agent_whatsapp_indicadores (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dia date NOT NULL,
  campo text NOT NULL CHECK (campo IN ('respuestas_automaticas', 'consultas_disponibilidad', 'ofertas_horas', 'reservas_iniciadas', 'reservas_cerradas', 'derivadas_persona')),
  total integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  PRIMARY KEY (tenant_id, dia, campo)
);
ALTER TABLE public.agent_whatsapp_indicadores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_whatsapp_indicadores FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_whatsapp_indicadores TO service_role;

CREATE OR REPLACE FUNCTION public.agent_whatsapp_contar(p_tenant uuid, p_dia date, p_campo text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
  INSERT INTO public.agent_whatsapp_indicadores (tenant_id, dia, campo, total) VALUES (p_tenant, p_dia, p_campo, 1)
  ON CONFLICT (tenant_id, dia, campo) DO UPDATE SET total = public.agent_whatsapp_indicadores.total + 1;
$$;
REVOKE ALL ON FUNCTION public.agent_whatsapp_contar(uuid, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_whatsapp_contar(uuid, date, text) TO service_role;

-- Verificación (deben salir 2 tablas y 1 función; anon_ejecuta debe ser false):
SELECT to_regclass('public.agent_chat_state') AS memoria, to_regclass('public.agent_whatsapp_indicadores') AS indicadores,
       to_regprocedure('public.agent_whatsapp_contar(uuid,date,text)') AS funcion,
       has_function_privilege('anon', 'public.agent_whatsapp_contar(uuid,date,text)', 'EXECUTE') AS anon_ejecuta;
