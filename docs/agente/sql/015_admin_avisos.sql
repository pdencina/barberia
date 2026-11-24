-- Número administrador y avisos del agente de WhatsApp. Aditiva y re-ejecutable. Solo la usa el servidor (service key).
-- agent_admin_contacts: números del dueño desde los que se piden reportes y se dejan avisos (el número es del propio negocio, no de clientes).
-- agent_avisos: instrucciones confirmadas por el dueño ("el viernes 27 cerramos a las 13:00") que el agente menciona a quien pregunta por horarios.
-- Un aviso solo INFORMA: no bloquea la agenda real.
CREATE TABLE IF NOT EXISTS public.agent_admin_contacts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  telefono text NOT NULL CHECK (telefono ~ '^[0-9]{8,15}$'),
  etiqueta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, telefono)
);
CREATE TABLE IF NOT EXISTS public.agent_avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 3 AND 300),
  hasta date NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activo')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_avisos_tenant_idx ON public.agent_avisos (tenant_id, estado, hasta);
ALTER TABLE public.agent_admin_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_avisos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_admin_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agent_avisos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_admin_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_avisos TO service_role;

-- Verificación (deben aparecer las dos tablas, con RLS activo):
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('agent_admin_contacts', 'agent_avisos') ORDER BY 1;
