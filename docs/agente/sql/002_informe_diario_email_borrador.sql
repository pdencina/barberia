-- BORRADOR — NO EJECUTAR
-- Configuración por negocio para la fase 1: informe diario de citas por correo.
-- Aditivo y re-ejecutable. Nico ejecuta SQL manualmente solo después de revisión de Claude.

CREATE TABLE IF NOT EXISTS public.agent_daily_report_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  recipient_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agent_daily_report_settings ENABLE ROW LEVEL SECURITY;

-- Sin políticas para anon/authenticated: solo rutas de servidor revisadas acceden a esta tabla.
-- El código debe avisar "Falta aplicar la migración" si la tabla todavía no existe.
