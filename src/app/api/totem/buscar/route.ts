import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { saldoCita } from "@/lib/totem-pago";
import { citasYaCobradas } from "@/lib/totem-citas";
import { negocioDelTotem, normalizarCodigo, celular9, hoyChile, soloDiaDelTotem, primerNombre, demasiadosIntentos, ipDe } from "@/lib/totem";

// POST {codigo, code?, phone?, modo?}: citas de HOY de ese negocio que calzan con el codigo corto (o, de respaldo, el celular).
// Para pagar (modo "pagar") también entran las citas de hoy ya completadas que NO tienen cobro.
// Solo devuelve primer nombre, hora, servicio y profesional: nunca telefono ni correo.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`buscar:${ipDe(req)}`, 25)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Totem no disponible" }, { status: 404 });

  const code = normalizarCodigo(body.code);
  const phone = celular9(body.phone);
  if (code.length !== 5 && !phone) return NextResponse.json({ error: "Ingresa tu código de 5 letras o tu celular" }, { status: 400 });

  const sel = "id, client_id, date, start_time, status, checkin_code, arrived_at, barber_id, client:clients(name), barber:profiles!barber_id(name), appointment_services(services(name))";
  const paraPagar = body.modo === "pagar";
  let q: any = soloDiaDelTotem(supabase.from("appointments").select(sel).eq("tenant_id", t.id)).in("status", ["scheduled", "confirmed", "in_progress", ...(paraPagar ? ["completed"] : [])]);
  if (code.length === 5) {
    q = q.eq("checkin_code", code);
  } else {
    const { data: cls } = await supabase.from("clients").select("id").eq("tenant_id", t.id).ilike("phone", `%${phone}`).limit(5);
    const ids = (cls || []).map((c: any) => c.id);
    if (ids.length === 0) return NextResponse.json({ citas: [] });
    q = q.in("client_id", ids);
  }
  const { data } = await q.order("date").order("start_time").limit(5);

  // Completadas: solo las de hoy que todavía no se han cobrado.
  const completadas = (data || []).filter((a: any) => a.status === "completed");
  const cobradas = completadas.length ? await citasYaCobradas(supabase, t.id, completadas) : new Set<string>();
  const visibles = (data || []).filter((a: any) => a.status !== "completed" || (a.date === hoyChile() && !cobradas.has(a.id)));

  // Lo que falta pagar de cada cita (para ofrecer pagar varias juntas). Siempre calculado en el servidor.
  const saldos = new Map<string, number>();
  const promos = new Map<string, { codigo: string; descuento: number; pagos: string[] }>();
  for (const a of visibles) {
    const s = await saldoCita(supabase, (a as any).id);
    saldos.set((a as any).id, s?.saldo || 0);
    if (s?.promo) promos.set((a as any).id, { ...s.promo, descuento: s.descuento });
  }

  const citas = visibles.filter((a: any) => a.status !== "completed" || (saldos.get(a.id) || 0) > 0).map((a: any) => ({
    id: a.id,
    saldo: saldos.get(a.id) || 0,
    promo: promos.get(a.id) || null,
    barberId: a.barber_id || null,
    fecha: a.date === hoyChile() ? null : a.date,
    hora: String(a.start_time || "").slice(11, 16), // hora de Chile escrita como UTC
    servicio: (a.appointment_services || []).map((x: any) => x.services?.name).filter(Boolean).join(" + ") || "Tu cita",
    profesional: a.barber?.name || "",
    cliente: primerNombre(a.client?.name),
    llego: !!a.arrived_at,
    completada: a.status === "completed",
    // el codigo solo se devuelve si el cliente lo escribio (se usa para confirmar "Llegué")
    code: code.length === 5 ? a.checkin_code : null,
  }));
  return NextResponse.json({ citas, yaPagada: citas.length === 0 && cobradas.size > 0 });
}
