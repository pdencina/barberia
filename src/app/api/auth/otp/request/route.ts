import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/server";
import { hashLoginCode, LOGIN_CODE_MINUTES, LOGIN_CODE_MAX_PER_HOUR, LOGIN_CODE_COOLDOWN_SECONDS } from "@/lib/login-code";

export const dynamic = "force-dynamic";

// Pide un código de 6 dígitos por correo. Siempre responde igual exista o no la cuenta (no revela quién tiene cuenta).
// Solo cuentas que ya existen: nunca crea usuarios.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email || email.length > 200 || !email.includes("@")) {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }
  const ok = NextResponse.json({ success: true });
  const sb = createAdminSupabase();

  const { data: perfiles } = await sb.from("profiles").select("id, name, email").ilike("email", email).limit(5);
  const perfil = (perfiles || []).find((p: any) => String(p.email || "").toLowerCase() === email);
  if (!perfil) return ok;

  // Límites: una petición cada 45 s y 5 por hora por correo.
  const hace1h = new Date(Date.now() - 3600_000).toISOString();
  const { data: recientes, error: errTabla } = await sb.from("login_codes").select("created_at").eq("email", email).gte("created_at", hace1h).order("created_at", { ascending: false });
  if (errTabla) {
    console.error("otp/request: falta aplicar la migración 150:", errTabla.message);
    return NextResponse.json({ error: "Falta aplicar la migración 150" }, { status: 503 });
  }
  if ((recientes || []).length >= LOGIN_CODE_MAX_PER_HOUR) return ok;
  const ultimo = recientes?.[0]?.created_at ? new Date(recientes[0].created_at).getTime() : 0;
  if (Date.now() - ultimo < LOGIN_CODE_COOLDOWN_SECONDS * 1000) return ok;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Un solo código vigente por correo.
  await sb.from("login_codes").update({ used: true }).eq("email", email).eq("used", false);
  const { error: errIns } = await sb.from("login_codes").insert({
    email, code_hash: hashLoginCode(email, code), expires_at: new Date(Date.now() + LOGIN_CODE_MINUTES * 60_000).toISOString(),
  });
  if (errIns) { console.error("otp/request insert:", errIns.message); return ok; }

  try {
    const { getResendClient } = await import("@/lib/resend-client");
    await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to: perfil.email,
      subject: `Tu código para entrar: ${code} | re-booking`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #f5f7fa;">
  <div style="background: #fff; padding: 28px; border-radius: 12px; border: 1px solid #e5e7eb; text-align: center;">
    <img src="https://re-booking.cl/logo-horizontal.png" alt="re-booking" style="height: 36px; margin-bottom: 18px;" />
    <p style="color: #374151; font-size: 15px;">Hola <strong>${String(perfil.name || "").replace(/[<>&]/g, "") || "Usuario"}</strong>, usa este código para entrar:</p>
    <p style="font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #0F8B8D; margin: 20px 0;">${code}</p>
    <p style="color: #6b7280; font-size: 12px;">Vale ${LOGIN_CODE_MINUTES} minutos y sirve una sola vez. Si no lo pediste tú, ignora este correo: tu clave sigue igual.</p>
  </div></body></html>`,
    });
  } catch (e) {
    console.error("otp/request: error enviando correo:", e);
  }
  return ok;
}
