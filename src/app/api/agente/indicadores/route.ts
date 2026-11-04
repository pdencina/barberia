import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const CAMPOS = ["respuestas_automaticas", "consultas_disponibilidad", "ofertas_horas", "reservas_iniciadas", "reservas_cerradas", "derivadas_persona", "respuestas_ia"] as const;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const sumar = (mes: string, n: number) => { const [y, m] = mes.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

// Indicadores del agente de WhatsApp por mes: contadores diarios + citas cerradas por el chat.
export async function GET(req: NextRequest) {
  const guard = await isManagerLevel();
  if (!guard.ok) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { tenantId, denied } = await resolveTenantForRequest(req.nextUrl.searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return NextResponse.json({ error: "Negocio no válido" }, { status: 400 });
  const pedido = req.nextUrl.searchParams.get("mes") ?? "";
  const hoy = new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 7); // aprox. Chile; solo para el mes por defecto
  const mes = MES.test(pedido) ? pedido : hoy;
  const db = createAdminSupabase();
  async function periodo(m: string) {
    const [ind, citas] = await Promise.all([
      db.from("agent_whatsapp_indicadores").select("campo,total").eq("tenant_id", tenantId).gte("dia", `${m}-01`).lt("dia", `${sumar(m, 1)}-01`),
      db.from("appointments").select("id,status", { count: "exact" }).eq("tenant_id", tenantId).eq("source", "whatsapp_agente").gte("date", `${m}-01`).lt("date", `${sumar(m, 1)}-01`).limit(5000),
    ]);
    if (ind.error) throw new Error("migracion");
    const totales: Record<string, number> = Object.fromEntries(CAMPOS.map((c) => [c, 0]));
    for (const r of ind.data ?? []) if (r.campo in totales) totales[r.campo] += Number(r.total) || 0;
    const lista = citas.data ?? [];
    const completadas = lista.filter((c: any) => c.status === "completed").length;
    const canceladas = lista.filter((c: any) => c.status === "cancelled").length;
    const conversion = totales.ofertas_horas > 0 ? Math.round((totales.reservas_cerradas / totales.ofertas_horas) * 100) : null;
    return { mes: m, ...totales, citas_whatsapp: lista.length, citas_completadas: completadas, citas_canceladas: canceladas, conversion_pct: conversion };
  }
  try {
    const [actual, anterior] = await Promise.all([periodo(mes), periodo(sumar(mes, -1))]);
    return NextResponse.json({ actual, anterior });
  } catch {
    return NextResponse.json({ error: "Falta aplicar la migración 009 del agente" }, { status: 409 });
  }
}
