-- 185: promociones «solo si reservan 2 personas juntas»: las dos citas quedan unidas por un mismo grupo. Aditiva y re-ejecutable.
alter table public.appointments add column if not exists coupon_group uuid;
create index if not exists appointments_coupon_group_idx on public.appointments (coupon_group) where coupon_group is not null;
-- Verificación: debe devolver 1 fila
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'coupon_group';
