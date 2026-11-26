-- 183: corrige unificar_clientes (179): quien nunca respondió sobre promociones quedaba en «no».
-- Ahora: sin respuesta + sin respuesta = sin respuesta; si hay respuestas, vale la más reciente. Aditiva y re-ejecutable.
do $m$
declare def text; nuevo text;
begin
  select pg_get_functiondef('public.unificar_clientes(uuid, boolean)'::regprocedure) into def;
  nuevo := replace(def,
    'marketing_consent = coalesce(k.marketing_consent, false) or coalesce(d.marketing_consent, false),',
    'marketing_consent = case when k.marketing_consent is null then d.marketing_consent when d.marketing_consent is null then k.marketing_consent when coalesce(d.marketing_consent_at, ''-infinity'') > coalesce(k.marketing_consent_at, ''-infinity'') then d.marketing_consent else k.marketing_consent end,
          marketing_consent_at = case when k.marketing_consent is null then d.marketing_consent_at when d.marketing_consent is null then k.marketing_consent_at else greatest(k.marketing_consent_at, d.marketing_consent_at) end,');
  if nuevo <> def then execute nuevo; end if;
end $m$;

-- Verificación: debe devolver true
select position('marketing_consent = case when' in pg_get_functiondef('public.unificar_clientes(uuid, boolean)'::regprocedure)) > 0 as corregida;
