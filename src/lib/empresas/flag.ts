// Interruptor de re-booking Empresas: apagado en producción salvo que se active a propósito con EMPRESAS_ENABLED=1.
export function isEmpresasEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EMPRESAS_ENABLED === "1" || env.VERCEL_ENV === "preview" || env.NODE_ENV === "development";
}
