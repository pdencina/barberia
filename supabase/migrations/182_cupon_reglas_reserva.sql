-- 182: reglas por cupón y código escrito al reservar. Aditiva y re-ejecutable.
alter table public.coupons add column if not exists conditions jsonb;
alter table public.appointments add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
create index if not exists appointments_coupon_idx on public.appointments (coupon_id) where coupon_id is not null;
-- Verificación: debe devolver 2 filas
select table_name, column_name from information_schema.columns
 where table_schema = 'public' and ((table_name = 'coupons' and column_name = 'conditions') or (table_name = 'appointments' and column_name = 'coupon_id'));
