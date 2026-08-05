import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get terminal info for a barber (or house terminal)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ error: "barberId required" }, { status: 400 });
  }

  const { data: barber } = await supabase
    .from("profiles")
    .select("id, name, work_mode, mp_access_token, mp_device_id, mp_external_id, mp_store_id")
    .eq("id", barberId)
    .single();

  if (!barber) {
    return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });
  }

  // If rental and has own terminal, use it
  if (barber.work_mode === "rental" && barber.mp_access_token) {
    return NextResponse.json({
      terminal: "personal",
      barberName: barber.name,
      hasTerminal: true,
      deviceId: barber.mp_device_id,
    });
  }

  // Otherwise use house terminal (env vars)
  const houseToken = process.env.MP_ACCESS_TOKEN;
  return NextResponse.json({
    terminal: "house",
    barberName: barber.name,
    hasTerminal: !!houseToken,
    deviceId: process.env.MP_DEVICE_ID || null,
  });
}

// POST: Create payment intent on the barber's terminal
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { barberId, amount, description, externalReference } = body;

  // Determine which token to use
  const { data: barber } = await supabase
    .from("profiles")
    .select("id, name, work_mode, mp_access_token, mp_device_id, mp_store_id")
    .eq("id", barberId)
    .single();

  if (!barber) {
    return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });
  }

  const accessToken = (barber.work_mode === "rental" && barber.mp_access_token)
    ? barber.mp_access_token
    : process.env.MP_ACCESS_TOKEN;

  const deviceId = (barber.work_mode === "rental" && barber.mp_device_id)
    ? barber.mp_device_id
    : process.env.MP_DEVICE_ID;

  if (!accessToken) {
    return NextResponse.json({ error: "Token de MercadoPago no configurado" }, { status: 400 });
  }

  if (!deviceId) {
    return NextResponse.json({ error: "Dispositivo MP no configurado para este barbero" }, { status: 400 });
  }

  try {
    // Cancel any pending orders first (avoid "already queued" error)
    const { data: pendingOrders } = await supabase
      .from("mp_payment_intents")
      .select("mp_payment_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3);

    for (const order of pendingOrders || []) {
      if (!order.mp_payment_id) continue;
      await fetch(`https://api.mercadopago.com/v1/orders/${order.mp_payment_id}/cancel`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      await supabase.from("mp_payment_intents").update({ status: "cancelled" }).eq("mp_payment_id", order.mp_payment_id);
    }

    // Chile uses Orders API (not Point Integration API)
    const idempotencyKey = `${externalReference || "pos"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ordersRes = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        type: "point",
        external_reference: externalReference || `pos-${Date.now()}`,
        transactions: {
          payments: [{
            amount: String(Number(amount)),
          }],
        },
        config: {
          point: {
            terminal_id: deviceId,
          },
        },
        description: description || "Venta re-booking",
      }),
    });

    const ordersData = await ordersRes.json();

    if (!ordersRes.ok) {
      return NextResponse.json({
        error: ordersData.errors?.[0]?.message || "Error al crear orden de pago",
        details: ordersData,
      }, { status: ordersRes.status });
    }

    // Process the order (sends it to the terminal)
    const processRes = await fetch(`https://api.mercadopago.com/v1/orders/${ordersData.id}/process`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // Store payment intent
    await supabase.from("mp_payment_intents").insert({
      barber_id: barberId,
      amount,
      status: "pending",
      mp_payment_id: ordersData.id,
      mp_external_reference: externalReference,
      device_id: deviceId,
    });

    return NextResponse.json({
      success: true,
      paymentIntentId: ordersData.id,
      deviceId,
      barberName: barber.name,
      terminal: barber.work_mode === "rental" && barber.mp_access_token ? "personal" : "house",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
