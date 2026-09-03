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
 * POST: Send a push notification. Recipients can be given three ways (combinable):
 *   - userId: a single user (original behavior)
 *   - userIds: an explicit list of users
 *   - tenantId + roles: everyone in that business with one of those roles
 * The third form is what lets "new appointment" reach the assigned barber AND the
 * reception/admins of the business, instead of the old call that passed no userId and
 * silently failed.
 * Body: { userId?, userIds?, tenantId?, roles?, title, body, icon?, url?, tag? }
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { userId, userIds, tenantId, roles, title, body: notifBody, icon, url } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  // Build the recipient user id set.
  const recipientIds = new Set<string>();
  if (userId) recipientIds.add(userId);
  if (Array.isArray(userIds)) userIds.forEach((id: string) => id && recipientIds.add(id));
  if (tenantId && Array.isArray(roles) && roles.length > 0) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("role", roles)
      .eq("active", true);
    (staff || []).forEach((s) => recipientIds.add(s.id));
  }

  if (recipientIds.size === 0) {
    return NextResponse.json({ error: "No recipients", sent: 0 });
  }

  // Get all push subscriptions for these users
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", Array.from(recipientIds));

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ error: "No push subscriptions for recipients", sent: 0 });
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
