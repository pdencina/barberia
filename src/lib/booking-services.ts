import { leerServiciosPublicos } from "@/lib/servicios-internos";

// Servicios de una reserva con los precios y duraciones DEL PROFESIONAL (barber_services puede tener precio/duracion propios), calculados en el servidor.
export interface ServicioReserva { id: string; name: string; price: number; duration: number }
export async function resolverServicios(supabase: any, barberId: string, tenantId: string, ids: string[]): Promise<{ servicios: ServicioReserva[]; total: number; duracion: number } | null> {
  const unicos = Array.from(new Set(ids));
  const { data: rows } = await leerServiciosPublicos((cols) => supabase.from("services").select(cols).in("id", unicos).eq("tenant_id", tenantId), "id, name, price, duration");
  if (!rows || rows.length !== unicos.length) return null;
  const { data: custom } = await supabase.from("barber_services").select("service_id, custom_price, custom_duration").eq("barber_id", barberId).in("service_id", unicos);
  const mapa = new Map<string, any>((custom || []).map((c: any) => [c.service_id, c]));
  const servicios: ServicioReserva[] = rows.map((s: any): ServicioReserva => {
    const c = mapa.get(s.id);
    return { id: s.id, name: s.name, price: c?.custom_price ? Number(c.custom_price) : Number(s.price) || 0, duration: Number(c?.custom_duration || s.duration) || 30 };
  });
  return { servicios, total: servicios.reduce((t, s) => t + s.price, 0), duracion: servicios.reduce((t, s) => t + s.duration, 0) };
}
