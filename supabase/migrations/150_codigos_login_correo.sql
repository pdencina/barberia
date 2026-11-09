-- 150: Entrar con código de 6 dígitos enviado al correo (alternativa a la clave).
-- Aditiva y re-ejecutable. Solo la usa el servidor (service role); sin políticas = nadie más puede leerla.
CREATE TABLE IF NOT EXISTS public.login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_codes_email_created_idx ON public.login_codes (lower(email), created_at DESC);
ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;

-- Verificación: debe devolver 1 fila con rls = true
SELECT relname, relrowsecurity AS rls FROM pg_class WHERE relname = 'login_codes';
