import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Upload a business logo, saved on tenants.logo_url.
// Used to show the salon's own branding on the public booking page and on receipt
// emails, instead of the generic re-booking logo everywhere.
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const tenantId = formData.get("tenantId") as string;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });
  }

  const fileExt = file.name.split(".").pop() || "png";
  const fileName = `logos/${tenantId}.${fileExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("cut-photos")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("cut-photos")
    .getPublicUrl(fileName);

  const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache bust

  const { error: updateError } = await supabase
    .from("tenants")
    .update({ logo_url: logoUrl })
    .eq("id", tenantId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: logoUrl });
}

// DELETE: Remove the business logo, reverting to the default re-booking branding.
export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("logo_url")
    .eq("id", tenantId)
    .single();

  if (tenant?.logo_url) {
    const path = tenant.logo_url.split("/cut-photos/")[1]?.split("?")[0];
    if (path) {
      await supabase.storage.from("cut-photos").remove([path]);
    }
  }

  await supabase.from("tenants").update({ logo_url: null }).eq("id", tenantId);

  return NextResponse.json({ success: true });
}
