-- ============================================================
-- SEED REALISTA: EstudioLevels - 9 barberos, 50+ cortes/dia
-- Facturacion mensual: ~$25.000.000
-- ============================================================

-- PRIMERO: Borrar datos anteriores de prueba (mantener barberos y servicios)
DELETE FROM reviews;
DELETE FROM loyalty_points;
DELETE FROM transaction_items;
DELETE FROM transactions;
DELETE FROM appointment_services;
DELETE FROM appointments;
DELETE FROM clients WHERE email LIKE '%@gmail.com' AND email LIKE '%.%1%';

-- Reset loyalty
UPDATE clients SET loyalty_points = 0;

-- Asegurar 700 clientes
DO $$
DECLARE
  first_names TEXT[] := ARRAY['Juan','Pedro','Carlos','Diego','Matias','Sebastian','Nicolas','Andres','Felipe','Cristian','Jorge','Roberto','Miguel','Oscar','Alejandro','Rodrigo','Daniel','Luis','Pablo','Ignacio','Tomas','Benjamin','Vicente','Gabriel','Joaquin','Lucas','Martin','Bastian','Franco','Maximiliano','Agustin','Emilio','Rafael','Gonzalo','Esteban','Claudio','Patricio','Hernan','Marcos','Victor','Eduardo','Fernando','Sergio','Leonardo','Raul','Adrian','Arturo','Javier','Antonio','Manuel','Camilo'];
  last_names TEXT[] := ARRAY['Gonzalez','Rodriguez','Martinez','Lopez','Garcia','Hernandez','Perez','Sanchez','Ramirez','Torres','Flores','Rivera','Gomez','Diaz','Reyes','Morales','Jimenez','Ruiz','Vargas','Rojas','Castillo','Ortiz','Mendoza','Silva','Soto','Contreras','Fuentes','Munoz','Bravo','Espinoza','Valenzuela','Araya','Sepulveda','Vergara','Figueroa','Carrasco','Campos','Nunez','Tapia','Olivares'];
  i INTEGER;
  fname TEXT;
  lname TEXT;
  existing_count INTEGER;
