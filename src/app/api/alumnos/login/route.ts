import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantAlumnos, codigoValido, crearToken, cookieAlumnos } from "@/lib/alumnos";

export async function POST(req: Request) {
  const { evaluator_id, codigo } = await req.json().catch(() => ({}));
  if (typeof evaluator_id !== "string" || typeof codigo !== "string" || !/^\d{6}$/.test(codigo))
    return NextResponse.json({ error: "Escribe tu código de 6 dígitos." }, { status: 400 });
  const sb = createAdminSupabase();
  const { data: e } = await sb.from("course_evaluators").select("*")
    .eq("id", evaluator_id).eq("tenant_id", tenantAlumnos()).eq("active", true).maybeSingle();
  if (!e) return NextResponse.json({ error: "Código incorrecto." }, { status: 401 });
  if (e.locked_until && new Date(e.locked_until) > new Date())
    return NextResponse.json({ error: "Demasiados intentos. Espera 10 minutos." }, { status: 429 });
  if (!codigoValido(codigo, e.pin_hash)) {
    const n = (e.failed_attempts || 0) + 1;
    await sb.from("course_evaluators").update(
      n >= 5 ? { failed_attempts: 0, locked_until: new Date(Date.now() + 10 * 60_000).toISOString() } : { failed_attempts: n }
    ).eq("id", e.id);
    return NextResponse.json({ error: "Código incorrecto." }, { status: 401 });
  }
  await sb.from("course_evaluators").update({ failed_attempts: 0, locked_until: null }).eq("id", e.id);
  const res = NextResponse.json({ ok: true, name: e.name });
  res.cookies.set(cookieAlumnos.name, crearToken(e.id), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: cookieAlumnos.maxAge,
  });
  return res;
}
