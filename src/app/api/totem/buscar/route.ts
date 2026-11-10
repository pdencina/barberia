import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, celular9, hoyChile, primerNombre, demasiadosIntentos, ipDe } from "@/lib/totem";

// POST {slug, code?, phone?}: citas de HOY de ese negocio que calzan con el codigo corto (o, de respaldo, el celular).
// Solo devuelve primer nombre, hora, servicio y profesional: nunca telefono ni correo.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`buscar:${ipDe(req)}`, 25)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.slug);
  if (!t) return NextResponse.json({ error: "Totem no disponible" }, { status: 404 });

  const code = normalizarCodigo(body.code);
  const phone = celular9(body.phone);
  if (code.length !== 5 && !phone) return NextResponse.json({ error: "Ingresa tu código de 5 letras o tu celular" }, { status: 400 });

  const sel = "id, start_time, status, checkin_code, arrived_at, barber_id, client:clients(name), barber:profiles!barber_id(name), appointment_services(services(name))";
  let q: any = supabase.from("appointments").select(sel).eq("tenant_id", t.id).eq("date", hoyChile()).in("status", ["scheduled", "confirmed", "in_progress"]);
  if (code.length === 5) {
    q = q.eq("checkin_code", code);
  } else {
    const { data: cls } = await supabase.from("clients").select("id").eq("tenant_id", t.id).ilike("phone", `%${phone}`).limit(5);
    const ids = (cls || []).map((c: any) => c.id);
    if (ids.length === 0) return NextResponse.json({ citas: [] });
    q = q.in("client_id", ids);
  }
  const { data } = await q.order("start_time").limit(5);

  const citas = (data || []).map((a: any) => ({
    id: a.id,
    hora: String(a.start_time || "").slice(11, 16), // hora de Chile escrita como UTC
    servicio: (a.appointment_services || []).map((x: any) => x.services?.name).filter(Boolean).join(" + ") || "Tu cita",
    profesional: a.barber?.name || "",
    cliente: primerNombre(a.client?.name),
    llego: !!a.arrived_at,
    // el codigo solo se devuelve si el cliente lo escribio (se usa para confirmar "Llegué")
    code: code.length === 5 ? a.checkin_code : null,
  }));
  return NextResponse.json({ citas });
}
