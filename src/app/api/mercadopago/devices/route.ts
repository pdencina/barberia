import { NextResponse } from "next/server";

// GET: List all Point devices for this MP account
export async function GET() {
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  try {
    // Try listing devices
    const res = await fetch("https://api.mercadopago.com/point/integration-api/devices?offset=0&limit=50", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-platform-id": "MLC",
      },
    });

    const data = await res.json();

    // If forbidden, the Point integration might not be enabled
    if (res.status === 403) {
      return NextResponse.json({
        error: "Point integration not enabled",
        message: "Nico debe activar 'Modo integrado' en Máquinas Point → Integraciones",
        raw: data,
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
