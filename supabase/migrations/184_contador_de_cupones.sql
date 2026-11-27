-- 184: contador de usos de un cupón. Ya existe en producción; faltaba en la base de pruebas. Aditiva y re-ejecutable
-- (no reemplaza la función si ya está).
do $m$
begin
  if to_regprocedure('public.increment_coupon_usage(uuid)') is null then
    create function public.increment_coupon_usage(coupon_id uuid) returns void
    language plpgsql security definer set search_path = public
    as $f$ begin update coupons set used_count = used_count + 1 where id = coupon_id; end $f$;
    revoke all on function public.increment_coupon_usage(uuid) from public, anon, authenticated;
    grant execute on function public.increment_coupon_usage(uuid) to service_role;
  end if;
end $m$;

-- Verificación: debe devolver true
select to_regprocedure('public.increment_coupon_usage(uuid)') is not null as existe;
