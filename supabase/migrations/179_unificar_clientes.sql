-- 179: unificar fichas de clientes repetidas de un negocio (con respaldo de todo lo que toca).
-- Aditiva y re-ejecutable. No hace nada por sí sola: solo crea la tabla de respaldo y la función.
--   select * from unificar_clientes('<tenant>', false);  -- simulacro: cuenta lo que haría, sin cambiar nada
--   select * from unificar_clientes('<tenant>', true);   -- ejecuta (en una sola transacción)
--
-- Reglas:
--  1) Se eliminan las fichas VACÍAS: sin correo, sin teléfono, sin RUT, sin notas, sin puntos y sin ninguna cita, venta,
--     reseña, nota, foto ni documento enlazados.
--  2) Se unen las fichas de la MISMA PERSONA, en dos pasadas:
--       a) mismo teléfono (últimos 9 dígitos, así +56966151692 = 966151692) y mismo primer nombre (3 primeras letras, sin tildes);
--       b) mismo correo y mismo primer nombre, solo si entre esas fichas no hay dos teléfonos distintos.
--     Mismo teléfono con primer nombre distinto (familias, amigos) NO se une.
--  3) La ficha que queda es la de más historial (citas + ventas), luego la de nombre más largo, luego la más antigua.
--     Todo lo enlazado se pasa a ella; los datos que le falten (correo, teléfono, RUT, notas) se completan; los puntos se suman.
--  4) Cada ficha eliminada se guarda entera en clientes_unificados_respaldo (con a cuál se unió y cuántas filas se movieron).

create table if not exists public.clientes_unificados_respaldo (
  id bigserial primary key,
  tenant_id uuid,
  cliente jsonb not null,
  unido_en uuid,            -- ficha que quedó; null = era una ficha vacía y solo se eliminó
  motivo text not null,
  movidos jsonb,            -- {"appointments": 2, "transactions": 1, ...}
  creado_en timestamptz not null default now()
);
alter table public.clientes_unificados_respaldo enable row level security;  -- sin políticas: solo la llave de servicio

create or replace function public.unificar_clientes(p_tenant uuid, p_ejecutar boolean default false)
returns table(accion text, cantidad int)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  tablas text[] := array['appointments','transactions','reviews','loyalty_points','client_notes','client_photos','client_documents','booking_metrics','kiosk_payments','kiosk_links','retention_campaign_recipients'];
  t text;
  pasada int;
  r record;
  c int;
  movidos jsonb;
  n_vacias int := 0;
  n_grupos int := 0;
  n_unidas int := 0;
