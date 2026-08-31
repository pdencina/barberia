import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// PATCH: Record the tip a client added on the card terminal AFTER the payment was
// already approved. This is purely informational — it does not charge anything, it
// just logs how much of what the terminal showed was tip vs. the actual sale amount.
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { transactionId, tipAmount } = await req.json();

  if (!transactionId || tipAmount === undefined) {
    return NextResponse.json({ error: "transactionId y tipAmount son obligatorios" }, { status: 400 });
  }

  const { error } = await supabase
    .from("transactions")
    .update({ tip_amount: Math.max(0, Math.round(Number(tipAmount) || 0)) })
    .eq("id", transactionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
