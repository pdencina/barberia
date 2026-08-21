import { NextRequest, NextResponse } from "next/server";

// GET: Test if Resend is configured and working
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  return NextResponse.json({
    resend_configured: !!apiKey,
    resend_key_prefix: apiKey ? apiKey.slice(0, 10) + "..." : null,
    email_from: emailFrom || "NOT SET",
    note: "POST to this endpoint with {to: 'email'} to send a test email",
  });
}

// POST: Send a test email
export async function POST(req: NextRequest) {
  const { to } = await req.json();

  if (!to) {
    return NextResponse.json({ error: "Provide 'to' email" }, { status: 400 });
  }

  try {
    const { Resend } = await import("resend");
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not set in env vars" }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to,
      subject: "Test email desde re-booking",
      html: `<h2>Email de prueba</h2><p>Si ves esto, el servidor de correo funciona correctamente.</p><p>Enviado: ${new Date().toISOString()}</p>`,
    });

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: data?.id, sentTo: to });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
