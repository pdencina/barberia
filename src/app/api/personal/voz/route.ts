import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";
import { entenderMovimientoPersonal } from "@/lib/oti/personal";
import { huellaLlave, llaveDeEncabezado } from "@/lib/voice-key";

export const dynamic = "force-dynamic";

// Atajo de iPhone: recibe el texto dictado y lo anota como gasto/ingreso PERSONAL de quien es dueño de la llave.
// Auth: "Authorization: Bearer rbk_..." (no usa sesion). Solo puede anotar movimientos personales de esa persona; nada del negocio.
// Dos pasos: sin "confirmar" solo entiende y pregunta; con "confirmar": true guarda.
const MAX_POR_MINUTO = 20;
const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const msj = (mensaje: string, extra: Record<string, unknown> = {}, status = 200) => NextResponse.json({ mensaje, ...extra }, { status });

export async function POST(req: NextRequest) {
  const huella = huellaLlave(llaveDeEncabezado(req.headers.get("authorization")));
  if (!huella) return msj("Llave no válida. Genera una nueva en Mi Billetera.", { ok: false }, 401);
  const supabase = createAdminSupabase();
  const { data: k, error: ke } = await supabase.from("personal_voice_keys").select("id, user_id").eq("key_hash", huella).is("revoked_at", null).maybeSingle();
  if (ke) return msj("Falta aplicar la actualización de base de datos (migración 125).", { ok: false }, 409);
  if (!k) return msj("Llave no válida o revocada. Genera una nueva en Mi Billetera.", { ok: false }, 401);

  // El usuario tiene que seguir existiendo, activo y no ser cliente.
  const { data: p } = await supabase.from("profiles").select("id, role, tenant_id, active").eq("id", k.user_id).maybeSingle();
  if (!p || p.role === "client" || p.active === false) return msj("Tu cuenta no puede usar esta función.", { ok: false }, 403);

  const body = await req.json().catch(() => ({}));
  const texto = typeof body?.texto === "string" ? body.texto.trim().slice(0, 300) : "";
  if (!texto) return msj("No escuché nada. Intenta de nuevo.", { ok: false });
  const hoy = todayInChile();
  const r = entenderMovimientoPersonal(texto, hoy);
  if (!r) return msj("No entendí. Prueba: «compré pan, me salió $1.500».", { ok: false });
  if (!r.ok) return msj("Entendí que es un gasto o ingreso, pero no escuché el monto. Dilo de nuevo con el monto.", { ok: false });
  const m = r.movimiento;
  const resumen = `${m.tipo === "gasto" ? "Gasto" : "Ingreso"} de ${fmt(m.monto)} en ${m.categoria} («${m.descripcion}»)`;
  if (body?.confirmar !== true) return msj(`${resumen}. ¿Lo anoto?`, { ok: true, guardado: false });

  // Tope por minuto, contra bucles o llaves filtradas.
  const hace = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase.from("personal_entries").select("id", { count: "exact", head: true }).eq("user_id", k.user_id).eq("source", "voz").gte("created_at", hace);
  if ((count || 0) >= MAX_POR_MINUTO) return msj("Demasiados movimientos seguidos. Espera un minuto.", { ok: false }, 429);

  const { error } = await supabase.from("personal_entries").insert({
    user_id: k.user_id, tenant_id: p.tenant_id || null, kind: m.tipo === "gasto" ? "expense" : "income",
    amount: m.monto, description: m.descripcion, category: m.categoria, entry_date: m.fecha, source: "voz",
  });
  if (error) return msj(/source_check|violates check/i.test(error.message) ? "Falta aplicar la migración 125." : "No pude guardarlo. Intenta de nuevo.", { ok: false }, 500);
  await supabase.from("personal_voice_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);
  return msj(`Anotado: ${resumen}.`, { ok: true, guardado: true });
}