BEGIN
  SELECT count(*) INTO existing_count FROM clients;
  IF existing_count >= 700 THEN RETURN; END IF;
  
  FOR i IN 1..(700 - existing_count) LOOP
    fname := first_names[1 + floor(random() * array_length(first_names, 1))::int];
    lname := last_names[1 + floor(random() * array_length(last_names, 1))::int];
    INSERT INTO clients (name, email, phone, created_at)
    VALUES (
      fname || ' ' || lname,
      lower(fname) || '.' || lower(lname) || i || '@gmail.com',
      '+56 9 ' || (1000 + floor(random() * 8999))::int || ' ' || (1000 + floor(random() * 8999))::int,
      now() - (random() * 365)::int * interval '1 day'
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- GENERAR OPERACION REALISTA: 6 meses
-- 9 barberos, 5-6 cortes cada uno por dia, lunes a sabado
DO $$
DECLARE
  day_cursor DATE;
  barber_ids UUID[];
  service_data RECORD;
  client_ids UUID[];
  b_id UUID;
  c_id UUID;
  slot_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  appt_id UUID;
  tx_id UUID;
  pay_method payment_method;
  appt_status appointment_status;
  cuts_per_barber INTEGER;
  hour_slot INTEGER;
  min_slot INTEGER;
  barber_index INTEGER;
  cut_index INTEGER;
  service_price NUMERIC;
  service_duration INTEGER;
  service_name TEXT;
  service_id_val UUID;
  -- Weighted services (corte clasico es el mas comun)
  svc_ids UUID[];
  svc_prices NUMERIC[];
  svc_durations INTEGER[];
  svc_names TEXT[];
  svc_weights INTEGER[] := ARRAY[30,20,10,15,8,5,5,3,2,2]; -- peso por servicio
  svc_index INTEGER;
  weight_total INTEGER;
  weight_pick INTEGER;
  weight_sum INTEGER;
  -- Payment distribution: 40% efectivo, 30% debito, 20% credito, 10% transfer
  pay_roll NUMERIC;
  -- Products
  prod_id UUID;
  prod_price NUMERIC;
  prod_name TEXT;
BEGIN
  SELECT array_agg(id) INTO barber_ids FROM profiles WHERE role = 'barber' AND active = true;
  SELECT array_agg(id ORDER BY name), array_agg(price ORDER BY name), array_agg(duration ORDER BY name), array_agg(name ORDER BY name)
  INTO svc_ids, svc_prices, svc_durations, svc_names
  FROM services WHERE active = true;
  SELECT array_agg(id) INTO client_ids FROM clients;

  IF barber_ids IS NULL OR svc_ids IS NULL OR client_ids IS NULL THEN
    RAISE NOTICE 'Faltan datos base';
    RETURN;
  END IF;

  weight_total := 0;
  FOR i IN 1..array_length(svc_weights, 1) LOOP
    weight_total := weight_total + svc_weights[i];
  END LOOP;

  day_cursor := current_date - interval '180 days';

  WHILE day_cursor <= current_date LOOP
    -- Lunes a Sabado (skip domingo = 0)
    IF extract(dow FROM day_cursor) != 0 THEN

      -- Para cada barbero
      FOR barber_index IN 1..array_length(barber_ids, 1) LOOP
        b_id := barber_ids[barber_index];
        
        -- 5-6 cortes por barbero por dia (variacion random)
        cuts_per_barber := 4 + floor(random() * 3)::int; -- 4, 5, o 6

        FOR cut_index IN 1..cuts_per_barber LOOP
          -- Elegir servicio por peso (corte clasico mas comun)
          weight_pick := floor(random() * weight_total)::int;
          weight_sum := 0;
          svc_index := 1;
          FOR i IN 1..LEAST(array_length(svc_weights, 1), array_length(svc_ids, 1)) LOOP
            weight_sum := weight_sum + svc_weights[i];
            IF weight_pick < weight_sum THEN
              svc_index := i;
              EXIT;
            END IF;
          END LOOP;

          service_id_val := svc_ids[svc_index];
          service_price := svc_prices[svc_index];
          service_duration := svc_durations[svc_index];
          service_name := svc_names[svc_index];

          -- Random client
          c_id := client_ids[1 + floor(random() * array_length(client_ids, 1))::int];

          -- Time slot: primera cita 10:00, cada una despues del duration anterior
          hour_slot := 10 + floor((cut_index - 1) * (service_duration::numeric / 60) * 1.2)::int;
          IF hour_slot > 20 THEN hour_slot := 20; END IF;
          min_slot := (floor(random() * 4)::int) * 15;

          slot_time := day_cursor + make_time(hour_slot, min_slot, 0);
          end_time := slot_time + (service_duration || ' minutes')::interval;

          -- Status: 85% completed, 8% no_show, 7% cancelled
          IF random() < 0.85 THEN
            appt_status := 'completed';
          ELSIF random() < 0.55 THEN
            appt_status := 'no_show';
          ELSE
            appt_status := 'cancelled';
          END IF;

          -- Create appointment
          INSERT INTO appointments (client_id, barber_id, date, start_time, end_time, status, created_at)
          VALUES (c_id, b_id, day_cursor, slot_time, end_time, appt_status, slot_time - interval '1 day')
          RETURNING id INTO appt_id;

          INSERT INTO appointment_services (appointment_id, service_id, price)
          VALUES (appt_id, service_id_val, service_price);

          -- If completed, create transaction
          IF appt_status = 'completed' THEN
            -- Payment method weighted
            pay_roll := random();
            IF pay_roll < 0.40 THEN pay_method := 'cash';
            ELSIF pay_roll < 0.70 THEN pay_method := 'debit_card';
            ELSIF pay_roll < 0.90 THEN pay_method := 'credit_card';
            ELSE pay_method := 'transfer';
            END IF;

            INSERT INTO transactions (type, status, subtotal, total, payment_method, client_id, barber_id, appointment_id, created_at)
            VALUES ('income'::transaction_type, 'completed'::transaction_status, service_price, service_price, pay_method, c_id, b_id, appt_id, slot_time)
            RETURNING id INTO tx_id;

            INSERT INTO transaction_items (transaction_id, service_id, description, quantity, unit_price, total)
            VALUES (tx_id, service_id_val, service_name, 1, service_price, service_price);

            -- 30% de las veces tambien vende un producto
            IF random() < 0.30 THEN
              SELECT id, price, name INTO prod_id, prod_price, prod_name
              FROM products WHERE active = true ORDER BY random() LIMIT 1;

              IF prod_id IS NOT NULL THEN
                INSERT INTO transaction_items (transaction_id, product_id, description, quantity, unit_price, total)
                VALUES (tx_id, prod_id, prod_name, 1, prod_price, prod_price);
                UPDATE transactions SET subtotal = subtotal + prod_price, total = total + prod_price WHERE id = tx_id;
              END IF;
            END IF;
          END IF;

        END LOOP; -- cuts per barber
      END LOOP; -- barbers

      -- Gastos diarios (arriendo prorrateado, insumos, etc)
      -- $15.000-$40.000 diarios en gastos operativos
      DECLARE
        expense_items TEXT[] := ARRAY['Insumos barberia','Cafe y bebidas','Productos limpieza','Luz electrica','Internet','Mantencion equipos','Toallas desechables','Alcohol gel','Agua','Arriendo (prorrateo)'];
        num_expenses INTEGER;
      BEGIN
        num_expenses := 2 + floor(random() * 3)::int;
        FOR i IN 1..num_expenses LOOP
          INSERT INTO transactions (type, status, subtotal, total, payment_method, notes, created_at)
          VALUES (
            'income'::transaction_type, -- hack: actually expense
            'completed'::transaction_status,
            0, 0, 'cash'::payment_method, '', now()
          ); -- placeholder, update below
          
          -- Proper expense
          INSERT INTO transactions (type, status, subtotal, total, payment_method, notes, created_at)
          VALUES (
            'expense'::transaction_type,
            'completed'::transaction_status,
            (5000 + floor(random() * 15000))::numeric,
            (5000 + floor(random() * 15000))::numeric,
            'cash'::payment_method,
            expense_items[1 + floor(random() * array_length(expense_items, 1))::int],
            day_cursor + '14:00:00'::time
          );
        END LOOP;
        -- Delete placeholder
        DELETE FROM transactions WHERE type = 'income' AND subtotal = 0 AND total = 0 AND notes = '';
      END;

    END IF; -- not sunday
    day_cursor := day_cursor + interval '1 day';
  END LOOP;
END $$;

-- Reviews (300 reviews variados)
DO $$
DECLARE
  appt RECORD;
  comments TEXT[] := ARRAY['Excelente como siempre!','El mejor corte que me han hecho','Super recomendado, siempre vuelvo','Muy buena onda y queda impecable','Atencion de primera','Me encanto el fade','Barbero crack, quede filete','Un capo el barbero, siempre puntual','Buena vibra en el local','Corte preciso y rapido',NULL,NULL,NULL,NULL,NULL];
BEGIN
  FOR appt IN
    SELECT a.id, a.client_id, a.barber_id, a.start_time
    FROM appointments a WHERE a.status = 'completed'
    ORDER BY random() LIMIT 300
  LOOP
    INSERT INTO reviews (appointment_id, client_id, barber_id, rating, comment, created_at)
    VALUES (
      appt.id, appt.client_id, appt.barber_id,
      CASE WHEN random() < 0.6 THEN 5 WHEN random() < 0.8 THEN 4 ELSE 3 END,
      comments[1 + floor(random() * array_length(comments, 1))::int],
      appt.start_time + interval '1 hour'
    ) ON CONFLICT (appointment_id) DO NOTHING;
  END LOOP;
END $$;

-- Update loyalty points
UPDATE clients SET loyalty_points = COALESCE(sub.points, 0)
FROM (
  SELECT t.client_id, floor(sum(t.total) / 1000)::int as points
  FROM transactions t
  WHERE t.type = 'income' AND t.status = 'completed' AND t.client_id IS NOT NULL
  GROUP BY t.client_id
) sub
WHERE clients.id = sub.client_id;

-- RESUMEN FINAL
SELECT '--- RESUMEN ESTUDIOLEVELS ---' as info;
SELECT 'Clientes' as metrica, count(*)::text as valor FROM clients
UNION ALL SELECT 'Citas totales', count(*)::text FROM appointments
UNION ALL SELECT 'Citas completadas', count(*)::text FROM appointments WHERE status = 'completed'
UNION ALL SELECT 'No shows', count(*)::text FROM appointments WHERE status = 'no_show'
UNION ALL SELECT 'Transacciones', count(*)::text FROM transactions
UNION ALL SELECT 'Reviews', count(*)::text FROM reviews
UNION ALL SELECT '---', '---'
UNION ALL SELECT 'Facturacion total (6 meses)', '$' || to_char(sum(total), 'FM999,999,999') FROM transactions WHERE type = 'income' AND status = 'completed'
UNION ALL SELECT 'Facturacion mensual promedio', '$' || to_char(sum(total)/6, 'FM999,999,999') FROM transactions WHERE type = 'income' AND status = 'completed'
UNION ALL SELECT 'Gastos totales (6 meses)', '$' || to_char(sum(total), 'FM999,999,999') FROM transactions WHERE type = 'expense'
UNION ALL SELECT 'Ticket promedio', '$' || to_char(avg(total), 'FM999,999') FROM transactions WHERE type = 'income' AND status = 'completed'
UNION ALL SELECT 'Atenciones por dia promedio', round(count(*)::numeric / 156, 1)::text FROM appointments WHERE status = 'completed';
