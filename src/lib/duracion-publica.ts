// Dos duraciones por servicio: la de la AGENDA (services.duration, o la propia del profesional) y la que VE EL CLIENTE
// (services.public_duration, migración 187). Sin la segunda, el cliente ve la de la agenda. La agenda nunca usa la pública.

export const MENSAJE_MIGRACION_187 = "Falta aplicar la migración 187 para guardar la duración que ve el cliente.";

/** Lo que llega del formulario: null = igual que la agenda; undefined = valor inválido. */
export function limpiarDuracionPublica(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 5 && n <= 600 ? n : undefined;
}

/** id del servicio -> duración que ve el cliente (solo los que la tienen). Sin la migración 187, vacío. */
export async function duracionesPublicas(sb: any, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const { data, error } = await sb.from("services").select("id, public_duration").in("id", ids);
  if (error) return new Map();
  return new Map(((data || []) as any[]).filter((s) => Number(s.public_duration) > 0).map((s) => [s.id, Number(s.public_duration)]));
}

/** Agrega `publicDuration` a cada servicio (la pública si la tiene; si no, la de la agenda). */
export async function conDuracionPublica<T extends { id: string; duration: number }>(sb: any, servicios: T[]): Promise<Array<T & { publicDuration: number }>> {
  const m = await duracionesPublicas(sb, servicios.map((s) => s.id));
  return servicios.map((s) => ({ ...s, publicDuration: m.get(s.id) ?? Number(s.duration) }));
}

/** Duración que se le informa al cliente de una cita. Si ningún servicio tiene duración pública, la que venía. */
export async function duracionVisibleDeCita(sb: any, appointmentId: string, porDefecto: number): Promise<number> {
  try {
    const { data, error } = await sb.from("appointment_services").select("service:services(duration, public_duration)").eq("appointment_id", appointmentId);
    const l = ((data || []) as any[]).map((x) => x.service).filter(Boolean);
    if (error || !l.some((s) => Number(s.public_duration) > 0)) return porDefecto;
    return l.reduce((n, s) => n + (Number(s.public_duration) || Number(s.duration) || 0), 0);
  } catch { return porDefecto; }
}
