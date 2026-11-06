// Pide el motivo al cancelar una cita desde cualquier pantalla del panel. El cuadro vive en el layout
// (MotivoCancelacionHost); cada pantalla solo hace: const m = await pedirMotivoCancelacion(); if (m === false) return; y manda m.motivo y m.nota.
export interface MotivoElegido { motivo: string; nota: string }
type Pedido = (resolve: (v: MotivoElegido | false) => void) => void;
let anfitrion: Pedido | null = null;

export const registrarAnfitrionMotivo = (fn: Pedido | null) => { anfitrion = fn; };

// Devuelve el motivo (y su texto si es «Otro motivo»), o false si el usuario se arrepintió. Sin cuadro disponible no se puede cancelar:
// el servidor exige un motivo, así que se devuelve false en vez de seguir sin él.
export const pedirMotivoCancelacion = (): Promise<MotivoElegido | false> =>
  new Promise((resolve) => { if (anfitrion) anfitrion(resolve); else resolve(false); });

// Campos para el cuerpo de la petición PATCH.
export const camposMotivo = (m: MotivoElegido) => ({ cancel_reason: m.motivo, ...(m.motivo === "otro" ? { cancel_note: m.nota } : {}) });
