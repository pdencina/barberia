import { NextResponse } from "next/server";

// GET: List all Point devices for this MP account
export async function GET() {
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.mercadopago.com/point/integration-api/devices", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
