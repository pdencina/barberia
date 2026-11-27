-- Imágenes de una consulta abierta (id del archivo en Meta), para reenviarlas al dueño cuando escriba «consultas».
-- Se borran junto con la consulta (máximo 48 h). Aditiva y re-ejecutable.
ALTER TABLE agent_consultas ADD COLUMN IF NOT EXISTS medios jsonb;

SELECT column_name FROM information_schema.columns WHERE table_name = 'agent_consultas' AND column_name = 'medios';
