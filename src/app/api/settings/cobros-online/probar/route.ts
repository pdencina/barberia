import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireTenantRole } from "@/lib/supabase/server";
import { cargarCredencialAbono } from "@/lib/deposit";
import { resumirCuenta } from "@/lib/mp-diagnostico";

export const dynamic = "force-dynamic";

// «Probar cobro online»: le pregunta a Mercado Pago, con la cuenta del negocio, si puede recibir pagos y si acepta crear un link de pago.
// Solo administrador; el token nunca se devuelve (solo un resumen). No cobra nada.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const guard = await requireTenantRole(["admin", "super_admin"], body.tenantId);
  if (!guard.ok) return guard.response;
  const sb = createAdminSupabase();
  const cred = await cargarCredencialAbono(sb, guard.tenantId);
  if (!cred.token) return NextResponse.json({ ok: false, error: "Este negocio no tiene una cuenta de Mercado Pago conectada." }, { status: 400 });

  const h = { Authorization: `Bearer ${cred.token}`, "Content-Type": "application/json" };
  let cuentaRes: any = null;
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", { headers: h, cache: "no-store" });
    if (!r.ok) return NextResponse.json({ ok: false, origen: cred.origen, error: `Mercado Pago no aceptó el token (código ${r.status}). Hay que conectar uno nuevo.` });
    cuentaRes = await r.json();
  } catch { return NextResponse.json({ ok: false, error: "No pude comunicarme con Mercado Pago. Intenta de nuevo." }, { status: 502 }); }
  const resumen = resumirCuenta(cred.token, cuentaRes);

  // Un link de pago de $1.000 de prueba (no se cobra nada; solo se ve si Mercado Pago lo acepta).
  let preferencia: { ok: boolean; detalle?: string } = { ok: false };
  try {
    const p = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: h, body: JSON.stringify({ items: [{ title: "Prueba de conexión re-booking", quantity: 1, currency_id: "CLP", unit_price: 1000 }], expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: new Date(Date.now() + 10 * 60 * 1000).toISOString() }) });
    const d: any = await p.json().catch(() => ({}));
    preferencia = p.ok ? { ok: true } : { ok: false, detalle: String(d?.message || d?.error || `código ${p.status}`).slice(0, 300) + (Array.isArray(d?.cause) && d.cause.length ? ` (${d.cause.map((c: any) => c?.description || c?.code).filter(Boolean).join("; ").slice(0, 200)})` : "") };
  } catch { preferencia = { ok: false, detalle: "No pude comunicarme con Mercado Pago" }; }

  return NextResponse.json({
    ok: preferencia.ok && resumen.problemas.length === 0, origen: cred.origen,
    cuenta: { nombre: cuentaRes?.nickname || null, tipo: resumen.tipoCuenta, pais: resumen.pais, puedeVender: resumen.puedeVender, token: resumen.tokenTipo },
    problemas: resumen.problemas, linkDePago: preferencia,
  });
}
