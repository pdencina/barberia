import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireTenantRole } from "@/lib/supabase/server";
import { encryptSecret, secretBoxReady } from "@/lib/secret-box";
import { cargarCredencialAbono } from "@/lib/deposit";

export const dynamic = "force-dynamic";

// Cuenta de Mercado Pago DEL NEGOCIO para cobrar abonos al reservar: el dinero llega a su cuenta, no a la de re-booking.
// Solo administrador, y el negocio sale de la sesion. El token se guarda CIFRADO y nunca se devuelve.
export async function GET(req: NextRequest) {
  const guard = await requireTenantRole(["admin", "super_admin"], new URL(req.url).searchParams.get("tenantId"));
  if (!guard.ok) return guard.response;
  const sb = createAdminSupabase();
  const { data, error } = await sb.from("tenant_settings").select("mp_online_account, mp_online_connected_at, mp_online_access_token").eq("tenant_id", guard.tenantId).maybeSingle();
  if (error) {
    const faltaMigracion = /column .* does not exist|schema cache/i.test(error.message);
    const cred = await cargarCredencialAbono(sb, guard.tenantId);
    return NextResponse.json({ conectado: !!cred.token, origen: cred.origen, cuenta: null, migrationMissing: faltaMigracion, cifradoListo: secretBoxReady() });
  }
  const cred = await cargarCredencialAbono(sb, guard.tenantId);
  return NextResponse.json({ conectado: !!cred.token, origen: cred.origen, cuenta: (data as any)?.mp_online_account || null, conectadoEl: (data as any)?.mp_online_connected_at || null, migrationMissing: false, cifradoListo: secretBoxReady() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const guard = await requireTenantRole(["admin", "super_admin"], body.tenantId);
  if (!guard.ok) return guard.response;
  const token = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!/^(APP_USR|TEST)-[A-Za-z0-9_-]{20,}$/.test(token)) return NextResponse.json({ error: "Ese no parece un Access Token de Mercado Pago (empieza con APP_USR-)." }, { status: 400 });
  // Se comprueba con Mercado Pago antes de guardarlo y se lee a que cuenta pertenece.
  let cuenta: string | null = null;
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: "Mercado Pago no aceptó ese token. Revisa que sea el Access Token de producción." }, { status: 400 });
    const u: any = await r.json();
    cuenta = String(u?.nickname || u?.email || u?.id || "").slice(0, 120) || null;
  } catch { return NextResponse.json({ error: "No pude comunicarme con Mercado Pago. Intenta de nuevo." }, { status: 502 }); }
  // El token se guarda cifrado: hace falta SECRET_BOX_KEY en el servidor (la misma que usa la integración con el SII).
  if (!secretBoxReady()) return NextResponse.json({ error: "Falta configurar la llave de cifrado del servidor (SECRET_BOX_KEY) para guardar el token de forma segura. Avísale a soporte." }, { status: 503 });
  const enc = encryptSecret(token);
  const sb = createAdminSupabase();
  const fila = { mp_online_access_token: enc, mp_online_account: cuenta, mp_online_connected_at: new Date().toISOString() };
  let { data: upd, error } = await sb.from("tenant_settings").update(fila).eq("tenant_id", guard.tenantId).select("tenant_id");
  if (!error && (!upd || upd.length === 0)) ({ error } = await sb.from("tenant_settings").insert({ tenant_id: guard.tenantId, ...fila }));
  if (error) return NextResponse.json({ error: /column .* does not exist|schema cache/i.test(error.message) ? "Falta aplicar la migración 131 en la base de datos." : "No se pudo guardar" }, { status: /column/.test(error.message) ? 409 : 500 });
  return NextResponse.json({ success: true, cuenta });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireTenantRole(["admin", "super_admin"], new URL(req.url).searchParams.get("tenantId"));
  if (!guard.ok) return guard.response;
  const { error } = await createAdminSupabase().from("tenant_settings").update({ mp_online_access_token: null, mp_online_account: null, mp_online_connected_at: null }).eq("tenant_id", guard.tenantId);
  if (error) return NextResponse.json({ error: "No se pudo desconectar" }, { status: 500 });
  return NextResponse.json({ success: true });
}
