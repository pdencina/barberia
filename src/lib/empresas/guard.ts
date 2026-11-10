import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { capabilitiesFor, roleCan, type Capability, type CompanyRole } from "@/lib/empresas/capabilities";
import { isEmpresasEnabled } from "@/lib/empresas/flag";

export type CompanyContext = {
  userId: string;
  tenantId: string;
  tenantName: string;
  role: CompanyRole;
  capabilities: readonly Capability[];
};

export type CompanyLookup =
  | { state: "off" | "anon" | "not_member" | "suspended" | "missing_migration" | "error" }
  | { state: "ok"; context: CompanyContext };

const faltaMigracion = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));

// Sesión validada contra Supabase Auth (sin getSession ni memoria) + empresa + membresía activa, leídos siempre del servidor.
// El negocio sale del perfil del usuario: nunca del navegador.
export async function loadCompanyContext(): Promise<CompanyLookup> {
  if (!isEmpresasEnabled()) return { state: "off" };
  try {
    const { data: { user } } = await createServerSupabase().auth.getUser();
    if (!user) return { state: "anon" };

    const admin = createAdminSupabase();
    const { data: profile, error: profileError } = await admin.from("profiles").select("tenant_id, active").eq("id", user.id).maybeSingle();
    if (profileError) return { state: "error" };
    if (!profile?.tenant_id || profile.active === false) return { state: "not_member" };

    const { data: tenant, error: tenantError } = await admin.from("tenants").select("name, kind, status").eq("id", profile.tenant_id).maybeSingle();
    if (faltaMigracion(tenantError)) return { state: "missing_migration" };
    if (tenantError) return { state: "error" };
    if (tenant?.kind !== "company") return { state: "not_member" };

    const { data: member, error: memberError } = await admin.from("company_members").select("role_key")
      .eq("tenant_id", profile.tenant_id).eq("user_id", user.id).eq("active", true).maybeSingle();
    if (faltaMigracion(memberError)) return { state: "missing_migration" };
    if (memberError) return { state: "error" };
    if (!member) return { state: "not_member" };
    if (tenant.status === "suspended") return { state: "suspended" };

    return {
      state: "ok",
      context: {
        userId: user.id,
        tenantId: profile.tenant_id,
        tenantName: tenant.name,
        role: member.role_key as CompanyRole,
        capabilities: capabilitiesFor(member.role_key),
      },
    };
  } catch {
    return { state: "error" };
  }
}

const json = (error: string, status: number, code?: string) => NextResponse.json({ error, ...(code ? { code } : {}) }, { status });

export async function requireCompany(capability?: Capability): Promise<{ ok: false; response: NextResponse } | ({ ok: true } & CompanyContext)> {
  const found = await loadCompanyContext();
  switch (found.state) {
    case "off": return { ok: false, response: json("No encontrado", 404) };
    case "anon": return { ok: false, response: json("No autenticado", 401) };
    case "not_member": return { ok: false, response: json("No autorizado", 403) };
    case "suspended": return { ok: false, response: json("La cuenta de la empresa está suspendida.", 402, "tenant_suspended") };
    case "missing_migration": return { ok: false, response: json("Falta aplicar la migración 153.", 503) };
    case "error": return { ok: false, response: json("Error interno", 500) };
  }
  if (capability && !roleCan(found.context.role, capability)) {
    return { ok: false, response: json("No autorizado", 403) };
  }
  return { ok: true, ...found.context };
}
