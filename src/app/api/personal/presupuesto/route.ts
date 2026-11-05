import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Sueldo del mes (anotado a mano) y % de ahorro de Mi Billetera. Privado: cada persona ve y toca SOLO lo suyo
// (el user_id sale de la sesión, nunca del navegador). Tolera que falte la migración 137.
async function yo() {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId || !role || role === "client") return null;
  return { userId, tenantId: tenantId && tenantId !== "ALL" ? tenantId : null };
}
const faltaTabla = (m?: string) => /does not exist|schema cache|relation .* personal_budget/i.test(m || "");
const MES = /^\d{4}-\d{2}$/;
const mesDe = (v: string | null) => (v && MES.test(v) ? v : todayInChile().slice(0, 7));
const mesAnterior = (ym: string) => { const [y, m] = ym.split("-").map(Number); const t = y * 12 + (m - 2); return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };

// GET ?mes=YYYY-MM → { mes, salary, savings_pct, existe, sugerido: sueldo del mes anterior }
export async function GET(req: NextRequest) {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const mes = mesDe(new URL(req.url).searchParams.get("mes"));
  const sb = createAdminSupabase();
  const { data, error } = await sb.from("personal_budget").select("month, salary, savings_pct")
    .eq("user_id", u.userId).in("month", [`${mes}-01`, `${mesAnterior(mes)}-01`]);
  if (error) return NextResponse.json(faltaTabla(error.message) ? { migracionPendiente: true, mes, salary: 0, savings_pct: null, existe: false } : { error: "No pude leer tu sueldo" }, { status: faltaTabla(error.message) ? 200 : 500 });
  const este = (data || []).find((r: any) => String(r.month).startsWith(mes));
  const previo = (data || []).find((r: any) => String(r.month).startsWith(mesAnterior(mes)));
  return NextResponse.json({
    mes, existe: !!este, salary: este ? Number(este.salary) : 0, savings_pct: este ? Number(este.savings_pct) : null,
    sugerido: previo ? { salary: Number(previo.salary), savings_pct: Number(previo.savings_pct) } : null,
  });
}

// PUT { mes, salary, savings_pct }
export async function PUT(req: NextRequest) {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const mes = MES.test(b?.mes) ? b.mes : null;
  const salary = Number(b?.salary), pct = Number(b?.savings_pct);
  if (!mes) return NextResponse.json({ error: "Mes no válido" }, { status: 400 });
  if (!Number.isInteger(salary) || salary < 0 || salary > 1_000_000_000) return NextResponse.json({ error: "El sueldo debe ser un monto entero en pesos" }, { status: 400 });
  if (!(pct >= 0 && pct <= 100)) return NextResponse.json({ error: "El ahorro debe estar entre 0 % y 100 %" }, { status: 400 });
  if (mes > todayInChile().slice(0, 7)) return NextResponse.json({ error: "No puedes anotar el sueldo de un mes futuro" }, { status: 400 });
  const { error } = await createAdminSupabase().from("personal_budget")
    .upsert({ user_id: u.userId, tenant_id: u.tenantId, month: `${mes}-01`, salary, savings_pct: Math.round(pct * 100) / 100, updated_at: new Date().toISOString() }, { onConflict: "user_id,month" });
  if (error) return NextResponse.json({ error: faltaTabla(error.message) ? "Falta aplicar la migración 137 en la base de datos." : "No pude guardar tu sueldo" }, { status: faltaTabla(error.message) ? 409 : 500 });
  return NextResponse.json({ success: true });
}
