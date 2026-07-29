-- ============================================================
-- SEED PRESENTACION: Data épica para impresionar al cliente
-- EstudioLevels: 9 barberos, 700+ clientes, $25M+ mensual
-- ============================================================

-- LIMPIAR TODO (mantener estructura y barberos)
DELETE FROM reviews;
DELETE FROM loyalty_points;
DELETE FROM commissions;
DELETE FROM client_notes;
DELETE FROM transaction_items;
DELETE FROM transactions;
DELETE FROM appointment_services;
DELETE FROM appointments;
DELETE FROM inventory_movements;
DELETE FROM waitlist;
DELETE FROM cash_register;
UPDATE clients SET loyalty_points = 0;

-- Solo borrar clientes de prueba (mantener los del seed original)
DELETE FROM clients WHERE email LIKE '%gmail.com%';

-- ============================================================
-- 1. GENERAR 700 CLIENTES CHILENOS
-- ============================================================
DO $$
DECLARE
  fn TEXT[] := ARRAY['Juan','Pedro','Carlos','Diego','Matias','Sebastian','Nicolas','Andres','Felipe','Cristian','Jorge','Roberto','Miguel','Oscar','Alejandro','Rodrigo','Daniel','Luis','Pablo','Ignacio','Tomas','Benjamin','Vicente','Gabriel','Joaquin','Lucas','Martin','Bastian','Franco','Maximiliano','Agustin','Emilio','Rafael','Gonzalo','Esteban','Claudio','Patricio','Hernan','Marcos','Victor','Eduardo','Fernando','Sergio','Leonardo','Raul','Adrian','Arturo','Javier','Antonio','Manuel','Camilo','Ivan','Rene','Mario','Santiago','Alonso'];
  ln TEXT[] := ARRAY['Gonzalez','Rodriguez','Martinez','Lopez','Garcia','Hernandez','Perez','Sanchez','Ramirez','Torres','Flores','Rivera','Gomez','Diaz','Reyes','Morales','Jimenez','Ruiz','Vargas','Rojas','Castillo','Ortiz','Mendoza','Silva','Soto','Contreras','Fuentes','Munoz','Bravo','Espinoza','Valenzuela','Araya','Sepulveda','Vergara','Figueroa','Carrasco','Campos','Nunez','Tapia','Olivares','Lagos','Herrera','Marin','Pizarro','Cordova'];
  existing INT;
