-- Punto 5 (Pablo): al crear un ingreso/egreso manual, poder indicar a quien
-- corresponde (Profesional / Recepcion / Negocio general), para saber donde
-- repercute cada movimiento. barber_id ya existe y se reutiliza para vincular al
-- profesional puntual cuando assigned_to = 'professional'; assigned_to guarda la
-- categoria general incluso cuando no se elige un profesional especifico.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS assigned_to TEXT
  CHECK (assigned_to IN ('professional', 'reception', 'business'));

COMMENT ON COLUMN transactions.assigned_to IS
  'A quien corresponde el movimiento: professional | reception | business. NULL = no especificado (transacciones anteriores a este cambio).';
