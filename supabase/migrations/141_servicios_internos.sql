-- 141 · Servicios internos (extras): no se ofrecen en la reserva online ni en la agenda; solo se cobran en el Punto de Venta y pueden durar 0 minutos
-- (ej. «Diseño de uña» $500). Aditiva y re-ejecutable: todo servicio existente sigue siendo público.
ALTER TABLE services ADD COLUMN IF NOT EXISTS internal_only boolean NOT NULL DEFAULT false;

-- Verificación (debe devolver 1 fila):
-- SELECT column_name FROM information_schema.columns WHERE table_name='services' AND column_name='internal_only';
