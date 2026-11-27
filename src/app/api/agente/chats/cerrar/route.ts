import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { contextoChats } from "@/lib/agente/chats-acceso";
import { MARCA_CERRADO } from "@/lib/agente/resumen";

// «Cerrar caso»: la conversación deja de esperar a una persona. No se le envía nada al cliente.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = await contextoChats(req); if ("error" in c) return c.error;
  const body = await req.json().catch(() => null);
  const contacto = typeof body?.contacto === "string" ? body.contacto : "";
  if (!/^[a-f0-9]{16,128}$/.test(contacto)) return NextResponse.json({ error: "Conversación no válida" }, { status: 400 });
  const db = createAdminSupabase();
  const ult = await db.from("agent_chats").select("telefono").eq("tenant_id", c.tenantId).eq("contact_hash", contacto).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (ult.error || !ult.data) return NextResponse.json({ error: "No encuentro esa conversación" }, { status: 404 });
  const q = await db.from("agent_consultas").delete().eq("tenant_id", c.tenantId).eq("contact_hash", contacto);
  const m = await db.from("agent_chats").insert({ tenant_id: c.tenantId, contact_hash: contacto, telefono: ult.data.telefono, direccion: "saliente", tipo: "otro", texto: MARCA_CERRADO });
  if (q.error || m.error) return NextResponse.json({ error: "No se pudo cerrar el caso" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
