import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, CODE_ALPHABET, demasiadosIntentos, ipDe } from "@/lib/totem";

// POST {codigo, modo}: el tótem crea una sesión corta y devuelve el enlace que va dentro del QR «Ver mi código».
// El cliente lo escanea con su celular, escribe su correo y el tótem recibe su código solo (ver /mi-codigo).
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`vinc-crear:${ipDe(req)}`, 20)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Tótem no disponible" }, { status: 404 });

  const bytes = randomBytes(10);
  const token = Array.from(bytes).map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(""); // 10 caracteres: no se puede adivinar
  const modo = body.modo === "pagar" ? "pagar" : "llegue";
  const { error } = await supabase.from("kiosk_links").insert({ token, tenant_id: t.id, modo });
  if (error) return NextResponse.json({ error: "No pudimos crear el código QR" }, { status: 500 });
  // Se limpian las sesiones de más de un día de este negocio.
  await supabase.from("kiosk_links").delete().eq("tenant_id", t.id).lt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()).then(() => {}, () => {});

  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl").replace(/\/$/, "");
  return NextResponse.json({ ok: true, token, url: `${base}/mi-codigo?t=${token}` });
}
