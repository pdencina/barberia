import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Log a login session
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { userId, userName, userEmail, userRole, device, browser } = await req.json();

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Get IP from headers
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
             req.headers.get("x-real-ip") || 
             "unknown";

  await supabase.from("login_sessions").insert({
    user_id: userId,
    user_name: userName || null,
    user_email: userEmail || null,
    user_role: userRole || null,
    device: device || "unknown",
    browser: browser || "unknown",
    ip_address: ip,
  });

  return NextResponse.json({ success: true });
}

// GET: List sessions (for admin view)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const limit = parseInt(searchParams.get("limit") || "50");

  let query = supabase
    .from("login_sessions")
    .select("*")
    .order("logged_in_at", { ascending: false })
    .limit(limit);

  if (userId) query = query.eq("user_id", userId);

  const { data } = await query;
  return NextResponse.json(data || []);
}
