-- ============================================================
-- SEED MASIVO: Simula 6 meses de operacion con ~700 clientes
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Generar 700 clientes realistas con nombres chilenos
DO $$
DECLARE
  first_names TEXT[] := ARRAY['Juan','Pedro','Carlos','Diego','Matias','Sebastian','Nicolas','Andres','Felipe','Cristian','Jorge','Roberto','Miguel','Oscar','Alejandro','Rodrigo','Daniel','Luis','Pablo','Ignacio','Tomas','Benjamin','Vicente','Gabriel','Joaquin','Lucas','Martin','Bastian','Franco','Maximiliano','Agustin','Emilio','Rafael','Gonzalo','Esteban','Claudio','Patricio','Hernan','Marcos','Victor','Eduardo','Fernando','Sergio','Leonardo','Raul','Adrian','Arturo','Javier','Antonio','Manuel'];
  last_names TEXT[] := ARRAY['Gonzalez','Rodriguez','Martinez','Lopez','Garcia','Hernandez','Perez','Sanchez','Ramirez','Torres','Flores','Rivera','Gomez','Diaz','Reyes','Morales','Jimenez','Ruiz','Vargas','Rojas','Castillo','Ortiz','Mendoza','Silva','Soto','Contreras','Fuentes','Munoz','Bravo','Espinoza','Valenzuela','Araya','Sepulveda','Vergara','Figueroa','Carrasco','Campos','Nunez','Tapia','Olivares'];
  i INTEGER;
  fname TEXT;
  lname TEXT;
  email_addr TEXT;
  phone_num TEXT;
  reg_date TIMESTAMPTZ;
BEGIN
  FOR i IN 1..700 LOOP
    fname := first_names[1 + floor(random() * array_length(first_names, 1))::int];
    lname := last_names[1 + floor(random() * array_length(last_names, 1))::int];
    email_addr := lower(fname) || '.' || lower(lname) || i || '@gmail.com';
    phone_num := '+56 9 ' || (1000 + floor(random() * 8999))::int || ' ' || (1000 + floor(random() * 8999))::int;
    reg_date := now() - (random() * 180)::int * interval '1 day';

    INSERT INTO clients (name, email, phone, created_at)
    VALUES (fname || ' ' || lname, email_addr, phone_num, reg_date)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 2. Generar citas y transacciones para los ultimos 6 meses
-- Simula ~25 citas por dia laborable (9 barberos x ~3 citas cada uno)
DO $$
DECLARE
  day_cursor DATE;
  day_end DATE;
  barber_ids UUID[];
  service_ids UUID[];
  service_prices NUMERIC[];
  service_durations INTEGER[];
  client_ids UUID[];
  b_id UUID;
  s_id UUID;
  c_id UUID;
  s_price NUMERIC;
  s_duration INTEGER;
  slot_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  appt_id UUID;
  tx_id UUID;
  payment_methods TEXT[] := ARRAY['cash','cash','cash','debit_card','debit_card','credit_card','transfer'];
  pay_method TEXT;
  appts_per_day INTEGER;
  hour_slot INTEGER;
  min_slot INTEGER;
  statuses TEXT[] := ARRAY['completed','completed','completed','completed','completed','completed','completed','completed','cancelled','no_show'];
  appt_status TEXT;
