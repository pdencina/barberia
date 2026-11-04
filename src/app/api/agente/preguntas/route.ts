import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";
import { MAX_LARGO_RESPUESTA } from "@/lib/agente/faq-extra";

export const dynamic = "force-dynamic";
const MAX_PREGUNTAS = 100;
const FORMATO = /[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁠-⁯﻿]/;
const falta = (e: any) => !!e && ["42P01", "PGRST205"].includes(e.code);

async function contexto(req: NextRequest) {
  const g = await isManagerLevel();
  if (!g.ok || g.role === "receptionist") return { error: NextResponse.json({ error: "Solo administración" }, { status: 403 }) };
  const { tenantId, denied } = await resolveTenantForRequest(req.nextUrl.searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return { error: NextResponse.json({ error: "Negocio no válido" }, { status: 400 }) };
  return { tenantId };
}
function limpiar(body: any) {
  const titulo = typeof body?.titulo === "string" ? body.titulo.trim() : "";
  const respuesta = typeof body?.respuesta === "string" ? body.respuesta.trim() : "";
  const claves = (Array.isArray(body?.claves) ? body.claves : typeof body?.claves === "string" ? body.claves.split(",") : [])
    .map((c: unknown) => (typeof c === "string" ? c.trim().toLowerCase() : "")).filter((c: string) => c.length >= 3 && c.length <= 60);
  const unicas = Array.from(new Set<string>(claves)).slice(0, 20);
  if (!titulo || titulo.length > 120) return { error: "Escribe un título (hasta 120 letras)" };
  if (unicas.length === 0) return { error: "Agrega al menos una palabra clave de 3 letras o más" };
  if (!respuesta || respuesta.length > MAX_LARGO_RESPUESTA) return { error: `La respuesta debe tener entre 1 y ${MAX_LARGO_RESPUESTA} letras` };
  if (FORMATO.test(titulo + respuesta)) return { error: "Hay caracteres no permitidos" };
  return { valor: { titulo, claves: unicas, respuesta, activo: body?.activo !== false } };
}

export async function GET(req: NextRequest) {
  const c = await contexto(req); if ("error" in c) return c.error;
  const r = await createAdminSupabase().from("agent_faq_custom").select("id,titulo,claves,respuesta,activo,orden").eq("tenant_id", c.tenantId).order("orden", { ascending: true }).order("created_at", { ascending: true }).limit(MAX_PREGUNTAS);
  if (r.error) return falta(r.error) ? NextResponse.json({ error: "Falta aplicar la migración 011" }, { status: 409 }) : NextResponse.json({ error: "No se pudo leer" }, { status: 500 });
  return NextResponse.json({ preguntas: r.data ?? [] });
}

export async function POST(req: NextRequest) {
  const c = await contexto(req); if ("error" in c) return c.error;
  const body = await req.json().catch(() => null);
  const v = limpiar(body); if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const db = createAdminSupabase();
  const n = await db.from("agent_faq_custom").select("id", { count: "exact", head: true }).eq("tenant_id", c.tenantId);
  if (n.error) return falta(n.error) ? NextResponse.json({ error: "Falta aplicar la migración 011" }, { status: 409 }) : NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  if ((n.count ?? 0) >= MAX_PREGUNTAS) return NextResponse.json({ error: `Máximo ${MAX_PREGUNTAS} preguntas` }, { status: 400 });
  const r = await db.from("agent_faq_custom").insert({ tenant_id: c.tenantId, ...v.valor, orden: n.count ?? 0 }).select("id").single();
  if (r.error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ id: r.data.id });
}

export async function PATCH(req: NextRequest) {
  const c = await contexto(req); if ("error" in c) return c.error;
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Pregunta no válida" }, { status: 400 });
  const v = limpiar(body); if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const r = await createAdminSupabase().from("agent_faq_custom").update({ ...v.valor, updated_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", c.tenantId).select("id");
  if (r.error || !r.data?.length) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const c = await contexto(req); if ("error" in c) return c.error;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Pregunta no válida" }, { status: 400 });
  const r = await createAdminSupabase().from("agent_faq_custom").delete().eq("id", id).eq("tenant_id", c.tenantId);
  if (r.error) return NextResponse.json({ error: "No se pudo borrar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
