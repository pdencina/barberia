-- BORRADOR — NO EJECUTAR
-- C2, Nico 27 oct. 2026. Solo PGlite sintético autorizado; no Supabase/producción.
-- HECHO: 006 ya registra tenant/contacto HMAC y tiene RLS sin políticas abiertas.
ALTER TABLE public.agent_whatsapp_events ADD COLUMN IF NOT EXISTS admin_notice_claimed_at timestamptz;
CREATE INDEX IF NOT EXISTS agent_whatsapp_events_admin_notice_idx
  ON public.agent_whatsapp_events(tenant_id,contact_hash,admin_notice_claimed_at)
  WHERE admin_notice_claimed_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.agent_claim_whatsapp_admin_notice(
 p_tenant_id uuid, p_contact_hash text, p_event_key text, p_now timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_id bigint;
BEGIN
 IF p_tenant_id IS NULL OR p_contact_hash IS NULL OR p_contact_hash !~ '^[a-f0-9]{64}$'
  OR p_now IS NULL OR NOT isfinite(p_now) THEN RAISE EXCEPTION 'Aviso inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_contact_hash,0));
 IF NOT EXISTS (SELECT 1 FROM public.agent_whatsapp_events WHERE tenant_id=p_tenant_id
  AND contact_hash=p_contact_hash AND event_key=p_event_key) THEN RAISE EXCEPTION 'Evento no autorizado'; END IF;
 IF EXISTS (SELECT 1 FROM public.agent_whatsapp_events WHERE tenant_id=p_tenant_id
  AND contact_hash=p_contact_hash AND admin_notice_claimed_at > p_now - interval '1 hour') THEN RETURN false; END IF;
 UPDATE public.agent_whatsapp_events SET admin_notice_claimed_at=p_now
  WHERE tenant_id=p_tenant_id AND contact_hash=p_contact_hash AND event_key=p_event_key
  AND admin_notice_claimed_at IS NULL RETURNING id INTO v_id;
 RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.agent_claim_whatsapp_admin_notice(uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.agent_claim_whatsapp_admin_notice(uuid,text,text,timestamptz) TO service_role;
-- INFERENCIA técnica: se reclama antes del correo; fallo/timeout consume la hora de aviso,
-- no se reintenta a ciegas. No se agrega texto/telefono ni cambia retención de 006.
