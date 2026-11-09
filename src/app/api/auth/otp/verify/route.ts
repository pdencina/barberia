import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { hashLoginCode, sameHash, LOGIN_CODE_MAX_ATTEMPTS } from "@/lib/login-code";

export const dynamic = "force-dynamic";

// Revisa el código. Si está bien, devuelve un token de un solo uso con el que el navegador abre la sesión (verifyOtp).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  const code = String(body?.code || "").replace(/\D/g, "");
  const malo = NextResponse.json({ error: "Código incorrecto o vencido" }, { status: 400 });
  if (!email || code.length !== 6) return malo;

  const sb = createAdminSupabase();
  const { data: fila } = await sb.from("login_codes").select("id, code_hash, attempts, expires_at")
    .eq("email", email).eq("used", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!fila || new Date(fila.expires_at).getTime() < Date.now() || fila.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return malo;

  if (!sameHash(fila.code_hash, hashLoginCode(email, code))) {
    await sb.from("login_codes").update({ attempts: fila.attempts + 1 }).eq("id", fila.id);
    return malo;
  }
  await sb.from("login_codes").update({ used: true }).eq("id", fila.id);

  const { data: link, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
  const token_hash = link?.properties?.hashed_token;
  if (error || !token_hash) {
    console.error("otp/verify generateLink:", error?.message);
    return NextResponse.json({ error: "No se pudo iniciar la sesión" }, { status: 500 });
  }
  return NextResponse.json({ token_hash });
}
