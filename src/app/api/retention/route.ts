import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";
import { getInactiveClients, dedupeBy, tenantBookingUrl } from "@/lib/retention";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // SEGURIDAD: nunca confiar directo en el tenantId de la URL — resolveTenantForRequest lo
  // reemplaza por el negocio real del usuario logueado salvo que sea super_admin.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  const daysRaw = parseInt(searchParams.get("days") || "");
  const days = Number.isFinite(daysRaw) ? Math.max(0, daysRaw) : 30; // 0 = "0 a N dias": incluye a quien vino hoy

  if (!tenantId || tenantId === "ALL") {
    return NextResponse.json({ clients: [], stats: { total: 0, inactive: 0, percentage: 0, contactable: 0 } });
  }

  // La logica de "quien esta inactivo" vive en lib/retention (compartida con el envio masivo).
  // includeNever=1 suma a quien NUNCA tuvo una visita registrada (clientes nuevos o importados); por defecto no.
  const includeNever = searchParams.get("includeNever") === "1";
  // maxDays (opcional): rango "entre N y M dias sin venir".
  const maxRaw = parseInt(searchParams.get("maxDays") || "");
  const maxDays = Number.isFinite(maxRaw) && maxRaw >= days ? maxRaw : null;
  const { total, inactive: all, neverVisited } = await getInactiveClients(supabase, tenantId, days, { includeNever, maxDays });

  // Una fila por persona: dos fichas con el mismo correo (o el mismo telefono, si no tienen correo) se muestran una sola vez.
  const digits = (t: string | null) => (t || "").replace(/\D/g, "");
  const inactive = dedupeBy(all, (c) => (c.email ? `e:${c.email.trim().toLowerCase()}` : c.phone ? `p:${digits(c.phone)}` : `id:${c.id}`));

  return NextResponse.json({
    clients: inactive,
    bookingUrl: await tenantBookingUrl(supabase, tenantId),
    stats: {
      total,
      inactive: inactive.length,
      percentage: total > 0 ? Math.round((inactive.length / total) * 100) : 0,
      contactable: inactive.filter((c) => c.email || c.phone).length,
      neverVisited, // clientes sin ninguna visita registrada que cumplen los dias (fuera de la lista salvo includeNever=1)
    },
  });
}
