import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { cleanClientName } from "@/lib/client-name";

// Public endpoint to look up a client by email or phone
// Used in the booking page for autocompletion
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const phone = searchParams.get("phone");
  const code = (searchParams.get("code") || "").trim().toUpperCase();
  const tenantId = searchParams.get("tenantId");

  // Por código de reserva (el que se le da al cliente al agendar): solo dentro de su negocio.
  if (code) {
    if (!/^[A-Z0-9]{5}$/.test(code) || !tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) return NextResponse.json({ found: false });
    const { data: porCodigo } = await supabase.from("clients").select("id, name, email, phone").eq("tenant_id", tenantId).eq("checkin_code", code).limit(1).maybeSingle();
    if (!porCodigo) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, client: { ...porCodigo, name: cleanClientName(porCodigo.name) || porCodigo.name } }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!email && !phone) {
    return NextResponse.json({ found: false });
  }

  let query = supabase.from("clients").select("id, name, email, phone");

  if (email) {
    query = query.eq("email", email);
  } else if (phone) {
    query = query.eq("phone", phone);
  }

  // Take the first match. Using .single() here silently FAILED whenever more than one
  // client shared the email — which is exactly the duplicate situation this feature is
  // supposed to prevent. It returned found:false, the booking created yet another
  // duplicate, and the loop kept growing. maybeSingle + limit(1) returns the existing
  // one instead.
  const { data } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();

  if (data) {
    // El formulario de reserva usa este nombre para autocompletar: sin "null" de importaciones antiguas.
    return NextResponse.json({ found: true, client: { ...data, name: cleanClientName(data.name) || data.name } });
  }

  return NextResponse.json({ found: false });
}
