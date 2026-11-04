-- Respuestas con IA (modo Avanzado): contador mensual y tope por negocio. Aditiva y re-ejecutable.
-- Se prueba primero en "rebooking Base"; producción con OK de Nico.
ALTER TABLE public.agent_ai_context ADD COLUMN IF NOT EXISTS limite_mensual integer NOT NULL DEFAULT 300 CHECK (limite_mensual >= 0);

-- El contador diario (migración 009) admite un indicador más: respuestas_ia.
ALTER TABLE public.agent_whatsapp_indicadores DROP CONSTRAINT IF EXISTS agent_whatsapp_indicadores_campo_check;
ALTER TABLE public.agent_whatsapp_indicadores ADD CONSTRAINT agent_whatsapp_indicadores_campo_check
  CHECK (campo IN ('respuestas_automaticas', 'consultas_disponibilidad', 'ofertas_horas', 'reservas_iniciadas', 'reservas_cerradas', 'derivadas_persona', 'respuestas_ia'));

-- Verificación (debe salir la columna y la restricción con 'respuestas_ia'):
SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'agent_ai_context' AND column_name = 'limite_mensual') AS columna,
       (SELECT pg_get_constraintdef(oid) LIKE '%respuestas_ia%' FROM pg_constraint WHERE conname = 'agent_whatsapp_indicadores_campo_check') AS restriccion_ok;
