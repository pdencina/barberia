// Envío masivo de correos por tandas que se puede detener y reanudar. Lo pendiente queda guardado en este equipo.
export const TANDA = 60;

export interface EnvioPendiente {
  cuerpo: Record<string, any>;  // lo que se envía (mensaje, cupón, diseño…), tal como estaba al confirmar
  pendientes: string[];         // clientes que faltan
  enviados: number;
  total: number;
  campaignId: string | null;
  creado: string;               // ISO
}

export const clavePendiente = (tenantId: string) => `rb_envio_pendiente_${tenantId}`;
export function leerPendiente(clave: string): EnvioPendiente | null {
  try {
    const x = JSON.parse(localStorage.getItem(clave) || "null");
    return x && Array.isArray(x.pendientes) && x.pendientes.length && x.cuerpo ? x : null;
  } catch { return null; }
}
export function guardarPendiente(clave: string, e: EnvioPendiente | null) {
  try { if (e && e.pendientes.length) localStorage.setItem(clave, JSON.stringify(e)); else localStorage.removeItem(clave); } catch { /* sin almacenamiento */ }
}

export type FinEnvio = "completo" | "detenido" | "sin_cupo" | "proveedor" | "error";

/** Envía tanda por tanda. Después de cada una guarda lo que falta, así nunca se repite un correo al reanudar. */
export async function correrEnvio(
  envio: EnvioPendiente,
  o: {
    pedir: (cuerpo: Record<string, any>) => Promise<{ ok: boolean; data: any }>;
    detener: () => boolean;
    guardar: (e: EnvioPendiente) => void;
    avance?: (e: EnvioPendiente) => void;
  },
): Promise<{ fin: FinEnvio; envio: EnvioPendiente; error?: string }> {
  let e = { ...envio, pendientes: [...envio.pendientes] };
  while (e.pendientes.length) {
    if (o.detener()) return { fin: "detenido", envio: e };
    o.avance?.(e);
    const soloIds = e.pendientes.slice(0, TANDA);
    let r: { ok: boolean; data: any };
    try { r = await o.pedir({ ...e.cuerpo, soloIds, campaignId: e.campaignId }); }
    catch { return { fin: "error", envio: e, error: "Se cortó la conexión." }; }
    if (!r.ok) return { fin: "error", envio: e, error: r.data?.error || "Error al enviar" };
    const sent = Number(r.data?.sent) || 0;
    if (r.data?.total > 0 && !sent) return { fin: "proveedor", envio: e };
    if (r.data?.quotaExceeded) return { fin: "sin_cupo", envio: { ...e, enviados: e.enviados + sent } };
    e = { ...e, enviados: e.enviados + sent, campaignId: r.data?.campaignId || e.campaignId, pendientes: e.pendientes.slice(soloIds.length) };
    o.guardar(e);
  }
  return { fin: "completo", envio: e };
}
