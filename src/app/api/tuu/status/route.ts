import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Check a TUU remote payment request's status by idempotencyKey.
// TUU status lifecycle (docs): Pending(0) -> Sent(1) -> Processing(3) -> Completed(5)
// or Canceled(2) / Failed(4) at any point.
//
// IMPORTANT HISTORY (real money bug): this used to do `res.json().catch(() => ({}))`
// without ever checking res.ok, and anything unrecognised fell through to "pending".
// So an HTTP error — in particular TUU's documented rate limit (INT-MIDDLEWARE-429,
// their quota is roughly 1 request per minute per terminal, while the POS polls every
// few seconds) — was read as "still waiting". The POS then hit its 2 minute timeout,
// declared the payment REJECTED and never recorded the sale, even though the terminal
// had actually charged the client. Now transport/HTTP failures are reported as
// "unknown" (never as pending or rejected) so the POS can ask the cashier to confirm
// instead of silently losing a paid sale.
const TUU_BASE_URL = "https://integrations.payment.haulmer.com";

const STATUS_MAP: Record<string, string> = {
  "0": "pending", pending: "pending",
  "1": "sent", sent: "sent",
  "2": "cancelled", canceled: "cancelled", cancelled: "cancelled",
  "3": "processing", processing: "processing",
  "4": "failed", failed: "failed",
  "5": "completed", completed: "completed",
};

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const idempotencyKey = searchParams.get("id");
  const barberId = searchParams.get("barberId");

  if (!idempotencyKey) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  let apiKey: string | null = process.env.TUU_API_KEY || null;
  if (barberId) {
    const { data: barber } = await supabase.from("profiles").select("tenant_id").eq("id", barberId).single();
    if (barber?.tenant_id) {
      const { data: settings } = await supabase
        .from("tenant_settings")
        .select("tuu_api_key")
        .eq("tenant_id", barber.tenant_id)
        .single();
      apiKey = settings?.tuu_api_key || apiKey;
    }
  }

  if (!apiKey) {
    return NextResponse.json({ error: "API Key de TUU no configurada" }, { status: 400 });
  }

  try {
    const res = await fetch(`${TUU_BASE_URL}/RemotePayment/v2/GetPaymentReques/${idempotencyKey}`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });

    const bodyText = await res.text();
    let data: any = {};
    try { data = bodyText ? JSON.parse(bodyText) : {}; } catch {}

    // Rate limited: explicitly tell the POS to back off and keep waiting. This is NOT
    // a payment failure, and it must never be treated as one.
    if (res.status === 429) {
      console.warn(`[tuu/status] 429 rate limited for ${idempotencyKey}`);
      return NextResponse.json({ status: "rate_limited", retryable: true });
    }

    if (!res.ok) {
      // Log the real payload so the actual response shape/error can be diagnosed
      // instead of guessing (TUU's public docs don't publish this schema).
      console.error(`[tuu/status] HTTP ${res.status} for ${idempotencyKey}: ${bodyText?.slice(0, 500)}`);
      return NextResponse.json({ status: "unknown", retryable: true, httpStatus: res.status, raw: data });
    }

    const rawStatus = data.status ?? data.Status ?? data.state ?? data.paymentStatus ?? data.requestStatus;
    const known = STATUS_MAP[String(rawStatus)];

    if (!known) {
      // Response arrived but we can't recognise the status field. Report it as unknown
      // (retryable) and log it, rather than pretending the payment is still pending
      // and eventually declaring it rejected.
      console.error(`[tuu/status] unrecognised status for ${idempotencyKey}: ${bodyText?.slice(0, 500)}`);
      return NextResponse.json({ status: "unknown", retryable: true, raw: data });
    }

    // Map TUU's lifecycle to the same "pending" | "approved" | "cancelled" | "rejected"
    // vocabulary the POS frontend already understands from MercadoPago, so the
    // frontend polling logic can stay identical for both providers.
    let mapped = "pending";
    if (known === "completed") mapped = "approved";
    else if (known === "cancelled") mapped = "cancelled";
    else if (known === "failed") mapped = "rejected";

    if (mapped !== "pending") {
      await supabase
        .from("tuu_payment_intents")
        .update({ status: mapped === "approved" ? "completed" : known, updated_at: new Date().toISOString() })
        .eq("idempotency_key", idempotencyKey);
    }

    return NextResponse.json({ status: mapped, rawStatus: known, raw: data });
  } catch (error: any) {
    // Network/transport failure — retryable, definitely not a rejection.
    console.error(`[tuu/status] fetch failed for ${idempotencyKey}: ${error.message}`);
    return NextResponse.json({ status: "unknown", retryable: true, error: error.message });
  }
}
