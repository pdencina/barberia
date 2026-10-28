import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { codigoValido, normalizarCodigo } from "@/lib/referidos";

export const dynamic = "force-dynamic";

// Publico: solo dice si un codigo existe. No devuelve datos del negocio que invita.
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("code") || "";
  if (!codigoValido(raw)) return NextResponse.json({ valido: false });
  const { data, error } = await createAdminSupabase().from("tenants").select("id").eq("referral_code", normalizarCodigo(raw)).maybeSingle();
  return NextResponse.json({ valido: !error && !!data });
}
