-- Consultas por imagen (comprobante de abono, fotos de referencia): se distinguen de las preguntas de texto.
-- Aditiva y re-ejecutable. Las respuestas a una imagen NO se guardan como conocimiento general.
ALTER TABLE public.agent_consultas ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'pregunta';
ALTER TABLE public.agent_consultas DROP CONSTRAINT IF EXISTS agent_consultas_tipo_check;
ALTER TABLE public.agent_consultas ADD CONSTRAINT agent_consultas_tipo_check CHECK (tipo IN ('pregunta', 'imagen'));

-- Verificación (debe salir la columna tipo):
SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_consultas' AND column_name='tipo';
