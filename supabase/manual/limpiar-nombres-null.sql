-- Limpia clientes cuyo nombre trae el texto "null" / "undefined" (ej. "Matias null"), que vienen de una importacion antigua
-- (todos creados el 19-ago-2026) y aparecen en las reservas y en los avisos.
-- NO es una migracion de estructura: corrige datos. Es re-ejecutable y guarda un RESPALDO de los nombres originales
-- (tabla clients_nombres_respaldo) para poder volver atras. Hacer tambien el respaldo diario de Supabase antes.

-- 1) PREVIA (solo lectura): cuantos son y como quedarian. Mirar esto antes de seguir.
SELECT count(*) AS clientes_a_corregir FROM clients WHERE name ~* '(^|\s)(null|undefined)(\s|$)';
SELECT name AS antes,
       COALESCE(NULLIF(btrim(regexp_replace(name, '(^|\s)(null|undefined)(\s|$)', ' ', 'gi')), ''), 'Sin nombre') AS despues
FROM clients WHERE name ~* '(^|\s)(null|undefined)(\s|$)' ORDER BY created_at DESC LIMIT 15;

-- 2) RESPALDO de los nombres originales (no pisa uno ya guardado).
CREATE TABLE IF NOT EXISTS clients_nombres_respaldo (id uuid PRIMARY KEY, name_original text NOT NULL, respaldado_at timestamptz NOT NULL DEFAULT now());
-- Datos personales: la tabla queda protegida (solo el servidor la lee; las llaves publicas del navegador no).
ALTER TABLE clients_nombres_respaldo ENABLE ROW LEVEL SECURITY;
INSERT INTO clients_nombres_respaldo (id, name_original)
SELECT id, name FROM clients WHERE name ~* '(^|\s)(null|undefined)(\s|$)'
ON CONFLICT (id) DO NOTHING;

-- 3) CORRECCION: quita las palabras null / undefined y los espacios sobrantes (si quedara vacio, "Sin nombre").
UPDATE clients
SET name = COALESCE(NULLIF(btrim(regexp_replace(name, '(^|\s)(null|undefined)(\s|$)', ' ', 'gi')), ''), 'Sin nombre')
WHERE name ~* '(^|\s)(null|undefined)(\s|$)';

-- 4) VERIFICACION: debe devolver 0.
SELECT count(*) AS quedan_con_null FROM clients WHERE name ~* '(^|\s)(null|undefined)(\s|$)';

-- PARA VOLVER ATRAS (solo si hiciera falta):
-- UPDATE clients c SET name = r.name_original FROM clients_nombres_respaldo r WHERE r.id = c.id;
