import { NextResponse } from "next/server";

// GET: List all Point devices for this MP account
export async function GET() {
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  try {
    // In Chile, Point Integration API is not available
    // Use the devices endpoint via Point Smart API
    const res = await fetch("https://api.mercadopago.com/point/integration-api/devices?offset=0&limit=50", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // If point integration API fails (Chile), try getting device info via orders
    if (res.status === 403) {
      // Try creating a test order to see if Orders API works
      const ordersRes = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "point",
          external_reference: "test-device-check",
          transactions: {
            payments: [{
              amount: 100,
              payment_method: { type: "debit_card" },
            }],
          },
          config: {
            point: {
              terminal_id: process.env.MP_DEVICE_ID || "NEWLAND_N950__N950NCC904443218",
            },
          },
          description: "Test conexion re-booking",
        }),
      });

      const ordersData = await ordersRes.json();

      return NextResponse.json({
        point_integration_api: "Not available in Chile (403 forbidden)",
        orders_api_response: ordersData,
        orders_api_status: ordersRes.status,
        device_id_configured: process.env.MP_DEVICE_ID || "not set",
        note: "Chile uses Orders API (/v1/orders) instead of Point Integration API",
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
