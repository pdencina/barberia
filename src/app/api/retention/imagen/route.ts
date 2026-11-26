import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel, resolveTenantForRequest } from "@/lib/supabase/server";
import { BUCKET_PROMOS, carpetaPromos } from "@/lib/promo-imagen";

// Sube la imagen que acompaña el correo de una promoción. Solo el equipo de administración del negocio.
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const { ok } = await isManagerLevel();
  if (!ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 400 }); }
  const { tenantId } = await resolveTenantForRequest((form.get("tenantId") as string | null) || null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio" }, { status: 400 });
  const file = form.get("file") as File | null;
  const ext = file ? TIPOS[file.type] : undefined;
  if (!file || !ext) return NextResponse.json({ error: "Sube una imagen JPG, PNG o WEBP" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen pesa más de 4 MB" }, { status: 400 });

  const supabase = createAdminSupabase();
  // Nombre nuevo en cada subida: así los correos ya enviados conservan su imagen.
  const path = `${carpetaPromos(tenantId)}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_PROMOS).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: `No se pudo subir la imagen: ${error.message}` }, { status: 500 });
  return NextResponse.json({ url: supabase.storage.from(BUCKET_PROMOS).getPublicUrl(path).data.publicUrl });
}