BEGIN
  SELECT count(*) INTO existing FROM clients;
  FOR i IN 1..(750 - LEAST(existing, 750)) LOOP
    INSERT INTO clients (name, email, phone, created_at)
    VALUES (
      fn[1 + floor(random() * array_length(fn,1))::int] || ' ' || ln[1 + floor(random() * array_length(ln,1))::int],
      'cliente' || i || floor(random()*999)::int || '@gmail.com',
      '+56 9 ' || (3000 + floor(random()*6999))::int || ' ' || (1000 + floor(random()*8999))::int,
      now() - (random() * 365)::int * interval '1 day'
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- 2. OPERACION DIARIA: 6 meses, 9 barberos, 5-7 cortes c/u
-- Facturacion esperada: ~$25M/mes = $150M total
-- ============================================================
DO $$
DECLARE
  day_cursor DATE;
  barber_ids UUID[];
  svc_ids UUID[];
  svc_prices NUMERIC[];
  svc_durations INTEGER[];
  svc_names TEXT[];
  client_ids UUID[];
  b_id UUID;
  c_id UUID;
  s_idx INTEGER;
  slot_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  appt_id UUID;
  tx_id UUID;
  pay_method payment_method;
  appt_status appointment_status;
  cuts INTEGER;
  hour_base INTEGER;
  service_price NUMERIC;
  service_duration INTEGER;
  service_name TEXT;
  service_id UUID;
  prod_id UUID;
  prod_price NUMERIC;
  prod_name TEXT;
  -- Weighted service selection (corte clasico dominante)
  svc_weights INT[] := ARRAY[35,20,12,15,8,3,3,2,1,1];
  weight_total INT := 100;
  weight_pick INT;
  weight_sum INT;
BEGIN
  SELECT array_agg(id ORDER BY name) INTO barber_ids FROM profiles WHERE role = 'barber' AND active = true;
  SELECT array_agg(id ORDER BY name), array_agg(price ORDER BY name), array_agg(duration ORDER BY name), array_agg(name ORDER BY name)
  INTO svc_ids, svc_prices, svc_durations, svc_names FROM services WHERE active = true;
  SELECT array_agg(id) INTO client_ids FROM clients;

  IF barber_ids IS NULL OR svc_ids IS NULL OR client_ids IS NULL THEN
    RAISE NOTICE 'Faltan datos base'; RETURN;
  END IF;

  day_cursor := current_date - interval '180 days';

  WHILE day_cursor <= current_date + interval '7 days' LOOP
    -- Lunes a Sabado
    IF extract(dow FROM day_cursor) BETWEEN 1 AND 6 THEN

      -- Cada barbero: 5-7 cortes/dia
      FOR bi IN 1..array_length(barber_ids, 1) LOOP
        b_id := barber_ids[bi];
        cuts := 5 + floor(random() * 3)::int;

        FOR ci IN 1..cuts LOOP
          -- Servicio por peso
          weight_pick := floor(random() * weight_total)::int;
          weight_sum := 0;
          s_idx := 1;
          FOR wi IN 1..LEAST(array_length(svc_weights,1), array_length(svc_ids,1)) LOOP
            weight_sum := weight_sum + svc_weights[wi];
            IF weight_pick < weight_sum THEN s_idx := wi; EXIT; END IF;
          END LOOP;

          service_id := svc_ids[s_idx];
          service_price := svc_prices[s_idx];
          service_duration := svc_durations[s_idx];
          service_name := svc_names[s_idx];

          -- Cliente random
          c_id := client_ids[1 + floor(random() * array_length(client_ids,1))::int];

          -- Hora: empieza 9:30 + offset por corte
          hour_base := 9 + floor(ci * 1.3)::int;
          IF hour_base > 20 THEN hour_base := 20; END IF;
          slot_time := day_cursor + make_time(hour_base, (floor(random()*4)::int) * 15, 0);
          end_time := slot_time + (service_duration || ' minutes')::interval;

          -- Status
          IF day_cursor < current_date THEN
            IF random() < 0.87 THEN appt_status := 'completed';
            ELSIF random() < 0.6 THEN appt_status := 'no_show';
            ELSE appt_status := 'cancelled'; END IF;
          ELSE
            IF random() < 0.5 THEN appt_status := 'scheduled';
            ELSE appt_status := 'confirmed'; END IF;
          END IF;

          -- Crear cita
          INSERT INTO appointments (client_id, barber_id, date, start_time, end_time, status, created_at)
          VALUES (c_id, b_id, day_cursor, slot_time, end_time, appt_status, slot_time - interval '2 days')
          RETURNING id INTO appt_id;

          INSERT INTO appointment_services (appointment_id, service_id, price)
          VALUES (appt_id, service_id, service_price);

          -- Transaccion si completada
          IF appt_status = 'completed' THEN
            -- Metodo pago: 35% efectivo, 30% debito, 25% credito, 10% transfer
            IF random() < 0.35 THEN pay_method := 'cash';
            ELSIF random() < 0.65 THEN pay_method := 'debit_card';
            ELSIF random() < 0.90 THEN pay_method := 'credit_card';
            ELSE pay_method := 'transfer'; END IF;

            INSERT INTO transactions (type, status, subtotal, total, payment_method, client_id, barber_id, appointment_id, created_at)
            VALUES ('income'::transaction_type, 'completed'::transaction_status, service_price, service_price, pay_method, c_id, b_id, appt_id, slot_time)
            RETURNING id INTO tx_id;

            INSERT INTO transaction_items (transaction_id, service_id, description, quantity, unit_price, total)
            VALUES (tx_id, service_id, service_name, 1, service_price, service_price);

            -- 35% venta de producto adicional
            IF random() < 0.35 THEN
              SELECT id, price, name INTO prod_id, prod_price, prod_name
              FROM products WHERE active = true ORDER BY random() LIMIT 1;
              IF prod_id IS NOT NULL THEN
                INSERT INTO transaction_items (transaction_id, product_id, description, quantity, unit_price, total)
                VALUES (tx_id, prod_id, prod_name, 1, prod_price, prod_price);
                UPDATE transactions SET subtotal = subtotal + prod_price, total = total + prod_price WHERE id = tx_id;
              END IF;
            END IF;
          END IF;
        END LOOP;
      END LOOP;

      -- Gastos diarios: $20K-$60K
      FOR i IN 1..(2 + floor(random()*3)::int) LOOP
        INSERT INTO transactions (type, status, subtotal, total, payment_method, notes, created_at)
        VALUES ('expense'::transaction_type, 'completed'::transaction_status,
          (10000 + floor(random()*20000))::numeric, (10000 + floor(random()*20000))::numeric,
          'cash'::payment_method,
          (ARRAY['Insumos','Cafe','Luz','Internet','Productos','Limpieza','Arriendo','Mantencion','Agua','Gas'])[1+floor(random()*10)::int],
          day_cursor + '14:00:00'::time);
      END LOOP;

    END IF;
    day_cursor := day_cursor + interval '1 day';
  END LOOP;
END $$;

-- ============================================================
-- 3. REVIEWS: 500 reviews (mayoria 4-5 estrellas)
-- ============================================================
DO $$
DECLARE
  appt RECORD;
  comments TEXT[] := ARRAY['Excelente!','Siempre impecable','El mejor de Puente Alto','Super recomendado','Crack el barbero','Quede filete','Muy buena onda','Corte preciso','Volvere siempre','Top barberia','Ambiente 10/10','Rapido y prolijo','Barbero de confianza','Nivel premium',NULL,NULL,NULL,NULL,NULL,NULL];
BEGIN
  FOR appt IN SELECT a.id, a.client_id, a.barber_id, a.start_time
    FROM appointments a WHERE a.status = 'completed' ORDER BY random() LIMIT 500
  LOOP
    INSERT INTO reviews (appointment_id, client_id, barber_id, rating, comment, created_at)
    VALUES (appt.id, appt.client_id, appt.barber_id,
      CASE WHEN random() < 0.55 THEN 5 WHEN random() < 0.80 THEN 4 ELSE 3 END,
      comments[1 + floor(random() * array_length(comments,1))::int],
      appt.start_time + interval '2 hours'
    ) ON CONFLICT (appointment_id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- 4. LOYALTY POINTS (basado en transacciones reales)
-- ============================================================
UPDATE clients SET loyalty_points = COALESCE(sub.points, 0)
FROM (
  SELECT t.client_id, floor(sum(t.total) / 1000)::int as points
  FROM transactions t
  WHERE t.type = 'income' AND t.status = 'completed' AND t.client_id IS NOT NULL
  GROUP BY t.client_id
) sub WHERE clients.id = sub.client_id;

-- ============================================================
-- 5. NOTAS DE CLIENTES (top 50 clientes con notas)
-- ============================================================
DO $$
DECLARE
  c RECORD;
  notas TEXT[] := ARRAY['Siempre pide fade bajo con linea','Prefiere navaja para barba','Alergico a ciertos productos','Cliente VIP - atencion preferencial','Le gusta conversar, darle tiempo','Pide degradado alto siempre','Trae foto de referencia','Paga siempre con tarjeta','Viene con su hijo los sabados','Prefiere corte sin maquina','Le gusta el after shave mentolado','Siempre llega 5 min antes','Prefiere a Enzo siempre','Trabaja cerca, viene en almuerzo','Estudiante - descuento habitual'];
BEGIN
  FOR c IN SELECT id FROM clients ORDER BY loyalty_points DESC LIMIT 50 LOOP
    INSERT INTO client_notes (client_id, note, pinned, created_at)
    VALUES (c.id, notas[1 + floor(random() * array_length(notas,1))::int], random() < 0.3, now() - (random()*60)::int * interval '1 day')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- 6. WAITLIST (10 personas esperando hora)
-- ============================================================
INSERT INTO waitlist (client_name, client_email, client_phone, preferred_date, status, created_at)
SELECT name, email, phone, current_date + (1 + floor(random()*5))::int * interval '1 day', 'waiting', now()
FROM clients ORDER BY random() LIMIT 10;

-- ============================================================
-- 7. CAJA DIARIA (ultimos 7 dias)
-- ============================================================
DO $$
DECLARE
  d DATE;
BEGIN
  FOR i IN 0..6 LOOP
    d := current_date - i * interval '1 day';
    IF extract(dow FROM d) BETWEEN 1 AND 6 THEN
      INSERT INTO cash_register (date, opening_amount, closing_amount, expected_amount, difference, status, opened_at, closed_at)
      VALUES (d, 50000, 
        50000 + (700000 + floor(random()*300000))::int,
        50000 + (700000 + floor(random()*300000))::int,
        (floor(random()*5000) - 2000)::int,
        CASE WHEN i > 0 THEN 'closed' ELSE 'open' END,
        d + '09:00:00'::time,
        CASE WHEN i > 0 THEN d + '21:00:00'::time ELSE NULL END
      ) ON CONFLICT (date) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 8. INVENTORY MOVEMENTS (ultimas semanas)
-- ============================================================
DO $$
DECLARE
  prod RECORD;
BEGIN
  FOR prod IN SELECT id FROM products WHERE active = true LOOP
    -- Entrada de stock
    INSERT INTO inventory_movements (product_id, type, quantity, notes, status, created_at)
    VALUES (prod.id, 'in'::movement_type, 10 + floor(random()*20)::int, 'Reposicion mensual', 'approved', now() - interval '15 days');
    -- Algunas salidas por uso
    INSERT INTO inventory_movements (product_id, type, quantity, notes, status, created_at)
    VALUES (prod.id, 'out_use'::movement_type, 2 + floor(random()*5)::int, 'Uso en atencion', 'approved', now() - interval '5 days');
  END LOOP;
END $$;

-- ============================================================
-- 9. RESUMEN FINAL
-- ============================================================
SELECT '═══════════════════════════════════════' as "═══ ESTUDIOLEVELS ═══";
SELECT 'Clientes' as metrica, count(*)::text as valor FROM clients
UNION ALL SELECT 'Citas (6 meses)', count(*)::text FROM appointments
UNION ALL SELECT 'Citas completadas', count(*)::text FROM appointments WHERE status = 'completed'
UNION ALL SELECT 'Citas futuras (prox 7 dias)', count(*)::text FROM appointments WHERE date > current_date
UNION ALL SELECT 'No shows', count(*)::text FROM appointments WHERE status = 'no_show'
UNION ALL SELECT 'Reviews', count(*)::text FROM reviews
UNION ALL SELECT 'Notas de clientes', count(*)::text FROM client_notes
UNION ALL SELECT 'Lista de espera', count(*)::text FROM waitlist WHERE status = 'waiting'
UNION ALL SELECT '---', '---'
UNION ALL SELECT 'FACTURACION TOTAL', '$' || to_char(sum(total), 'FM999,999,999') FROM transactions WHERE type = 'income' AND status = 'completed'
UNION ALL SELECT 'FACTURACION MENSUAL', '$' || to_char(sum(total)/6, 'FM999,999,999') FROM transactions WHERE type = 'income' AND status = 'completed'
UNION ALL SELECT 'GASTOS TOTALES', '$' || to_char(sum(total), 'FM999,999,999') FROM transactions WHERE type = 'expense'
UNION ALL SELECT 'UTILIDAD NETA', '$' || to_char((SELECT sum(total) FROM transactions WHERE type='income' AND status='completed') - (SELECT sum(total) FROM transactions WHERE type='expense'), 'FM999,999,999')
UNION ALL SELECT 'TICKET PROMEDIO', '$' || to_char(avg(total), 'FM999,999') FROM transactions WHERE type = 'income' AND status = 'completed'
UNION ALL SELECT 'ATENCIONES/DIA', round(count(*)::numeric / 156, 1)::text FROM appointments WHERE status = 'completed'
UNION ALL SELECT 'TOP CLIENTE (puntos)', name || ' (' || loyalty_points || ' pts)' FROM clients ORDER BY loyalty_points DESC LIMIT 1
UNION ALL SELECT 'RATING PROMEDIO', round(avg(rating)::numeric, 2)::text || ' estrellas' FROM reviews;
