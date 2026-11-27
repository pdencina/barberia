import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";
import { purgarChats, olvidarFlagChats, DIAS_CONSERVAR_CHATS } from "@/lib/agente/chats";
import { formatPhoneCL } from "@/lib/phone";
import { etiquetasDe, resumirDia, type MensajeResumen } from "@/lib/agente/resumen";
import { consultasAbiertas, saludDelDia } from "@/lib/agente/resumen-datos";
import { ahoraChile } from "@/lib/agente/disponibilidad";

// Conversaciones del agente de WhatsApp para el dueño. Solo administración; siempre del negocio de la sesión.
export const dynamic = "force-dynamic";
const falta = (e: any) => !!e && ["42P01", "42703", "PGRST205", "PGRST204"].includes(e.code);

async function contexto(req: NextRequest) {
  const g = await isManagerLevel();
  if (!g.ok || g.role === "receptionist") return { error: NextResponse.json({ error: "Solo administración" }, { status: 403 }) };
  const { tenantId, denied } = await resolveTenantForRequest(req.nextUrl.searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return { error: NextResponse.json({ error: "Negocio no válido" }, { status: 400 }) };
  return { tenantId };
}

export async function GET(req: NextRequest) {
  const c = await contexto(req); if ("error" in c) return c.error;
  const db = createAdminSupabase();
  await purgarChats(db);
  const ajustes = await db.from("agent_whatsapp_settings").select("registrar_chats").eq("tenant_id", c.tenantId).maybeSingle();
  if (ajustes.error && falta(ajustes.error)) return NextResponse.json({ error: "Falta aplicar la migración 020" }, { status: 409 });
  const registrando = ajustes.data?.registrar_chats === true;
  const contacto = req.nextUrl.searchParams.get("contacto");
  if (contacto) {
    if (!/^[a-f0-9]{16,128}$/.test(contacto)) return NextResponse.json({ error: "Conversación no válida" }, { status: 400 });
    const r = await db.from("agent_chats").select("id,direccion,tipo,texto,created_at,telefono").eq("tenant_id", c.tenantId).eq("contact_hash", contacto).order("created_at", { ascending: false }).limit(300);
    if (r.error) return falta(r.error) ? NextResponse.json({ error: "Falta aplicar la migración 020" }, { status: 409 }) : NextResponse.json({ error: "No se pudo leer" }, { status: 500 });
    return NextResponse.json({ registrando, dias: DIAS_CONSERVAR_CHATS, mensajes: (r.data ?? []).reverse() });
  }
  const r = await db.from("agent_chats").select("contact_hash,telefono,direccion,tipo,texto,created_at").eq("tenant_id", c.tenantId).order("created_at", { ascending: false }).limit(2000);
  if (r.error) return falta(r.error) ? NextResponse.json({ error: "Falta aplicar la migración 020" }, { status: 409 }) : NextResponse.json({ error: "No se pudo leer" }, { status: 500 });
  const grupos = new Map<string, { contacto: string; telefono: string | null; ultimo: any; total: number; entrantes: number }>();
  for (const m of (r.data ?? []) as any[]) {
    const g = grupos.get(m.contact_hash) ?? { contacto: m.contact_hash, telefono: m.telefono ?? null, ultimo: m, total: 0, entrantes: 0 };
    g.total++; if (m.direccion === "entrante") g.entrantes++; if (!g.telefono && m.telefono) g.telefono = m.telefono;
    grupos.set(m.contact_hash, g);
  }
  const lista = Array.from(grupos.values()).slice(0, 100);
  // Resumen de hoy y etiquetas por conversación. El número del dueño no cuenta.
  const ahora = Date.now(), dia = ahoraChile(ahora).fecha;
  const admin = await db.from("agent_admin_contacts").select("telefono").eq("tenant_id", c.tenantId);
  const duenos = new Set(((admin.data ?? []) as any[]).map((x) => String(x.telefono)));
  const abiertas = await consultasAbiertas(db, c.tenantId, ahora);
  const porContacto = new Map<string, MensajeResumen[]>();
  for (const m of (r.data ?? []) as MensajeResumen[]) { const l = porContacto.get(m.contact_hash); if (l) l.push(m); else porContacto.set(m.contact_hash, [m]); }
  const deClientes = ((r.data ?? []) as any[]).filter((m) => !duenos.has(String(grupos.get(m.contact_hash)?.telefono)));
  let salud = null;
  try { salud = await saludDelDia(db, c.tenantId, ahora); } catch { /* la lista sale igual */ }
  const resumen = { ...resumirDia(deClientes, abiertas, ahora, dia), salud };
  // Nombre del cliente, si el número coincide con uno de la ficha de clientes del negocio.
  const nombres = new Map<string, string>();
  const variantes = Array.from(new Set(lista.flatMap((g) => g.telefono ? [g.telefono, `+${g.telefono}`, formatPhoneCL(g.telefono), g.telefono.replace(/^56/, "")] : [])));
  if (variantes.length) {
    const cl = await db.from("clients").select("name,phone").eq("tenant_id", c.tenantId).in("phone", variantes).limit(300);
    for (const x of (cl.data ?? []) as any[]) { const d = String(x.phone ?? "").replace(/\D/g, ""); nombres.set(d, x.name); nombres.set(d.replace(/^56/, ""), x.name); }
  }
  const conversaciones = lista.map((g) => ({ ...g, etiquetas: duenos.has(String(g.telefono)) ? [] : etiquetasDe(porContacto.get(g.contacto) ?? [], abiertas.has(g.contacto), ahora, dia), ultimo: { texto: String(g.ultimo.texto).slice(0, 140), direccion: g.ultimo.direccion, created_at: g.ultimo.created_at }, cliente: g.telefono ? (nombres.get(g.telefono) ?? nombres.get(g.telefono.replace(/^56/, "")) ?? null) : null }));
  return NextResponse.json({ registrando, dias: DIAS_CONSERVAR_CHATS, conversaciones, resumen });
}

// Enciende o apaga el guardado de conversaciones del negocio.
export async function PATCH(req: NextRequest) {
  const c = await contexto(req); if ("error" in c) return c.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.registrar !== "boolean") return NextResponse.json({ error: "Indica registrar: true o false" }, { status: 400 });
  const r = await createAdminSupabase().from("agent_whatsapp_settings").update({ registrar_chats: body.registrar }).eq("tenant_id", c.tenantId).select("tenant_id").maybeSingle();
  if (r.error) return falta(r.error) ? NextResponse.json({ error: "Falta aplicar la migración 020" }, { status: 409 }) : NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  if (!r.data) return NextResponse.json({ error: "El agente de WhatsApp no está activado en este negocio" }, { status: 404 });
  olvidarFlagChats(c.tenantId);
  return NextResponse.json({ registrando: body.registrar });
}
