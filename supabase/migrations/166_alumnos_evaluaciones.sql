-- 166: evaluacion de alumnos del curso de barberia (pagina /alumnos-Levels). Aditiva y re-ejecutable.
-- Tablas con RLS activada y SIN politicas: solo el servidor (llave de servicio) accede.
--  * course_evaluators: quienes pueden evaluar (nombre + huella del codigo de acceso, con bloqueo por intentos).
--  * course_students: alumnos del curso (nombre, correo, fecha, color de la planilla).
--  * course_evaluations: cada evaluacion (7 notas 1 a 7, suma, promedio, comentarios, quien evaluo).
CREATE TABLE IF NOT EXISTS course_evaluators (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  pin_hash     text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS course_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name  text NOT NULL,
  last_name   text NOT NULL DEFAULT '',
  email       text,
  class_date  date,
  sheet_color text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, first_name, last_name)
);

CREATE TABLE IF NOT EXISTS course_evaluations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES course_students(id) ON DELETE CASCADE,
  evaluator_id   uuid REFERENCES course_evaluators(id) ON DELETE SET NULL,
  evaluator_name text NOT NULL,
  scores         jsonb NOT NULL,
  total          integer NOT NULL CHECK (total BETWEEN 7 AND 49),
  average        numeric(3,2) NOT NULL,
  comments       text,
  emailed_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_evaluations_alumno_idx ON course_evaluations (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS course_evaluations_negocio_idx ON course_evaluations (tenant_id, created_at DESC);

ALTER TABLE course_evaluators  ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_students    ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_evaluations ENABLE ROW LEVEL SECURITY;

-- Verificacion: las 3 tablas = 3.
SELECT count(*) AS tablas_3 FROM information_schema.tables
WHERE table_name IN ('course_evaluators','course_students','course_evaluations');
