import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { subscription, userId } = body;

  const { endpoint, keys } = subscription;

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId || null,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );

  return NextResponse.json({ success: true });
}
