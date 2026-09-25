-- Punto (Nico, 25-sep): Pablo pidio poder eliminar (de verdad, no solo desactivar) las
-- empresas ficticias/de prueba desde Superadmin, quedandose solo con Estudio Levels y
-- Saray Business, para dejar la plataforma limpia antes de sumar salones reales.
--
-- El problema: `tenants` tiene ~30 tablas que le cuelgan datos (clientes, citas,
-- transacciones, caja, comisiones, etc.), pero la gran mayoria de esas columnas
-- tenant_id/barber_id/client_id se agregaron con ALTER TABLE a lo largo del tiempo SIN
-- "ON DELETE CASCADE" (ver 028, 045, 046, 050, 052, 053) — un DELETE directo sobre
-- `tenants` fallaria con violaciones de foreign key en la primera tabla que la
-- referencie. Esta funcion borra todo lo del tenant en el orden correcto (hijos antes
-- que padres) y termina borrando la fila de `tenants`, que en cascada limpia lo poco
-- que SI tiene ON DELETE CASCADE directo (tenant_settings, subscriptions, invite_codes,
-- mp_terminals, tuu_terminals).
--
-- Al estar todo dentro de una sola funcion plpgsql, Postgres la envuelve en una
-- transaccion implicita: si CUALQUIER paso falla (por ejemplo una tabla que se nos haya
-- quedado fuera y todavia referencie al tenant), la funcion completa hace rollback y no
-- se borra nada — no hay riesgo de un borrado a medias. Si eso pasa, el mensaje de error
-- de Postgres nombra la tabla/columna exacta que faltaba agregar aqui.
--
-- IRREVERSIBLE: no hay soft-delete ni papelera. Se usa unicamente para limpiar empresas
-- de prueba, nunca para una empresa con datos reales.
CREATE OR REPLACE FUNCTION delete_tenant_cascade(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1) Tablas que dependen de transacciones/citas/clientes/profesionales pero NO tienen
  --    ON DELETE CASCADE hacia esas tablas (hay que vaciarlas antes de poder borrar sus
  --    "padres" mas abajo).
  DELETE FROM loyalty_points WHERE tenant_id = p_tenant_id;

  DELETE FROM mp_payment_intents
    WHERE barber_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id)
       OR transaction_id IN (SELECT id FROM transactions WHERE tenant_id = p_tenant_id);

  DELETE FROM tuu_payment_intents WHERE tenant_id = p_tenant_id;

  DELETE FROM boletas_emitidas
    WHERE transaction_id IN (SELECT id FROM transactions WHERE tenant_id = p_tenant_id);

  DELETE FROM commissions WHERE tenant_id = p_tenant_id;

  DELETE FROM reviews
    WHERE client_id IN (SELECT id FROM clients WHERE tenant_id = p_tenant_id)
       OR barber_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id);

  -- client_photos referencia appointment_id sin cascade: hay que vaciarla antes de
  -- borrar appointments (paso 3), no solo antes de clients.
  DELETE FROM client_photos
    WHERE client_id IN (SELECT id FROM clients WHERE tenant_id = p_tenant_id);

  -- waitlist no tiene tenant_id propio (gap pre-existente, no corregido aqui) — se acota
  -- por barber_id o por el servicio, que si son del tenant.
  DELETE FROM waitlist
    WHERE barber_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id)
       OR service_id IN (SELECT id FROM services WHERE tenant_id = p_tenant_id);

  -- 2) Transacciones y citas. Sus hijos directos (transaction_items,
  --    transaction_payments, split_payments, appointment_services) SI tienen
  --    ON DELETE CASCADE hacia transactions/appointments y se limpian solos.
  DELETE FROM transactions WHERE tenant_id = p_tenant_id;
  DELETE FROM appointments WHERE tenant_id = p_tenant_id;

  -- 3) Resto de tablas con tenant_id propio.
  DELETE FROM inventory_movements WHERE tenant_id = p_tenant_id;
  DELETE FROM loyalty_rewards WHERE tenant_id = p_tenant_id;
  DELETE FROM loyalty_config WHERE tenant_id = p_tenant_id;
  DELETE FROM rental_records WHERE tenant_id = p_tenant_id;
  DELETE FROM cash_register WHERE tenant_id = p_tenant_id;
  DELETE FROM business_hours WHERE tenant_id = p_tenant_id;
  DELETE FROM coupons WHERE tenant_id = p_tenant_id;
  DELETE FROM price_history WHERE tenant_id = p_tenant_id;
  DELETE FROM gallery_images WHERE tenant_id = p_tenant_id;
  DELETE FROM invoices WHERE tenant_id = p_tenant_id;
  DELETE FROM booking_metrics WHERE tenant_id = p_tenant_id;

  -- La tabla `gallery` (vieja, distinta de `gallery_images`) referencia services sin
  -- cascade — hay que vaciarla antes de borrar `services` en el paso 4, no alcanza con
  -- dejar que cascade via profiles mas abajo (eso pasaria demasiado tarde).
  DELETE FROM gallery
    WHERE barber_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id);

  -- 4) Catalogo del negocio.
  DELETE FROM services WHERE tenant_id = p_tenant_id;
  DELETE FROM products WHERE tenant_id = p_tenant_id;

  -- 5) Clientes (cascada: client_notes, y cualquier client_photos remanente).
  DELETE FROM clients WHERE tenant_id = p_tenant_id;

  -- 6) Profesionales/usuarios del tenant. Todo lo que cuelga de profiles con
  --    ON DELETE CASCADE (barber_blocks, barber_schedule, barber_services,
  --    barber_service_assignments, push_subscriptions, login_sessions) se limpia solo.
  DELETE FROM profiles WHERE tenant_id = p_tenant_id;

  -- 7) Sucursales (nada relevante deberia seguir apuntando a ellas a esta altura).
  DELETE FROM branches WHERE tenant_id = p_tenant_id;

  -- 8) El tenant. Cascada automatica: tenant_settings, subscriptions, invite_codes,
  --    mp_terminals, tuu_terminals (todas tienen ON DELETE CASCADE directo a tenants).
  DELETE FROM tenants WHERE id = p_tenant_id;
END;
$$;
