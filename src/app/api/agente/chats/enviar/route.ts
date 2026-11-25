import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { contextoChats, MARCA_MANUAL, VENTANA_RESPUESTA_MS } from "@/lib/agente/chats-acceso";
import { enviarTexto, normalizarTelefonoWhatsApp } from "@/lib/agente/whatsapp-meta";
import { registrarChat } from "@/lib/agente/chats";

// Mensaje manual del dueño a un cliente desde el panel. Solo si el cliente escribió en las últimas 24 h (regla de Meta).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = await contextoChats(req); if ("error" in c) return c.error;
  const body = await req.json().catch(() => null);
  const contacto = typeof body?.contacto === "string" ? body.contacto : "";
  const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
  if (!/^[a-f0-9]{16,128}$/.test(contacto)) return NextResponse.json({ error: "Conversación no válida" }, { status: 400 });
  if (!texto || texto.length > 1000) return NextResponse.json({ error: "Escribe un mensaje de hasta 1.000 caracteres" }, { status: 400 });
  const db = createAdminSupabase();
  const ult = await db.from("agent_chats").select("telefono,created_at").eq("tenant_id", c.tenantId).eq("contact_hash", contacto).eq("direccion", "entrante").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (ult.error || !ult.data?.telefono) return NextResponse.json({ error: "No encuentro el número de esta conversación" }, { status: 404 });
  if (Date.now() - new Date(ult.data.created_at).getTime() > VENTANA_RESPUESTA_MS) return NextResponse.json({ error: "Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp no deja escribirle libremente; espera a que escriba o llámalo." }, { status: 409 });
  const para = normalizarTelefonoWhatsApp(`+${String(ult.data.telefono).replace(/\D/g, "")}`);
  if (!para) return NextResponse.json({ error: "Número no válido" }, { status: 400 });
  const aj = await db.from("agent_whatsapp_settings").select("phone_number_id").eq("tenant_id", c.tenantId).maybeSingle();
  if (aj.error || !aj.data?.phone_number_id) return NextResponse.json({ error: "El negocio no tiene WhatsApp conectado" }, { status: 409 });
  const r = await enviarTexto({ para, texto }, { fetch: (u, o) => fetch(u, o) as any, token: process.env.WHATSAPP_ACCESS_TOKEN ?? "", version: process.env.WHATSAPP_API_VERSION ?? "", phone_number_id: String(aj.data.phone_number_id) });
  if (r.estado !== "aceptado") return NextResponse.json({ error: "WhatsApp no aceptó el mensaje. Intenta de nuevo." }, { status: 502 });
  await registrarChat(db, { tenantId: c.tenantId, contactHash: contacto, telefono: para, direccion: "saliente", tipo: "texto", texto: MARCA_MANUAL + texto });
  return NextResponse.json({ ok: true });
}
