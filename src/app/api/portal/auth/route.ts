import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Send verification code to client's email or phone
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { email, phone, code } = await req.json();

  // Step 1: Request code
  if (!code) {
    if (!email && !phone) {
      return NextResponse.json({ error: "Email o telefono requerido" }, { status: 400 });
    }

    // Find client
    let query = supabase.from("clients").select("id, name, email, phone");
    if (email) {
      query = query.eq("email", email);
    } else {
      query = query.eq("phone", phone);
    }
    const { data: client } = await query.single();

    if (!client) {
      // Don't reveal if client exists
      return NextResponse.json({ success: true, message: "Si existe una cuenta, recibiras un codigo" });
    }

    // Generate 4-digit code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Store code in client record (expires in 10 minutes)
    await supabase
      .from("clients")
      .update({
        verification_code: verificationCode,
        verification_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .eq("id", client.id);

    // Send code via email if available
    if (client.email) {
      try {
        const { getResendClient } = await import("@/lib/resend-client");
        const resend = getResendClient();
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "re-booking <no-reply@rebooking.cl>",
          to: client.email,
          subject: `Tu codigo de acceso: ${verificationCode}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 30px; text-align: center;">
              <h2 style="color: #1D2433; margin-bottom: 8px;">Tu codigo de acceso</h2>
              <p style="color: #8A94A6; font-size: 14px; margin-bottom: 24px;">Ingresa este codigo en el portal de re-booking</p>
              <div style="background: #F6F8FB; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="font-size: 36px; font-weight: bold; color: #1E88E5; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
              </div>
              <p style="color: #8A94A6; font-size: 12px;">Este codigo expira en 10 minutos</p>
            </div>
          `,
        });
      } catch (e) {
        console.error("Error sending verification email:", e);
      }
    }

    return NextResponse.json({ success: true, message: "Codigo enviado" });
  }

  // Step 2: Verify code
  if (!email && !phone) {
    return NextResponse.json({ error: "Email o telefono requerido" }, { status: 400 });
  }

  let query = supabase.from("clients").select("id, name, email, phone, verification_code, verification_expires");
  if (email) {
    query = query.eq("email", email);
  } else {
    query = query.eq("phone", phone);
  }
  const { data: client } = await query.single();

  if (!client) {
    return NextResponse.json({ error: "Codigo incorrecto" }, { status: 401 });
  }

  // Check code
  if (client.verification_code !== code) {
    return NextResponse.json({ error: "Codigo incorrecto" }, { status: 401 });
  }

  // Check expiration
  if (client.verification_expires && new Date(client.verification_expires) < new Date()) {
    return NextResponse.json({ error: "Codigo expirado. Solicita uno nuevo." }, { status: 401 });
  }

  // Clear code
  await supabase
    .from("clients")
    .update({ verification_code: null, verification_expires: null })
    .eq("id", client.id);

  // Return client token (use client ID as simple token for portal session)
  return NextResponse.json({
    success: true,
    clientId: client.id,
    clientName: client.name,
    token: Buffer.from(`${client.id}:${Date.now()}`).toString("base64"),
  });
}
