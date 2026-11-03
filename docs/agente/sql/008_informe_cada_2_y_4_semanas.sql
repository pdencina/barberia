-- Informe de citas a administradores: se agregan las frecuencias "cada 2 semanas" y "cada 4 semanas".
-- Aditiva y re-ejecutable. Va DESPUÉS de 003 (que crea agent_admin_report_preferences).
-- Se prueba primero en Supabase "rebooking Base" (pruebas), nunca directo en producción.

ALTER TABLE public.agent_admin_report_preferences
  DROP CONSTRAINT IF EXISTS agent_admin_report_preferences_frequency_check;
ALTER TABLE public.agent_admin_report_preferences
  ADD CONSTRAINT agent_admin_report_preferences_frequency_check
  CHECK (frequency IN ('daily', 'every_3_days', 'weekly', 'custom', 'every_14_days', 'every_28_days'));

ALTER TABLE public.agent_admin_report_preferences
  DROP CONSTRAINT IF EXISTS agent_admin_report_ready;
ALTER TABLE public.agent_admin_report_preferences
  ADD CONSTRAINT agent_admin_report_ready CHECK (
    NOT enabled OR (
      effective_from IS NOT NULL AND send_local_time IS NOT NULL
      AND send_local_time < time '24:00:00'
      AND (frequency NOT IN ('every_3_days', 'every_14_days', 'every_28_days') OR anchor_date IS NOT NULL)
      AND (frequency <> 'weekly' OR weekly_weekday IS NOT NULL)
      AND (frequency <> 'custom' OR cardinality(custom_weekdays) > 0)
    )
  );

-- Valor por defecto de las filas nuevas: cada 2 semanas.
ALTER TABLE public.agent_admin_report_preferences ALTER COLUMN frequency SET DEFAULT 'every_14_days';

-- Verificación (debe devolver las dos restricciones con 'every_14_days' y 'every_28_days'):
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.agent_admin_report_preferences'::regclass
  AND conname IN ('agent_admin_report_preferences_frequency_check', 'agent_admin_report_ready');