begin
  -- Sin disparadores durante la unión, para no tocar updated_at de miles de citas y ventas (si el rol no puede, se sigue igual).
  begin perform set_config('session_replication_role', 'replica', true); exception when others then null; end;

  -- 1) Fichas vacías
  create temp table _refs(id uuid primary key) on commit drop;
  foreach t in array tablas loop
    if to_regclass('public.' || t) is not null then
      execute format('insert into _refs select distinct client_id from public.%I where client_id is not null on conflict do nothing', t);
    end if;
  end loop;

  create temp table _vacias on commit drop as
    select c0.id from public.clients c0
    where c0.tenant_id = p_tenant
      and nullif(trim(coalesce(c0.email, '')), '') is null
      and nullif(regexp_replace(coalesce(c0.phone, ''), '\D', '', 'g'), '') is null
      and nullif(trim(coalesce(c0.notes, '')), '') is null
      and nullif(trim(coalesce(c0.rut, '')), '') is null
      and coalesce(c0.loyalty_points, 0) = 0
      and not exists (select 1 from _refs x where x.id = c0.id);
  select count(*) into n_vacias from _vacias;
  if p_ejecutar and n_vacias > 0 then
    insert into clientes_unificados_respaldo(tenant_id, cliente, unido_en, motivo)
      select p_tenant, to_jsonb(c1), null, 'ficha vacía (sin contacto ni historial)' from clients c1 where c1.id in (select id from _vacias);
    delete from clients where id in (select id from _vacias);
  end if;

  -- 2) Misma persona: pasada 1 = teléfono, pasada 2 = correo
  for pasada in 1..2 loop
    drop table if exists _cand;
    create temp table _cand as
      select c2.id, c2.created_at, c2.name,
             case when pasada = 1
                  then (case when length(regexp_replace(coalesce(c2.phone, ''), '\D', '', 'g')) >= 8 then right(regexp_replace(c2.phone, '\D', '', 'g'), 9) end)
                  else nullif(lower(trim(coalesce(c2.email, ''))), '') end as llave,
             nullif(left(split_part(lower(translate(trim(coalesce(c2.name, '')), 'áéíóúÁÉÍÓÚäëïöüÄËÏÖÜ', 'aeiouaeiouaeiouaeiou')), ' ', 1), 3), '') as nom,
             case when length(regexp_replace(coalesce(c2.phone, ''), '\D', '', 'g')) >= 8 then right(regexp_replace(c2.phone, '\D', '', 'g'), 9) end as tel9,
             (select count(*) from appointments a where a.client_id = c2.id) + (select count(*) from transactions tr where tr.client_id = c2.id) as hist
      from clients c2 where c2.tenant_id = p_tenant;

    create temp table _grupos as
      select llave || '|' || nom as g
      from _cand where llave is not null and nom is not null
      group by llave, nom
      having count(*) > 1 and (pasada = 1 or count(distinct tel9) <= 1);

    create temp table _orden as
      select cd.id, cd.llave || '|' || cd.nom as g,
             row_number() over (partition by cd.llave, cd.nom order by cd.hist desc, length(coalesce(cd.name, '')) desc, cd.created_at asc) as rn
      from _cand cd where (cd.llave || '|' || cd.nom) in (select g from _grupos);

    select count(*) into c from _grupos;
    n_grupos := n_grupos + c;

    for r in select d.id as dup, k.id as keeper from _orden d join _orden k on k.g = d.g and k.rn = 1 where d.rn > 1 loop
      n_unidas := n_unidas + 1;
      if p_ejecutar then
        movidos := '{}'::jsonb;
        foreach t in array tablas loop
          if to_regclass('public.' || t) is not null then
            execute format('update public.%I set client_id = $1 where client_id = $2', t) using r.keeper, r.dup;
            get diagnostics c = row_count;
            if c > 0 then movidos := movidos || jsonb_build_object(t, c); end if;
          end if;
        end loop;

        insert into clientes_unificados_respaldo(tenant_id, cliente, unido_en, motivo, movidos)
          select p_tenant, to_jsonb(d), r.keeper, case when pasada = 1 then 'mismo teléfono y primer nombre' else 'mismo correo y primer nombre' end, movidos
          from clients d where d.id = r.dup;

        update clients k set
          email = coalesce(nullif(trim(k.email), ''), d.email),
          phone = coalesce(nullif(trim(k.phone), ''), d.phone),
          rut = coalesce(nullif(trim(k.rut), ''), d.rut),
          notes = case when nullif(trim(d.notes), '') is null or position(trim(d.notes) in coalesce(k.notes, '')) > 0 then k.notes
                       when nullif(trim(k.notes), '') is null then d.notes
                       else k.notes || E'\n' || d.notes end,
          loyalty_points = coalesce(k.loyalty_points, 0) + coalesce(d.loyalty_points, 0),
          marketing_consent = coalesce(k.marketing_consent, false) or coalesce(d.marketing_consent, false),
          do_not_contact = coalesce(k.do_not_contact, false) or coalesce(d.do_not_contact, false),
          first_ad_attribution = coalesce(k.first_ad_attribution, d.first_ad_attribution),
          created_at = least(k.created_at, d.created_at)
        from clients d where k.id = r.keeper and d.id = r.dup;

        delete from clients where id = r.dup;
      end if;
    end loop;

    drop table _orden;
    drop table _grupos;
  end loop;

  accion := 'fichas vacías ' || case when p_ejecutar then 'eliminadas' else 'a eliminar' end; cantidad := n_vacias; return next;
  accion := 'personas con fichas repetidas (grupos)'; cantidad := n_grupos; return next;
  accion := 'fichas sobrantes ' || case when p_ejecutar then 'unidas' else 'a unir' end; cantidad := n_unidas; return next;
end;
$fn$;

revoke all on function public.unificar_clientes(uuid, boolean) from public, anon, authenticated;

-- Verificación (simulacro, no cambia nada). Reemplaza el id por el del negocio:
--   select * from unificar_clientes('00000000-0000-0000-0000-000000000000', false);
