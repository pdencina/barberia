import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { firmarGrupo } from "@/lib/promo-grupo";
import { claveNombre, telefono9 } from "@/lib/cliente-existente";
import { demasiadosIntentos, ipDe } from "@/lib/totem";
import { POST as reservar } from "../../book/route";

// Público: reserva de una promoción «2 personas juntas». Crea las dos citas del mismo día unidas en un grupo; si la segunda
// no se puede, anula la primera: nunca queda una sola reserva con el descuento.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`promo2:${ipDe(req)}`, 8)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const personas: any[] = Array.isArray(body.personas) ? body.personas : [];
  const fecha = String(body.date || "");
  const cupon = String(body.couponCode || "").trim().toUpperCase().slice(0, 40);
  if (personas.length !== 2 || !fecha || !cupon) return NextResponse.json({ error: "Faltan los datos de las 2 personas" }, { status: 400 });
  const [a, b] = personas;
  for (const p of personas) {
    if (!String(p?.clientName || "").trim() || !telefono9(p?.clientPhone) || !p?.barberId || !p?.startTime || !Array.isArray(p?.serviceIds) || !p.serviceIds.length) {
      return NextResponse.json({ error: "Completa nombre, celular, servicio y hora de las 2 personas" }, { status: 400 });
    }
    if (String(p.startTime).slice(0, 10) !== fecha) return NextResponse.json({ error: "Las dos reservas deben ser el mismo día" }, { status: 400 });
  }
  if (telefono9(a.clientPhone) === telefono9(b.clientPhone) && claveNombre(a.clientName) === claveNombre(b.clientName)) {
    return NextResponse.json({ error: "Deben ser 2 personas distintas" }, { status: 400 });
  }
  if (a.barberId === b.barberId && a.startTime === b.startTime) return NextResponse.json({ error: "Esa hora no puede ser para las dos personas con el mismo profesional" }, { status: 409 });

  const grupo = { id: randomUUID(), firma: "" };
  grupo.firma = firmarGrupo(grupo.id);
  const correo = String(a.clientEmail || "").trim();
  const crear = async (p: any) => {
    const res = await reservar(new NextRequest(new URL("/api/public/book", req.url), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceIds: p.serviceIds, barberId: p.barberId, date: fecha, startTime: p.startTime, clientName: p.clientName, clientPhone: p.clientPhone,
        clientEmail: String(p.clientEmail || "").trim() || correo, marketingConsent: body.marketingConsent === true, couponCode: cupon, grupoPromo: grupo }),
    }));
    return { status: res.status, d: await res.json().catch(() => ({})) };
  };
  const uno = await crear(a);
  if (uno.status !== 200) return NextResponse.json({ error: `Persona 1: ${uno.d.error || "no se pudo reservar"}` }, { status: uno.status });
  const dos = await crear(b);
  if (dos.status !== 200) {
    const sb = createAdminSupabase();
    // El estado va solo: los datos de quién canceló son aparte y no deben impedir la anulación.
    const { error: anular } = await sb.from("appointments").update({ status: "cancelled" }).eq("id", uno.d.appointmentId);
    if (anular) console.error("[promo 2 personas] no se pudo anular la primera reserva:", anular.message);
    await sb.from("appointments").update({ cancelled_at: new Date().toISOString(), cancel_reason: "error" }).eq("id", uno.d.appointmentId);
    return NextResponse.json({ error: `Persona 2: ${dos.d.error || "no se pudo reservar"}. No quedó ninguna reserva; elige otra hora.` }, { status: dos.status });
  }
  return NextResponse.json({ success: true, reservas: [{ appointmentId: uno.d.appointmentId, promo: uno.d.promo }, { appointmentId: dos.d.appointmentId, promo: dos.d.promo }] });
}
