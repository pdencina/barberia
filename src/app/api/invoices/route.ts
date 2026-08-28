import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

// Avoid build-time prerendering: this reads from the DB and must not be baked/stale.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);

  let query = supabase
    .from("invoices")
    .select("*, uploaded_by_profile:profiles!invoices_uploaded_by_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  // Invoices are financial documents: never show one business's invoices to another.
  if (tenantId && tenantId !== "ALL") query = query.eq("tenant_id", tenantId);

  const { data } = await query;

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const description = formData.get("description") as string;
  const amount = formData.get("amount") as string;
  const type = formData.get("type") as string;

  if (!file || !description) {
    return NextResponse.json({ error: "Archivo y descripcion requeridos" }, { status: 400 });
  }

  // Resolve the business so the invoice isn't saved orphaned (invisible in the list).
  let tenantId: string | null = (formData.get("tenantId") as string) || null;
  if (!tenantId) {
    const resolved = await getTenantFromRequest(req);
    tenantId = resolved && resolved !== "ALL" ? resolved : null;
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "No se pudo determinar el negocio para la boleta." },
      { status: 400 }
    );
  }

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() || "pdf";
  const filename = `invoices/${Date.now()}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("gallery") // reusing gallery bucket
    .upload(filename, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from("gallery")
    .getPublicUrl(uploadData.path);

  // Save record
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      type: type || "purchase",
      description,
      amount: amount ? parseInt(amount) : null,
      file_url: publicUrl,
      file_name: file.name,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
