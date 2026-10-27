-- BORRADOR — NO EJECUTAR
-- Nico autoriza este borrador el 27 oct. 2026; Claude revisa y Nico aplica por separado.
-- INFERENCIA: complemento aditivo de 005 para admisión atómica entre invocaciones.
-- Solo metadatos/HMAC; sin texto, teléfonos, payload, nombres ni secretos.
-- No crea TTL/purga ni elimina bajas; retención operativa pendiente de coordinación.
CREATE TABLE IF NOT EXISTS public.agent_whatsapp_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL UNIQUE CHECK (event_key ~ '^agente-entrada-v1:[a-f0-9]{64}$'),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_hash text NOT NULL CHECK (contact_hash ~ '^[a-f0-9]{64}$'),
  message_hash text NOT NULL CHECK (message_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'procesando' CHECK (status IN ('procesando','procesado','limitado','fallido'))
);
CREATE INDEX IF NOT EXISTS agent_whatsapp_events_contact_idx
  ON public.agent_whatsapp_events (tenant_id, contact_hash, id DESC);
ALTER TABLE public.agent_whatsapp_events ENABLE ROW LEVEL SECURITY;
-- Sin políticas para el navegador; solamente servidor service_role.
REVOKE ALL ON public.agent_whatsapp_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.agent_whatsapp_events_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_whatsapp_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.agent_whatsapp_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.agent_claim_whatsapp_event(
  p_event_key text, p_tenant_id uuid, p_contact_hash text,
  p_message_hash text, p_received_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  v_id bigint;
  v_history jsonb;
  v_consecutive integer := 0;
  v_message text;
BEGIN
  IF p_tenant_id IS NULL OR p_received_at IS NULL OR NOT isfinite(p_received_at)
    OR p_event_key IS NULL OR p_event_key !~ '^agente-entrada-v1:[a-f0-9]{64}$'
    OR p_contact_hash IS NULL OR p_contact_hash !~ '^[a-f0-9]{64}$'
    OR p_message_hash IS NULL OR p_message_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Evento inválido';
  END IF;
  -- Serializa admisión/historial del contacto. Colisiones del lock solo serializan más.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_contact_hash, 0));
  IF EXISTS (SELECT 1 FROM public.agent_whatsapp_events
    WHERE tenant_id = p_tenant_id AND event_key = p_event_key) THEN
    RETURN jsonb_build_object('repetido', true, 'historial', '[]'::jsonb, 'consecutivos', 0);
  END IF;
  -- Diez anteriores bastan para el límite 10/h; incluye también eventos limitados.
  -- LEAST evita que el orden de llegada de dos relojes de aplicación oculte el anterior.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'tenantId', p_tenant_id::text, 'contactHash', p_contact_hash,
    'messageHash', x.message_hash,
    'atMs', floor(extract(epoch FROM least(x.received_at, p_received_at)) * 1000)::bigint
  )), '[]'::jsonb) INTO v_history FROM (
    SELECT message_hash, received_at FROM public.agent_whatsapp_events
    WHERE tenant_id = p_tenant_id AND contact_hash = p_contact_hash
      AND received_at > p_received_at - interval '1 hour'
    ORDER BY id DESC LIMIT 10
  ) x;
  -- Las dos inmediatamente anteriores, no dos coincidencias dentro de una ventana.
  FOR v_message IN SELECT message_hash FROM public.agent_whatsapp_events
    WHERE tenant_id = p_tenant_id AND contact_hash = p_contact_hash ORDER BY id DESC LIMIT 2
  LOOP
    EXIT WHEN v_message <> p_message_hash;
    v_consecutive := v_consecutive + 1;
  END LOOP;
  INSERT INTO public.agent_whatsapp_events(event_key, tenant_id, contact_hash, message_hash, received_at)
    VALUES (p_event_key, p_tenant_id, p_contact_hash, p_message_hash, p_received_at)
    ON CONFLICT (event_key) DO NOTHING RETURNING id INTO v_id;
  RETURN jsonb_build_object('repetido', v_id IS NULL, 'historial', v_history, 'consecutivos', v_consecutive);
END;
$$;
REVOKE ALL ON FUNCTION public.agent_claim_whatsapp_event(text,uuid,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_claim_whatsapp_event(text,uuid,text,text,timestamptz) TO service_role;
-- HECHO: no ejecutado por Codex. IF NOT EXISTS repite el mismo esquema;
-- no repara una tabla previa distinta. Revisar concurrencia multisession y RLS en pruebas.
-- Un evento reclamado no se reenvía aunque quede procesando/fallido: conciliación manual.
