-- Punto 10 (Pablo): nueva seccion "Metricas" en Clientes para diferenciar el origen de
-- una cita (reserva por link / agendado manualmente / desde promociones), visible solo
-- para Administrador y Recepcion, pensada para remarketing/seguimiento/reseñas.
--
-- No hay forma de saber el origen real de citas ya existentes, asi que se deja NULL
-- para las anteriores a esta migracion (se muestran como "Sin registrar" en Metricas).
-- Valores usados por la app: 'link' (reserva publica), 'manual' (creada por el equipo
-- desde el dashboard), 'promotion' (reservado para cuando exista el modulo de
-- promociones; ningun flujo lo genera todavia).
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;
