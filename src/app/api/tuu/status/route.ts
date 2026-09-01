import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Check a TUU remote payment request's status by idempotencyKey.
// TUU status lifecycle (docs): Pending(0) -> Sent(1) -> Processing(3) -> Completed(5)
// or Canceled(2) / Failed(4) at any point.
//
// NOTE: TUU's public docs don't show the exact JSON shape of this response (the
// interactive API reference requires a logged-in session to render an example). This
// parses defensively (numeric or string status, a few likely field names) — this
// MUST be verified against a real response from Javier's terminal before relying on
// it in production. If the shape doesn't match, this will fall back to "pending"
// forever instead of crashing, so the POS won't misreport a failed sale as approved.
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
    });
    const data = await res.json().catch(() => ({}));

    const rawStatus = data.status ?? data.Status ?? data.state ?? data.paymentStatus;
    const status = STATUS_MAP[String(rawStatus)] || "pending";

    // Map TUU's lifecycle to the same "pending" | "approved" | "cancelled" | "rejected"
    // vocabulary the POS frontend already understands from MercadoPago, so the
    // frontend polling logic can stay identical for both providers.
    let mapped = "pending";
    if (status === "completed") mapped = "approved";
    else if (status === "cancelled") mapped = "cancelled";
    else if (status === "failed") mapped = "rejected";

    if (mapped !== "pending") {
      await supabase
        .from("tuu_payment_intents")
        .update({ status: mapped === "approved" ? "completed" : status, updated_at: new Date().toISOString() })
        .eq("idempotency_key", idempotencyKey);
    }

    return NextResponse.json({ status: mapped, rawStatus: status, raw: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
