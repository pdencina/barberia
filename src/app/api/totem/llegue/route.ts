import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, hoyChile, primerNombre, demasiadosIntentos, ipDe } from "@/lib/totem";
import { notify } from "@/lib/notify";

// POST {codigo, appointmentId, code}: el cliente avisa que llego. Marca arrived_at y avisa al profesional.
// El codigo corto es la prueba: sin el (o si no calza con la cita) no se hace nada.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`llegue:${ipDe(req)}`, 15)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Totem no disponible" }, { status: 404 });

  const code = normalizarCodigo(body.code);
  if (!body.appointmentId || code.length !== 5) return NextResponse.json({ error: "Falta el código" }, { status: 400 });

  const { data: a } = await supabase.from("appointments")
    .select("id, status, barber_id, arrived_at, checkin_code, client:clients(name)")
    .eq("id", body.appointmentId).eq("tenant_id", t.id).eq("date", hoyChile()).maybeSingle();
  if (!a || (a as any).checkin_code !== code || !["scheduled", "confirmed", "in_progress"].includes((a as any).status)) {
    return NextResponse.json({ error: "No encontramos tu cita" }, { status: 404 });
  }
  const cita: any = a;
  if (cita.arrived_at) return NextResponse.json({ ok: true, yaAvisado: true });

  await supabase.from("appointments").update({ arrived_at: new Date().toISOString(), ...(cita.status === "scheduled" ? { status: "confirmed" } : {}) }).eq("id", cita.id);
  const nombre = primerNombre(cita.client?.name) || "Tu cliente";
  await notify({
    tenantId: t.id, kind: "client_arrived", userIds: cita.barber_id ? [cita.barber_id] : [], roles: ["admin", "receptionist"],
    title: "Tu cliente llegó", body: `${nombre} avisó su llegada desde el tótem.`, url: "/dashboard/mi-agenda", professionalId: cita.barber_id,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
