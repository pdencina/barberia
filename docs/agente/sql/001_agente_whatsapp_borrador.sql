-- BORRADOR — NO EJECUTAR
-- Documento de diseño. No es una migración y no debe aplicarse en Supabase.
-- Aditivo y re-ejecutable: usa IF NOT EXISTS. Toda tabla incluye tenant_id y RLS activo.
-- DESCONOCIDO: plazo de retención. retention_until no tiene valor por defecto hasta que Nico decida.
-- INFERENCIA: referencias de contacto/proveedor como hashes; no guardar teléfono ni RUT en claro.
-- INFERENCIA: los campos de texto redactado son opcionales para soportar las opciones A/B de la especificación.

CREATE TABLE IF NOT EXISTS public.agent_business_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_mode TEXT CHECK (
    escalation_mode IS NULL OR escalation_mode IN (
      'human_chat',
      'phone',
      'email',
      'web_form'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('faq', 'policy', 'hours_note', 'service_note')),
  title TEXT NOT NULL,
  question TEXT,
  answer TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.agent_contact_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_ref_hash TEXT NOT NULL,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,
  retention_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, contact_ref_hash)
);

CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_ref_hash TEXT NOT NULL,
  external_thread_ref_hash TEXT,
  escalated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  provider_message_ref_hash TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing', 'system')),
  content_kind TEXT NOT NULL CHECK (content_kind IN ('text', 'image', 'audio', 'sticker', 'unknown')),
  incoming_text_redacted TEXT,
  outgoing_text_redacted TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('answered', 'escalated', 'rejected', 'duplicate', 'blocked')),
  retention_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_messages_conversation_tenant_fk
    FOREIGN KEY (conversation_id, tenant_id)
    REFERENCES public.agent_conversations(id, tenant_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS agent_knowledge_items_active_idx
  ON public.agent_knowledge_items (tenant_id, kind, active);
CREATE INDEX IF NOT EXISTS agent_contact_preferences_opt_out_idx
  ON public.agent_contact_preferences (tenant_id, do_not_contact);
CREATE INDEX IF NOT EXISTS agent_contact_preferences_retention_idx
  ON public.agent_contact_preferences (retention_until);
CREATE INDEX IF NOT EXISTS agent_conversations_retention_idx
  ON public.agent_conversations (retention_until);
CREATE INDEX IF NOT EXISTS agent_messages_created_idx
  ON public.agent_messages (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS agent_messages_retention_idx
  ON public.agent_messages (retention_until);
CREATE UNIQUE INDEX IF NOT EXISTS agent_messages_provider_ref_unique
  ON public.agent_messages (tenant_id, provider_message_ref_hash)
  WHERE provider_message_ref_hash IS NOT NULL;

ALTER TABLE public.agent_business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_contact_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- No se crean políticas para anon/authenticated en este borrador:
-- el acceso directo queda denegado mientras Claude define y revisa la vía de servidor.
-- Opción A: incoming_text_redacted y outgoing_text_redacted permanecen NULL.
-- Opción B: contienen solo texto redactado/recortado hasta retention_until.
-- No guardar: secretos/tokens, webhook crudo, binarios, RUT en claro ni datos de pago.
-- No se incluye tarea de borrado: depende del plazo y mecanismo que decida Nico.