BEGIN
  -- Get barber IDs
  SELECT array_agg(id) INTO barber_ids FROM profiles WHERE role = 'barber' AND active = true;
  -- Get service info
  SELECT array_agg(id), array_agg(price), array_agg(duration)
  INTO service_ids, service_prices, service_durations
  FROM services WHERE active = true;
  -- Get client IDs
  SELECT array_agg(id) INTO client_ids FROM clients;

  IF barber_ids IS NULL OR service_ids IS NULL OR client_ids IS NULL THEN
    RAISE NOTICE 'No hay barberos, servicios o clientes. Ejecuta el seed basico primero.';
    RETURN;
  END IF;

  day_cursor := current_date - interval '180 days';
  day_end := current_date;

  WHILE day_cursor <= day_end LOOP
    -- Skip Sundays (barberia cerrada)
    IF extract(dow FROM day_cursor) != 0 THEN
      -- Between 20-30 appointments per day
      appts_per_day := 20 + floor(random() * 11)::int;

      FOR i IN 1..appts_per_day LOOP
        -- Random barber, service, client
        b_id := barber_ids[1 + floor(random() * array_length(barber_ids, 1))::int];
        s_id := service_ids[1 + floor(random() * array_length(service_ids, 1))::int];
        s_price := service_prices[1 + floor(random() * array_length(service_prices, 1))::int];
        s_duration := service_durations[1 + floor(random() * array_length(service_durations, 1))::int];
        c_id := client_ids[1 + floor(random() * array_length(client_ids, 1))::int];
        pay_method := payment_methods[1 + floor(random() * array_length(payment_methods, 1))::int];
        appt_status := statuses[1 + floor(random() * array_length(statuses, 1))::int];

        -- Random time slot between 10:00 and 20:00
        hour_slot := 10 + floor(random() * 10)::int;
        min_slot := (floor(random() * 4)::int) * 15; -- 0, 15, 30, 45

        slot_time := day_cursor + (hour_slot || ':' || lpad(min_slot::text, 2, '0'))::time;
        end_time := slot_time + (s_duration || ' minutes')::interval;

        -- Create appointment
        INSERT INTO appointments (client_id, barber_id, date, start_time, end_time, status, created_at)
        VALUES (c_id, b_id, day_cursor, slot_time, end_time, appt_status::appointment_status, slot_time - interval '2 days')
        RETURNING id INTO appt_id;

        -- Add service to appointment
        INSERT INTO appointment_services (appointment_id, service_id, price)
        VALUES (appt_id, s_id, s_price);

        -- If completed, create transaction
        IF appt_status = 'completed' THEN
          INSERT INTO transactions (type, status, subtotal, total, payment_method, client_id, barber_id, appointment_id, created_at)
          VALUES ('income'::transaction_type, 'completed'::transaction_status, s_price, s_price, pay_method::payment_method, c_id, b_id, appt_id, slot_time)
          RETURNING id INTO tx_id;

          -- Transaction item
          INSERT INTO transaction_items (transaction_id, service_id, description, quantity, unit_price, total)
          SELECT tx_id, s_id, name, 1, s_price, s_price FROM services WHERE id = s_id;

          -- Sometimes also sell a product (30% chance)
          IF random() < 0.3 THEN
            DECLARE
              prod_id UUID;
              prod_price NUMERIC;
              prod_name TEXT;
            BEGIN
              SELECT id, price, name INTO prod_id, prod_price, prod_name
              FROM products WHERE active = true ORDER BY random() LIMIT 1;

              IF prod_id IS NOT NULL THEN
                -- Add product to same transaction
                INSERT INTO transaction_items (transaction_id, product_id, description, quantity, unit_price, total)
                VALUES (tx_id, prod_id, prod_name, 1, prod_price, prod_price);

                -- Update transaction total
                UPDATE transactions SET subtotal = subtotal + prod_price, total = total + prod_price WHERE id = tx_id;
              END IF;
            END;
          END IF;
        END IF;
      END LOOP;

      -- Add 2-4 daily expenses (random)
      FOR i IN 1..(2 + floor(random() * 3)::int) LOOP
        DECLARE
          expense_descriptions TEXT[] := ARRAY['Insumos limpieza','Cafe y agua','Luz','Internet','Mantencion equipos','Productos barberia','Bolsas','Toallas','Alcohol gel','Repuestos maquinas'];
          exp_desc TEXT;
          exp_amount NUMERIC;
        BEGIN
          exp_desc := expense_descriptions[1 + floor(random() * array_length(expense_descriptions, 1))::int];
          exp_amount := (5 + floor(random() * 50)::int) * 1000; -- $5.000 a $55.000

          INSERT INTO transactions (type, status, subtotal, total, payment_method, notes, created_at)
          VALUES ('expense'::transaction_type, 'completed'::transaction_status, exp_amount, exp_amount, 'cash'::payment_method, exp_desc, day_cursor + '12:00:00'::time);
        END;
      END LOOP;
    END IF;

    day_cursor := day_cursor + interval '1 day';
  END LOOP;
END $$;

-- 3. Generar algunos reviews aleatorios
DO $$
DECLARE
  appt RECORD;
  comments TEXT[] := ARRAY['Excelente atencion!','Muy buen corte','Siempre quedo conforme','El mejor de Puente Alto','Rapido y prolijo','Buena onda el barbero','Me gusto mucho el resultado','Volvere pronto','Super recomendado','Buen servicio, un poco de espera','Todo bien','Nada que decir, perfecto',NULL,NULL,NULL,NULL,NULL];
BEGIN
  FOR appt IN
    SELECT a.id, a.client_id, a.barber_id
    FROM appointments a
    WHERE a.status = 'completed'
    ORDER BY random()
    LIMIT 200
  LOOP
    INSERT INTO reviews (appointment_id, client_id, barber_id, rating, comment, created_at)
    VALUES (
      appt.id,
      appt.client_id,
      appt.barber_id,
      3 + floor(random() * 3)::int, -- rating 3-5
      comments[1 + floor(random() * array_length(comments, 1))::int],
      now() - (random() * 60)::int * interval '1 day'
    )
    ON CONFLICT (appointment_id) DO NOTHING;
  END LOOP;
END $$;

-- 4. Update loyalty points based on transactions
UPDATE clients SET loyalty_points = sub.points
FROM (
  SELECT t.client_id, floor(sum(t.total) / 1000)::int as points
  FROM transactions t
  WHERE t.type = 'income' AND t.status = 'completed' AND t.client_id IS NOT NULL
  GROUP BY t.client_id
) sub
WHERE clients.id = sub.client_id;

-- 5. Summary
SELECT 'Clientes' as tabla, count(*) as total FROM clients
UNION ALL
SELECT 'Citas', count(*) FROM appointments
UNION ALL
SELECT 'Transacciones', count(*) FROM transactions
UNION ALL
SELECT 'Reviews', count(*) FROM reviews
UNION ALL
SELECT 'Citas completadas', count(*) FROM appointments WHERE status = 'completed'
UNION ALL
SELECT 'No shows', count(*) FROM appointments WHERE status = 'no_show';
