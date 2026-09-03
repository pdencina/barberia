import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// Resolve the access token to query an order with. CRITICAL: a MercadoPago order can
// only be read with the SAME account's token that created it. This used to always use
// process.env.MP_ACCESS_TOKEN, so for a business charging with ITS OWN token the status
// query hit the wrong account, never saw the order as approved, and the POS polled
// forever ("loop eterno" — the machine charged but the system never confirmed).
// Mirror the charge endpoint's resolution: barber's personal token -> tenant terminal
// token -> tenant global token -> env.
async function resolveTokenForBarber(supabase: any, barberId: string | null): Promise<string | null> {
  const envToken = process.env.MP_ACCESS_TOKEN || null;
  if (!barberId) return envToken;

  const { data: barber } = await supabase
    .from("profiles")
    .select("work_mode, mp_access_token, tenant_id")
    .eq("id", barberId)
    .single();
  if (!barber) return envToken;

  if (barber.work_mode === "rental" && barber.mp_access_token) return barber.mp_access_token;

  const tenantId = barber.tenant_id;
  if (tenantId) {
    // A terminal with its own token takes precedence, then the tenant's global token.
    const { data: terminal } = await supabase
      .from("mp_terminals")
      .select("access_token")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .not("access_token", "is", null)
      .limit(1)
      .maybeSingle();
    if (terminal?.access_token) return terminal.access_token;

    const { data: settings } = await supabase
      .from("tenant_settings")
      .select("mp_access_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (settings?.mp_access_token) return settings.mp_access_token;
  }

  return envToken;
}

// GET: Check order/payment status (Chile - Orders API)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("id");
  const barberId = searchParams.get("barberId");

  if (!orderId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const accessToken = await resolveTokenForBarber(supabase, barberId);
  if (!accessToken) {
    // No token to check with — report as retryable "pending", never a hard error that
    // would leave the POS stuck. The POS timeout will then ask the cashier to confirm.
    return NextResponse.json({ status: "pending", note: "token no resuelto" });
  }

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/orders/${orderId}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
    );

    const data = await res.json().catch(() => ({}));

    // If MP rejects the query (e.g. wrong account / transient error), report "pending"
    // (retryable) and log it — never a hard error that strands the POS in its loop.
    if (!res.ok) {
      console.error(`[mp/status] HTTP ${res.status} for order ${orderId}: ${JSON.stringify(data).slice(0, 300)}`);
      return NextResponse.json({ status: "pending", httpStatus: res.status });
    }

    // Map order status to our internal status
    let status = "pending";
    if (data.status === "processed" || data.status === "closed") {
      // Check payment status within the order
      const payment = data.transactions?.payments?.[0];
      if (payment?.status === "approved" || payment?.status === "processed") {
        status = "approved";
      } else if (payment?.status === "rejected" || payment?.status === "cancelled") {
        status = "rejected";
      }
    } else if (data.status === "expired" || data.status === "cancelled") {
      status = "cancelled";
    }

    // Update local record
    if (status !== "pending") {
      await supabase
        .from("mp_payment_intents")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("mp_payment_id", orderId);
    }

    return NextResponse.json({
      status,
      orderStatus: data.status,
      orderStatusDetail: data.status_detail,
      paymentStatus: data.transactions?.payments?.[0]?.status || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
