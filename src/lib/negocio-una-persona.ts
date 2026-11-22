// Negocio de UNA sola persona (un solo profesional activo que atiende clientes, sea cual sea su plan): ahi el «Horario del negocio» que configuro el dueño manda
// sobre el horario del profesional, porque son lo mismo. En un negocio con varios profesionales no cambia nada: cada uno sigue con su propio horario.
export interface HorarioNegocioDia { is_closed: boolean | null; open_time: string | null; close_time: string | null }

const minutos = (t: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Recorta el horario del profesional con el del negocio. `negocio` = la fila del negocio para ese dia (o null si no la tiene: no se recorta nada).
export function limitarPorNegocio(
  prof: { open: string; close: string },
  negocio: HorarioNegocioDia | null | undefined,
): { closed: true } | { closed: false; open: string; close: string } {
  if (!negocio) return { closed: false, open: prof.open, close: prof.close };
  if (negocio.is_closed) return { closed: true };
  const po = minutos(prof.open), pc = minutos(prof.close), no = minutos(negocio.open_time), nc = minutos(negocio.close_time);
  if (po === null || pc === null || no === null || nc === null) return { closed: false, open: prof.open, close: prof.close };
  const open = Math.max(po, no), close = Math.min(pc, nc);
  if (close <= open) return { closed: true };
  return { closed: false, open: hhmm(open), close: hhmm(close) };
}

// ¿El negocio de este profesional es de una sola persona? (un solo profesional activo que atiende clientes)
export async function esNegocioDeUnaPersona(supabase: any, tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  try {
    const { data } = await supabase.from("profiles").select("id, role, also_attends_clients").eq("tenant_id", tenantId).eq("active", true).in("role", ["barber", "admin"]);
    const atienden = ((data as any[]) || []).filter((p) => p.role === "barber" || p.also_attends_clients);
    return atienden.length === 1;
  } catch { return false; }
}
