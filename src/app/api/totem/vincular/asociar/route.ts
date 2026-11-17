import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { soloDiaDelTotem, primerNombre, demasiadosIntentos, ipDe, VIGENCIA_VINCULO_MS } from "@/lib/totem";

// POST {t, email}: lo llama el CELULAR del cliente (página /mi-codigo). Busca al cliente por su correo; solo lo reconoce si tiene una cita en el
// período que atiende el tótem (hoy), para no revelar a cualquiera si un correo es cliente. Guarda su código en la sesión del tótem.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`vinc-asociar:${ipDe(req)}`, 10)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const token = String(body.t || "");
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[A-Z0-9]{10}$/.test(token)) return NextResponse.json({ error: "Este código QR no es válido. Vuelve a escanearlo en la pantalla." }, { status: 404 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Escribe tu correo (ej. nombre@gmail.com)" }, { status: 400 });

  const { data: l } = await supabase.from("kiosk_links").select("token, tenant_id, created_at, intentos, code").eq("token", token).maybeSingle();
  if (!l || Date.now() - new Date((l as any).created_at).getTime() > VIGENCIA_VINCULO_MS) return NextResponse.json({ error: "Este código QR venció. Vuelve a tocar «Ver mi código» en la pantalla." }, { status: 410 });
  if ((l as any).intentos >= 5) return NextResponse.json({ error: "Demasiados intentos con este QR. Vuelve a tocar «Ver mi código» en la pantalla." }, { status: 429 });
  await supabase.from("kiosk_links").update({ intentos: (l as any).intentos + 1 }).eq("token", token);

  const tenantId: string = (l as any).tenant_id;
  const { data: neg } = await supabase.from("tenants").select("name, slug, logo_url, kiosk_enabled, kiosk_unlocked").eq("id", tenantId).maybeSingle();
  if (!neg || !(neg as any).kiosk_enabled || !(neg as any).kiosk_unlocked) return NextResponse.json({ error: "El tótem no está disponible." }, { status: 404 });

  // Clientes con ese correo (exacto, sin distinguir mayúsculas) y, de ellos, el que tenga una cita que el tótem atiende.
  const esc = email.replace(/[\\%_]/g, "\\$&");
  const { data: clientes } = await supabase.from("clients").select("id, name, checkin_code").eq("tenant_id", tenantId).ilike("email", esc).limit(5);
  const ids = (clientes || []).map((c: any) => c.id);
  let cita: any = null;
  if (ids.length) {
    const { data: citas } = await soloDiaDelTotem(supabase.from("appointments").select("id, client_id, start_time, status, appointment_services(services(name))").eq("tenant_id", tenantId).in("client_id", ids).in("status", ["scheduled", "confirmed", "in_progress"])).order("date").order("start_time").limit(5);
    cita = (citas || [])[0] || null;
  }
  const cliente: any = cita ? (clientes || []).find((c: any) => c.id === cita.client_id) : null;
  if (!cliente || !cliente.checkin_code) {
    // Nunca se cierra el flujo: sin cita hoy (o correo desconocido, con el MISMO mensaje) se ofrece reservar.
    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl").replace(/\/$/, "");
    return NextResponse.json({
      error: "No tienes una cita agendada para hoy. ¿Deseas reservar?", sinCita: true,
      negocio: { name: (neg as any).name, logo_url: (neg as any).logo_url || null },
      reservaUrl: (neg as any).slug ? `${base}/${(neg as any).slug}?vista=ambas` : null,
    }, { status: 404 });
  }

  await supabase.from("kiosk_links").update({ client_id: cliente.id, code: cliente.checkin_code }).eq("token", token);
  return NextResponse.json({
    ok: true, code: cliente.checkin_code, nombre: primerNombre(cliente.name),
    negocio: { name: (neg as any).name, logo_url: (neg as any).logo_url || null },
    cita: { hora: String(cita.start_time || "").slice(11, 16), servicio: (cita.appointment_services || []).map((x: any) => x.services?.name).filter(Boolean).join(" + ") || "Tu cita" },
  });
}
