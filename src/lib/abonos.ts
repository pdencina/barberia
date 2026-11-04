// Estado de cada abono recibido por reserva (tabla booking_deposits). Puro: se prueba sin base de datos.
export type EstadoAbono = "recibido" | "por_devolver" | "devuelto" | "no_aprobado";

export function clasificarAbono(status: string | null | undefined): EstadoAbono {
  const s = String(status ?? "");
  if (s === "approved") return "recibido";
  if (s === "needs_refund") return "por_devolver";
  if (s === "refunded") return "devuelto";
  return "no_aprobado"; // «rejected:…», «pending:…», «cancelled:…»…
}

export const ETIQUETA_ESTADO: Record<EstadoAbono, string> = { recibido: "Recibido", por_devolver: "Por devolver", devuelto: "Devuelto", no_aprobado: "No aprobado" };

// Solo se puede devolver lo recibido o lo marcado «por devolver».
export const sePuedeDevolver = (status: string | null | undefined) => { const e = clasificarAbono(status); return e === "recibido" || e === "por_devolver"; };

export function totalesAbonos(items: Array<{ status: string; amount: number }>) {
  const t = { recibido: 0, por_devolver: 0, devuelto: 0, intentosNoAprobados: 0 };
  for (const i of items) {
    const e = clasificarAbono(i.status), n = Math.max(0, Math.round(Number(i.amount) || 0));
    if (e === "recibido") t.recibido += n; else if (e === "por_devolver") t.por_devolver += n; else if (e === "devuelto") t.devuelto += n; else t.intentosNoAprobados++;
  }
  return t;
}
