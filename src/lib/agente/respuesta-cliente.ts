export type RespuestaCliente = "confirmar" | "cancelar" | "no_quiero_mensajes" | "desconocido";

// HECHO del contrato local: no devuelve texto ni contexto de identidad/cita.
// Solo clasifica; nunca autoriza, escribe, registra ni envía. No se conecta a rutas.
// INFERENCIA de diseño conservador: lista cerrada de frases completas; todo lo demás se abstiene.
// "sí", "ok", emojis y preguntas sin contexto no son confirmación ni cancelación inequívocas.
const CONFIRMAR = new Set([
  "confirmo", "confirmar", "confirmo mi cita", "confirmo la cita", "confirmo asistencia",
  "confirmo mi asistencia", "quiero confirmar mi cita", "si confirmo", "si confirmo mi cita",
]);
const CANCELAR = new Set([
  "cancelo", "cancelar", "cancelo mi cita", "cancelo la cita", "quiero cancelar mi cita",
  "quiero cancelar la cita", "necesito cancelar mi cita", "deseo cancelar mi cita",
]);
const BAJA = new Set([
  "baja", "stop", "darme de baja", "quiero darme de baja", "no quiero mensajes",
  "no quiero mas mensajes", "no quiero recibir mensajes", "no quiero recibir mas mensajes",
  "no deseo recibir mensajes", "no deseo recibir mas mensajes", "no me contacten",
  "no me escriban", "dejen de escribirme", "dejen de enviarme mensajes",
  "no me manden mas mensajes", "no enviar mas mensajes", "dejar de recibir mensajes",
]);

export function clasificarRespuestaCliente(texto: unknown): RespuestaCliente {
  // No convertir objetos a string: podría ejecutar código externo o reflejar datos privados.
  if (typeof texto !== "string" || texto.length === 0 || texto.length > 160) return "desconocido";
  // Caracteres invisibles de formato (p.ej. bidi/zero-width) no se eliminan para aceptar órdenes ocultas.
  if (/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(texto)) return "desconocido";
  const normalizado = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(?:\.|!+)$/, "")
    .trim();

  // No usar búsqueda parcial: "no confirmo", "confirmo pero..." y texto adicional quedan fuera.
  // Dígitos, emojis, signos de pregunta, citas y alfabetos ajenos no forman parte del contrato.
  if (!/^[a-z]+(?: [a-z]+)*$/.test(normalizado)) return "desconocido";
  if (BAJA.has(normalizado)) return "no_quiero_mensajes";
  if (CONFIRMAR.has(normalizado)) return "confirmar";
  if (CANCELAR.has(normalizado)) return "cancelar";
  return "desconocido";
}
