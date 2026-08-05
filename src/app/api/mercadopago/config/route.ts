import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get house terminal config
export async function GET() {
  const supabase = createAdminSupabase();

  const { data: config } = await supabase
    .from("mp_config")
    .select("*")
    .eq("is_default", true)
    .single();

  // If no DB config, check env vars
  if (!config || !config.device_id) {
    return NextResponse.json({
      config: {
        id: "env",
        name: "Terminal de la Casa",
        access_token: process.env.MP_ACCESS_TOKEN ? "***configured***" : null,
        device_id: process.env.MP_DEVICE_ID || null,
        active: !!process.env.MP_ACCESS_TOKEN,
      },
      source: "env_vars",
    });
  }

  return NextResponse.json({
    config: { ...config, access_token: config.access_token ? "***configured***" : null },
    source: "database",
  });
}

// POST: Save house terminal config
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { accessToken, deviceId } = await req.json();

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId requerido" }, { status: 400 });
  }

  // Upsert default terminal
  const { data: existing } = await supabase
    .from("mp_config")
    .select("id")
    .eq("is_default", true)
    .single();

  if (existing) {
    const updateData: Record<string, any> = { device_id: deviceId, active: true };
    if (accessToken) updateData.access_token = accessToken;
    await supabase.from("mp_config").update(updateData).eq("id", existing.id);
  } else {
    await supabase.from("mp_config").insert({
      name: "Terminal de la Casa",
      access_token: accessToken || null,
      device_id: deviceId,
      is_default: true,
      active: true,
    });
  }

  return NextResponse.json({ success: true });
}
