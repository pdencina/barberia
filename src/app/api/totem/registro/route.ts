import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, celular9, primerNombre, demasiadosIntentos, ipDe } from "@/lib/totem";
import { notify } from "@/lib/notify";

// POST {codigo, name, phone, marketingConsent?}: cliente SIN hora que se registra en el totem. Se crea (o reutiliza) su ficha por celular
// y se avisa a recepcion/administracion para que lo reciban. No crea cita.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`registro:${ipDe(req)}`, 8)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Totem no disponible" }, { status: 404 });

  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = celular9(body.phone);
  if (name.length < 2) return NextResponse.json({ error: "Escribe tu nombre" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Escribe tu celular (9 dígitos, parte con 9)" }, { status: 400 });
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Escribe tu correo (ej. nombre@gmail.com)" }, { status: 400 });

  const { data: existente } = await supabase.from("clients").select("id, name, email").eq("tenant_id", t.id).ilike("phone", `%${phone}`).order("created_at").limit(1).maybeSingle();
  let nombreFicha = (existente as any)?.name || name;
  if (!existente) {
    const row: Record<string, any> = { name, phone: `+56${phone}`, email, tenant_id: t.id, acquisition_source: "walk_in" };
    const consent = { marketing_consent: body.marketingConsent === true, marketing_consent_at: new Date().toISOString() };
    let r: any = await supabase.from("clients").insert({ ...row, ...consent }).select("id").single();
    if (r.error && /marketing_consent/i.test(r.error.message)) r = await supabase.from("clients").insert(row).select("id").single();
    if (r.error) return NextResponse.json({ error: "No pudimos registrarte. Avisa a quien te atiende." }, { status: 500 });
  }

  // Cliente que ya existía sin correo: se lo completamos (nunca se pisa uno que ya tenía).
  if (existente && !(existente as any).email) await supabase.from("clients").update({ email }).eq("id", (existente as any).id);

  await notify({
    tenantId: t.id, kind: "client_arrived", roles: ["admin", "receptionist"],
    title: "Cliente sin hora en el tótem", body: `${primerNombre(nombreFicha)} llegó sin hora y se registró. Recíbelo y ofrécele una hora.`, url: "/dashboard/recepcion",
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
