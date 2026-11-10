-- 167: evaluaciones en curso (borrador) y editables. Aditiva y re-ejecutable.
--  * status: 'borrador' (se va guardando sola, notas parciales) o 'final'.
--  * edited_at / edited_by: quien corrigió una evaluación ya hecha (evaluator_name sigue siendo quien la hizo).
ALTER TABLE course_evaluations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'final';
ALTER TABLE course_evaluations ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE course_evaluations ADD COLUMN IF NOT EXISTS edited_by text;
ALTER TABLE course_evaluations DROP CONSTRAINT IF EXISTS course_evaluations_status_check;
ALTER TABLE course_evaluations ADD CONSTRAINT course_evaluations_status_check CHECK (status IN ('borrador','final'));
-- Un borrador puede tener notas a medias: la suma baja a 0 como mínimo.
ALTER TABLE course_evaluations DROP CONSTRAINT IF EXISTS course_evaluations_total_check;
ALTER TABLE course_evaluations ADD CONSTRAINT course_evaluations_total_check CHECK (total BETWEEN 0 AND 49);

-- Verificacion: columnas = 3.
SELECT count(*) AS columnas_3 FROM information_schema.columns
WHERE table_name='course_evaluations' AND column_name IN ('status','edited_at','edited_by');
