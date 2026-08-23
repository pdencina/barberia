import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import webpush from "web-push";

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@re-booking.cl";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

/**
 * POST: Send push notification to a specific user
 * Body: { userId, title, body, icon?, url? }
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { userId, title, body: notifBody, icon, url } = await req.json();

  if (!userId || !title) {
    return NextResponse.json({ error: "userId and title required" }, { status: 400 });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  // Get all push subscriptions for this user
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ error: "User has no push subscriptions", sent: 0 });
  }

  const payload = JSON.stringify({
    title,
    body: notifBody || "",
    icon: icon || "/logo-icon.png",
    badge: "/logo-icon.png",
    url: url || "/dashboard",
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err: any) {
      failed++;
      // If subscription expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  return NextResponse.json({ success: true, sent, failed });
}
