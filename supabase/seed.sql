-- ==================== SEED DATA FOR ESTUDIOLEVELS ====================
-- Run this after creating users via Supabase Auth

-- Note: Users must be created via Supabase Auth Dashboard or API first.
-- After creating them, their profiles are auto-created by the trigger.
-- Example users to create in Supabase Auth:
--   admin@estudiolevels.com / admin123 (metadata: {"name": "Administrador", "role": "admin"})
--   carlos@estudiolevels.com / 123456 (metadata: {"name": "Carlos Gonzalez", "role": "barber"})
--   matias@estudiolevels.com / 123456 (metadata: {"name": "Matias Fernandez", "role": "barber"})
--   diego@estudiolevels.com / 123456 (metadata: {"name": "Diego Morales", "role": "barber"})
--   recepcion@estudiolevels.com / recepcion123 (metadata: {"name": "Recepcion", "role": "receptionist"})

-- ==================== SERVICES ====================

INSERT INTO services (name, description, price, duration) VALUES
  ('Corte Clasico', 'Corte de pelo clasico', 8000, 30),
  ('Corte + Barba', 'Corte de pelo y arreglo de barba', 12000, 45),
  ('Barba', 'Arreglo de barba con navaja', 5000, 20),
  ('Corte Fade', 'Degradado fade moderno', 10000, 40),
  ('Corte Nino', 'Corte para ninos menores de 12', 6000, 25),
  ('Cejas', 'Diseno de cejas', 3000, 10),
  ('Tratamiento Capilar', 'Tratamiento de hidratacion capilar', 15000, 30),
  ('Decoloracion', 'Decoloracion completa', 25000, 60),
  ('Tinte', 'Aplicacion de tinte', 20000, 50),
  ('Alisado', 'Alisado progresivo', 30000, 90);

-- ==================== PRODUCTS ====================

INSERT INTO products (name, price, cost, stock, min_stock) VALUES
  ('Cera para cabello', 8000, 3500, 20, 5),
  ('Pomada mate', 9000, 4000, 15, 5),
  ('Aceite para barba', 12000, 5000, 10, 3),
  ('Shampoo profesional', 7000, 3000, 25, 8),
  ('After shave', 6000, 2500, 12, 4),
  ('Gel fijacion fuerte', 5000, 2000, 30, 10),
  ('Balsamo barba', 10000, 4500, 8, 3),
  ('Cepillo barbero', 4000, 1500, 5, 2);

-- ==================== CLIENTS ====================

INSERT INTO clients (name, email, phone) VALUES
  ('Juan Perez', 'juan@email.com', '+56 9 1111 1111'),
  ('Pedro Martinez', 'pedro@email.com', '+56 9 2222 2222'),
  ('Andres Silva', 'andres@email.com', '+56 9 3333 3333'),
  ('Nicolas Lopez', 'nicolas@email.com', '+56 9 4444 4444'),
  ('Felipe Rojas', 'felipe@email.com', '+56 9 5555 5555'),
  ('Cristian Vargas', 'cristian@email.com', '+56 9 6666 6666'),
  ('Sebastian Muñoz', 'sebastian@email.com', '+56 9 7777 7777'),
  ('Diego Soto', 'diego.s@email.com', '+56 9 8888 8888');

-- ==================== COUPONS ====================

INSERT INTO coupons (code, description, discount_type, discount_value, max_uses, min_purchase) VALUES
  ('BIENVENIDO', 'Descuento de bienvenida - 10%', 'percentage', 10, 100, NULL),
  ('VERANO2024', 'Promo verano - $3.000 off', 'fixed_amount', 3000, 50, 15000),
  ('2X1BARBA', '50% descuento en barba', 'percentage', 50, 30, NULL),
  ('AMIGO10', '10% por referido', 'percentage', 10, NULL, 8000);

-- ==================== RPC FUNCTION FOR COUPON INCREMENT ====================

CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE coupons SET used_count = used_count + 1 WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
