import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const MAX = 12000;
const FORMATO = /[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁠-⁯﻿]/;
const falta = (e: any) => !!e && ["42P01", "PGRST205"].includes(e.code);

async function contexto(req: NextRequest) {
  const g = await isManagerLevel();
  if (!g.ok || g.role === "receptionist") return { error: NextResponse.json({ error: "Solo administración" }, { status: 403 }) };
  const { tenantId, denied } = await resolveTenantForRequest(req.nextUrl.searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return { error: NextResponse.json({ error: "Negocio no válido" }, { status: 400 }) };
  return { tenantId };
}

// Contexto del negocio para el modo Avanzado (IA). Guardarlo no enciende respuestas con IA.
export async function GET(req: NextRequest) {
  const c = await contexto(req); if ("error" in c) return c.error;
  const r = await createAdminSupabase().from("agent_ai_context").select("contexto,ia_activa,updated_at").eq("tenant_id", c.tenantId).maybeSingle();
  if (r.error) return falta(r.error) ? NextResponse.json({ error: "Falta aplicar la migración 012" }, { status: 409 }) : NextResponse.json({ error: "No se pudo leer" }, { status: 500 });
  return NextResponse.json({ contexto: r.data?.contexto ?? "", iaActiva: r.data?.ia_activa === true, actualizado: r.data?.updated_at ?? null });
}

export async function PUT(req: NextRequest) {
  const c = await contexto(req); if ("error" in c) return c.error;
  const body = await req.json().catch(() => null);
  const texto = typeof body?.contexto === "string" ? body.contexto.replace(/\r\n/g, "\n").trim() : null;
  if (texto === null) return NextResponse.json({ error: "Contexto no válido" }, { status: 400 });
  if (texto.length > MAX) return NextResponse.json({ error: `El contexto puede tener hasta ${MAX} letras (tiene ${texto.length})` }, { status: 400 });
  if (FORMATO.test(texto)) return NextResponse.json({ error: "Hay caracteres no permitidos" }, { status: 400 });
  const r = await createAdminSupabase().from("agent_ai_context").upsert({ tenant_id: c.tenantId, contexto: texto, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (r.error) return falta(r.error) ? NextResponse.json({ error: "Falta aplicar la migración 012" }, { status: 409 }) : NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
