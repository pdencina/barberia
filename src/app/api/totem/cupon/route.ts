import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, soloDiaDelTotem, demasiadosIntentos, ipDe } from "@/lib/totem";
import { citasYaCobradas } from "@/lib/totem-citas";
import { cuponDeCita } from "@/lib/cupon-cita";
import { horaDeCita, motivoCuponNoValido } from "@/lib/cupon-reglas";

// El teclado del tótem no tiene guion ni espacios: «BLACKFRIDAY» es lo mismo que «BLACK-FRIDAY».
const simple = (s: unknown) => String(s || "").normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 40);
const fallo = (error: string, status = 409) => NextResponse.json({ error }, { status });

// POST {codigo, code, appointmentIds, cupon, quitar?}: el cliente escribe su código de promoción en el tótem.
// Se revisan las mismas reglas que al reservar y queda anotado en la cita; el descuento y los medios de pago los aplica el servidor al cobrar.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`totemcupon:${ipDe(req)}`, 10)) return fallo("Muchos intentos. Espera un momento.", 429);
  const sb = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(sb, body.codigo);
  if (!t) return fallo("Tótem no disponible", 404);
  const code = normalizarCodigo(body.code);
  const ids = (Array.isArray(body.appointmentIds) ? body.appointmentIds : []).map(String).filter((x: string) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 5);
  const escrito = simple(body.cupon);
  if (code.length !== 5 || !ids.length || escrito.length < 3) return fallo("Escribe tu código de promoción", 400);

  const { data: citas, error } = await soloDiaDelTotem(sb.from("appointments")
    .select("id, client_id, date, start_time, status, barber_id, checkin_code, coupon_id, appointment_services(service_id)").eq("tenant_id", t.id).in("id", ids));
  if (error) return fallo("No pudimos revisar el código. Paga en caja; el equipo te ayuda.", 500);
  const mias = ((citas || []) as any[]).filter((a) => a.checkin_code === code && ["scheduled", "confirmed", "in_progress", "completed"].includes(a.status));
  if (!mias.length) return fallo("No encontramos tu cita", 404);

  const { data: cupones } = await sb.from("coupons").select("*").eq("tenant_id", t.id);
  const iguales = ((cupones || []) as any[]).filter((c) => simple(c.code) === escrito);
  const c = iguales.find((x) => x.active !== false) || iguales[0];
  if (!c) return fallo("Código no encontrado. Revísalo.", 404);

  const cobradas = await citasYaCobradas(sb, t.id, mias);
  const pendientes: any[] = [];
  for (const a of mias) {
    if (cobradas.has(a.id)) continue;
    const { data: p1 } = await sb.from("kiosk_payments").select("id").eq("appointment_id", a.id).eq("status", "paid").limit(1);
    const { data: p2 } = await sb.from("kiosk_payments").select("id").contains("appointment_ids", [a.id]).eq("status", "paid").limit(1);
    if (!p1?.length && !p2?.length) pendientes.push(a);
  }
  if (!pendientes.length) return fallo("Esta cita ya está pagada.");

  if (body.quitar === true) {
    for (const a of pendientes.filter((x) => x.coupon_id === c.id)) await sb.from("appointments").update({ coupon_id: null }).eq("id", a.id).eq("tenant_id", t.id);
    return NextResponse.json({ ok: true });
  }

  let aplicadas = 0, descuento = 0, motivo = "";
  for (const a of pendientes) {
    const total = Math.round(await sumaCita(sb, a.id));
    if (a.coupon_id) {
      const actual = await cuponDeCita(sb, a.id, total);
      if (actual) { // ya tiene un descuento vigente: no se reemplaza
        if (actual.couponId === c.id) { aplicadas++; descuento += actual.discount; } else motivo = `Tu cita ya tiene el código ${actual.code}.`;
        continue;
      }
    }
    if (Number(c.conditions?.personas) === 2) { motivo = "Esta promoción se reserva para 2 personas juntas en el link de la promoción. Consulta en caja."; continue; }
    const no = motivoCuponNoValido(c, { barberId: a.barber_id, fecha: a.date, hora: horaDeCita(a.start_time), serviceIds: (a.appointment_services || []).map((x: any) => x.service_id) });
    if (no) { motivo = no; continue; }
    const { error: eu } = await sb.from("appointments").update({ coupon_id: c.id }).eq("id", a.id).eq("tenant_id", t.id);
    if (eu) { motivo = "No pudimos aplicar el código. Paga en caja; el equipo te ayuda."; continue; }
    const r = await cuponDeCita(sb, a.id, total);
    if (!r || r.discount <= 0) { // sin descuento en plata: se deja como estaba
      await sb.from("appointments").update({ coupon_id: a.coupon_id }).eq("id", a.id).eq("tenant_id", t.id);
      motivo = "Ese código se canjea en caja; muéstraselo al equipo.";
      continue;
    }
    aplicadas++; descuento += r.discount;
  }
  if (!aplicadas) return fallo(motivo || "Ese código no vale para tu cita.");
  return NextResponse.json({ ok: true, cupon: c.code, descuento, pagos: c.conditions?.pagos || [] });
}

async function sumaCita(sb: any, id: string): Promise<number> {
  const { data } = await sb.from("appointment_services").select("price").eq("appointment_id", id);
  return (data || []).reduce((s: number, i: any) => s + (Number(i.price) || 0), 0);
}
