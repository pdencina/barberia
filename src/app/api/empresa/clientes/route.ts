import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { badRequest, cleanText, dbErrorResponse, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUMNS = "id, name, tax_id, contact_name, phone, email, address, city, customer_type, active";

export async function GET() {
  const g = await requireCompany("clientes.ver");
  if (!g.ok) return g.response;
  const admin = createAdminSupabase();
  try {
    const rows = await fetchAllRows(() => admin.from("company_customers").select(COLUMNS).eq("tenant_id", g.tenantId).order("name"));
    return NextResponse.json({ customers: rows });
  } catch (e: any) {
    return dbErrorResponse(e, "clientes GET");
  }
}

export async function POST(req: Request) {
  const g = await requireCompany("clientes.editar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const name = cleanText(body?.name, 200);
  if (!name) return badRequest("Escribe el nombre del cliente.");
  const { data, error } = await createAdminSupabase().from("company_customers").insert({
    tenant_id: g.tenantId,
    name,
    tax_id: cleanText(body?.taxId, 20),
    contact_name: cleanText(body?.contactName, 200),
    phone: cleanText(body?.phone, 40),
    email: cleanText(body?.email, 200),
    address: cleanText(body?.address, 300),
    city: cleanText(body?.city, 100),
    customer_type: body?.customerType === "distributor" ? "distributor" : "client",
  }).select(COLUMNS).single();
  if (error) return dbErrorResponse(error, "clientes POST");
  return NextResponse.json({ customer: data }, { status: 201 });
}
