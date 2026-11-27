-- Respuestas a consultas pendientes de una decisión del dueño: borrador por aprobar, o respuesta enviada que se puede guardar.
-- Solo la usa el servidor (service role). Se borra al decidir o a las 48 h. Aditiva y re-ejecutable.
CREATE TABLE IF NOT EXISTS agent_consulta_borradores (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero bigint NOT NULL,
  pregunta text NOT NULL,
  respuesta text NOT NULL CHECK (char_length(respuesta) BETWEEN 1 AND 1000),
  titulo text,
  claves jsonb,
  enviada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, numero)
);
ALTER TABLE agent_consulta_borradores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agent_consulta_borradores FROM anon, authenticated;

SELECT to_regclass('public.agent_consulta_borradores') IS NOT NULL AS existe;
