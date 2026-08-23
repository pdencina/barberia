import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { subscription, userId } = body;

  if (!subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { endpoint, keys } = subscription;

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );

  return NextResponse.json({ success: true });
}
