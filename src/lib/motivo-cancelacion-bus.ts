// Pide el motivo al cancelar una cita desde cualquier pantalla del panel. El cuadro vive en el layout
// (MotivoCancelacionHost); cada pantalla solo hace: const motivo = await pedirMotivoCancelacion(); if (motivo === false) return;
type Pedido = (resolve: (v: string | false) => void) => void;
let anfitrion: Pedido | null = null;

export const registrarAnfitrionMotivo = (fn: Pedido | null) => { anfitrion = fn; };

// Devuelve la clave del motivo, o false si el usuario se arrepintió. Sin cuadro disponible, no bloquea la cancelación.
export const pedirMotivoCancelacion = (): Promise<string | false> =>
  new Promise((resolve) => { if (anfitrion) anfitrion(resolve); else resolve(""); });
