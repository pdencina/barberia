import { NextResponse } from "next/server";
import { createCompanyAccount, MIN_PASSWORD, rollbackAccount } from "@/lib/empresas/accounts";
import { badRequest, cleanText, dbErrorResponse, isEmail, isUuid, missingMigration, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Accesos al portal de distribuidores. Solo el dueño los ve y los crea.
export async function GET() {
  const g = await requireCompany("socios.gestionar");
  if (!g.ok) return g.response;
  const { data, error } = await createAdminSupabase().from("company_partner_users")
    .select("user_id, customer_id, active, created_at, customer:company_customers(name), profile:profiles!user_id(name, email)")
    .eq("tenant_id", g.tenantId).order("created_at", { ascending: false });
  if (error) return faltaMigracion(error) ? missingMigration(159) : dbErrorResponse(error, "socios GET");
  return NextResponse.json({
    partners: (data || []).map((x: any) => ({
      userId: x.user_id, customerId: x.customer_id, customerName: x.customer?.name, name: x.profile?.name, email: x.profile?.email, active: x.active,
    })),
  });
}

// Crea la cuenta del distribuidor, ligada a un cliente comercial de tipo distribuidor, con contraseña inicial.
export async function POST(req: Request) {
  const g = await requireCompany("socios.gestionar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const customerId = body?.customerId;
  const name = cleanText(body?.name, 120);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!isUuid(customerId)) return badRequest("Elige el distribuidor.");
  if (!name) return badRequest("Escribe el nombre de la persona.");
  if (!isEmail(email)) return badRequest("Escribe un correo válido.");
  if (password.length < MIN_PASSWORD || password.length > 72) return badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);

  const admin = createAdminSupabase();
  const { data: customer, error: cError } = await admin.from("company_customers").select("customer_type, active")
    .eq("tenant_id", g.tenantId).eq("id", customerId).maybeSingle();
  if (cError) return dbErrorResponse(cError, "socios POST cliente");
  if (!customer || !customer.active) return badRequest("Ese cliente no existe o está inactivo.");
  if (customer.customer_type !== "distributor") return badRequest("Solo los clientes de tipo Distribuidor pueden tener acceso al portal.");

  const created = await createCompanyAccount(admin, { tenantId: g.tenantId, email, name, password });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  const { error } = await admin.from("company_partner_users").insert({ tenant_id: g.tenantId, user_id: created.userId, customer_id: customerId, created_by: g.userId });
  if (error) {
    await rollbackAccount(admin, created.userId);
    return faltaMigracion(error) ? missingMigration(159) : dbErrorResponse(error, "socios POST");
  }
  return NextResponse.json({ partner: { userId: created.userId, customerId, name, email, active: true } }, { status: 201 });
}
