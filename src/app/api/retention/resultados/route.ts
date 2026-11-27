import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";

export const dynamic = "force-dynamic";

// ¿Funcionó la campaña? Correos enviados con un cupón, reservas hechas con él, atendidas, canceladas y lo cobrado. Administración.
export async function GET(req: NextRequest) {
  const guard = await requireRole(["admin", "super_admin", "receptionist"]);
  if (!guard.ok) return guard.response;
  const sp = new URL(req.url).searchParams;
  const { tenantId } = await resolveTenantForRequest(sp.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ resultado: null });
  const sb = createAdminSupabase();
  try {
    let codigo = String(sp.get("cupon") || "").trim().toUpperCase().slice(0, 40);
    if (!codigo) {
      const { data } = await sb.from("retention_campaigns").select("coupon_code").eq("tenant_id", tenantId).not("coupon_code", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      codigo = (data as any)?.coupon_code || "";
    }
    if (!codigo) return NextResponse.json({ resultado: null });
    const { data: cupon } = await sb.from("coupons").select("id, code, max_uses, used_count").eq("tenant_id", tenantId).eq("code", codigo).maybeSingle();
    if (!cupon) return NextResponse.json({ resultado: null });

    const { data: campanas } = await sb.from("retention_campaigns").select("id, created_at, channel").eq("tenant_id", tenantId).eq("coupon_code", codigo);
    const ids = (campanas || []).map((c: any) => c.id);
    const desde = (campanas || []).map((c: any) => c.created_at).sort()[0] || null;
    // Destinatarios (una persona cuenta una vez)
    const recibio = new Set<string>();
    for (let i = 0; i < ids.length; i += 50) {
      const filas = await fetchAllRows<any>(() => sb.from("retention_campaign_recipients").select("id, client_id").eq("tenant_id", tenantId).eq("status", "sent").in("campaign_id", ids.slice(i, i + 50)));
      for (const r of filas) if (r.client_id) recibio.add(r.client_id);
    }
    const conCupon = await fetchAllRows<any>(() => sb.from("appointments").select("id, client_id, status").eq("tenant_id", tenantId).eq("coupon_id", (cupon as any).id));
    // Quienes recibieron la campaña y reservaron después, con o sin el cupón
    const despues = desde ? await fetchAllRows<any>(() => sb.from("appointments").select("id, client_id, status").eq("tenant_id", tenantId).gte("created_at", desde)) : [];
    const volvieron = new Set(despues.filter((a: any) => a.status !== "cancelled" && a.client_id && recibio.has(a.client_id)).map((a: any) => a.client_id));
    const ventas = await fetchAllRows<any>(() => sb.from("transactions").select("id, total, discount").eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").eq("coupon_id", (cupon as any).id));
    const vivas = conCupon.filter((a: any) => a.status !== "cancelled");
    return NextResponse.json({
      resultado: {
        cupon: codigo, desde, enviados: recibio.size,
        reservas: vivas.length,
        confirmadas: vivas.filter((a: any) => a.status === "confirmed").length,
        atendidas: vivas.filter((a: any) => a.status === "completed").length,
        canceladas: conCupon.length - vivas.length,
        volvieron: volvieron.size,
        ventas: ventas.length,
        cobrado: ventas.reduce((s: number, v: any) => s + (Number(v.total) || 0), 0),
        descuento: ventas.reduce((s: number, v: any) => s + (Number(v.discount) || 0), 0),
        maxUsos: (cupon as any).max_uses, usos: (cupon as any).used_count,
      },
    });
  } catch (e) {
    console.error("[resultados campaña]", e);
    return NextResponse.json({ error: "No se pudo calcular el resultado" }, { status: 500 });
  }
}
