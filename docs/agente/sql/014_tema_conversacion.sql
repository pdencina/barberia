-- Memoria de tema de la IA del agente de WhatsApp. Aditiva y re-ejecutable.
-- Guarda SOLO qué líneas del contexto del negocio se usaron en la última respuesta de la IA (números de línea, no texto del cliente)
-- para que un seguimiento ("¿y con barba?", "¿cuánto dura?") se entienda. Expira sola (30 min) como el resto de la memoria.
ALTER TABLE public.agent_chat_state DROP CONSTRAINT IF EXISTS agent_chat_state_etapa_check;
ALTER TABLE public.agent_chat_state ADD CONSTRAINT agent_chat_state_etapa_check CHECK (etapa IN ('oferta', 'datos', 'tema'));

-- Verificación (debe incluir 'tema'):
SELECT pg_get_constraintdef(oid) AS restriccion FROM pg_constraint WHERE conname = 'agent_chat_state_etapa_check' AND conrelid = 'public.agent_chat_state'::regclass;
