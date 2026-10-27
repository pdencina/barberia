import { createAdminSupabase, requireRole } from "@/lib/supabase/server";
import { crearManejadoresPreferenciasInforme } from "@/lib/agente/informe-preferencias";

export const dynamic = "force-dynamic";
// HECHO: requireRole valida sesión y rol (src/lib/supabase/server.ts:239-249).
// El manejador toma negocio y perfil de ese guard para admin; super_admin exige
// IDs explícitos y verifica la asociación en profiles antes de leer/escribir.
const handlers = crearManejadoresPreferenciasInforme({
  autorizar: () => requireRole(["admin", "super_admin"]),
  crearBase: createAdminSupabase,
});
export const GET = handlers.GET;
export const PUT = handlers.PUT;
