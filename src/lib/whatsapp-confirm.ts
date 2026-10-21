// Mensaje de WhatsApp para confirmar la hora de un cliente. Lo usan el boton de WhatsApp del
// Calendario y el de Mi Agenda, para que digan exactamente lo mismo.
//
// El texto es una plantilla que cada negocio puede cambiar en Mi negocio > Mensajes de WhatsApp
// (tenants.whatsapp_messages). Sin configurar, queda el mensaje de siempre:
//   Hola Matias! Te escribimos desde Estudio Levels para confirmar tu hora de Solo corte
//   Nicolas el jueves, 1 de octubre a las 10:00. Nos confirmas si asistirás? Gracias!
//
// Variables de la plantilla: {cliente} {negocio} {servicio} {profesional} {dia} {mes} {fecha} {hora}
// (y {abono} en el bloque de abono). El nombre del negocio viene siempre del negocio de quien esta
// logueado (nunca fijo en el codigo).
import { formatCurrency } from "@/lib/utils";

const normalize = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const firstWord = (t: string) => (t || "").trim().split(/\s+/)[0] || "";

export interface WhatsAppMessagesConfig {
  confirm_text: string;        // plantilla del mensaje de confirmacion
  deposit_enabled: boolean;    // ofrece la casilla "Solicitar abono" al enviar
  deposit_mode: "percent" | "fixed";
  deposit_value: number;       // % del total o monto fijo en pesos
  deposit_text: string;        // admite {abono}
  transfer_text: string;       // datos de transferencia (se agregan cuando se pide abono)
  welcome_enabled: boolean;    // ofrece la casilla "Agregar bienvenida"
  welcome_text: string;
  info_enabled: boolean;       // ofrece la casilla "Agregar informacion del servicio"
  info_text: string;
}

export const DEFAULT_CONFIRM_TEXT =
  "Hola {cliente}! Te escribimos desde {negocio} para confirmar tu hora de {servicio} con {profesional} el {fecha} a las {hora}. Nos confirmas si asistirás? Gracias!";

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppMessagesConfig = {
  confirm_text: DEFAULT_CONFIRM_TEXT,
  deposit_enabled: false,
  deposit_mode: "percent",
  deposit_value: 30,
  deposit_text: "Para dejar tu hora asegurada te pedimos un abono de {abono}.",
  transfer_text: "",
  welcome_enabled: false,
  welcome_text: "Bienvenido/a a {negocio}! Estamos felices de recibirte.",
  info_enabled: false,
  info_text: "Recuerda llegar 5 minutos antes de tu {servicio}.",
};

export const WHATSAPP_VARIABLES: { key: string; label: string }[] = [
  { key: "cliente", label: "Nombre del cliente" },
  { key: "negocio", label: "Nombre del negocio" },
  { key: "servicio", label: "Servicio" },
  { key: "profesional", label: "Profesional" },
  { key: "dia", label: "Día (martes 20)" },
  { key: "mes", label: "Mes" },
  { key: "fecha", label: "Fecha completa" },
  { key: "hora", label: "Hora" },
];

// Mezcla lo guardado con los valores de siempre (lo que falte o venga mal se reemplaza).
export function mergeWhatsAppConfig(raw: any): WhatsAppMessagesConfig {
  const d = DEFAULT_WHATSAPP_CONFIG;
  const s = (v: any, def: string) => (typeof v === "string" ? v : def);
  const b = (v: any, def: boolean) => (typeof v === "boolean" ? v : def);
  const r = raw && typeof raw === "object" ? raw : {};
  const value = Number(r.deposit_value);
  return {
    confirm_text: typeof r.confirm_text === "string" && r.confirm_text.trim() ? r.confirm_text : d.confirm_text,
    deposit_enabled: b(r.deposit_enabled, d.deposit_enabled),
    deposit_mode: r.deposit_mode === "fixed" ? "fixed" : "percent",
    deposit_value: Number.isFinite(value) && value > 0 ? value : d.deposit_value,
    deposit_text: s(r.deposit_text, d.deposit_text),
    transfer_text: s(r.transfer_text, d.transfer_text),
    welcome_enabled: b(r.welcome_enabled, d.welcome_enabled),
    welcome_text: s(r.welcome_text, d.welcome_text),
    info_enabled: b(r.info_enabled, d.info_enabled),
    info_text: s(r.info_text, d.info_text),
  };
}

export interface ConfirmWhatsAppInput {
  clientName?: string | null;
  phone?: string | null;
  businessName?: string | null;
  professionalName?: string | null;
  serviceNames?: string[];
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:MM
  totalPrice?: number | null; // suma de los servicios (para calcular el abono)
}

export interface WhatsAppSendOptions {
  deposit?: boolean; // agrega la solicitud de abono (+ datos de transferencia)
  info?: boolean;    // agrega la informacion del servicio
  welcome?: boolean; // agrega la bienvenida
}

function vars(input: ConfirmWhatsAppInput, abono: string): Record<string, string> {
  const d = new Date(input.date + "T12:00:00");
  const weekday = d.toLocaleDateString("es-CL", { weekday: "long" });
  return {
    cliente: firstWord(input.clientName || ""),
    negocio: (input.businessName || "").trim(),
    servicio: (input.serviceNames || []).filter(Boolean).join(", "),
    profesional: (input.professionalName || "").trim(),
    dia: `${weekday} ${d.getDate()}`,
    mes: d.toLocaleDateString("es-CL", { month: "long" }),
    fecha: d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }),
    hora: input.time?.match(/(\d{2}:\d{2})/)?.[1] || "",
    abono,
  };
}

// Reemplaza {variables}. Si una viene vacia se quita junto con su palabra de enlace
// ("de {servicio}", "con {profesional}", "desde {negocio}", "a las {hora}") para que no queden huecos.
function render(template: string, v: Record<string, string>): string {
  let t = template;
  // Muchos servicios ya llevan el nombre del profesional ("Solo corte Nicolas"): no se repite.
  const proFirst = normalize(firstWord(v.profesional));
  if (proFirst && normalize(v.servicio).includes(proFirst)) v = { ...v, profesional: "" };
  for (const key of Object.keys(v)) {
    if (v[key]) continue;
    t = t.replace(new RegExp(`(\\s+(?:de|con|desde|a las|el))?\\s*\\{${key}\\}`, "g"), "");
  }
  t = t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  return t.replace(/[ \t]{2,}/g, " ").replace(/ +([!?.,:;])/g, "$1").trim();
}

export function abonoAmount(cfg: WhatsAppMessagesConfig, total?: number | null): number {
  if (cfg.deposit_mode === "fixed") return Math.round(cfg.deposit_value);
  const t = Number(total) || 0;
  return t > 0 ? Math.round((t * cfg.deposit_value) / 100) : 0;
}

export function renderWhatsAppMessage(
  input: ConfirmWhatsAppInput,
  cfg: WhatsAppMessagesConfig = DEFAULT_WHATSAPP_CONFIG,
  opts: WhatsAppSendOptions = {},
): string {
  const amount = abonoAmount(cfg, input.totalPrice);
  const v = vars(input, amount > 0 ? formatCurrency(amount) : "");
  const parts: string[] = [];
  if (opts.welcome && cfg.welcome_text.trim()) parts.push(render(cfg.welcome_text, v));
  parts.push(render(cfg.confirm_text, v));
  if (opts.info && cfg.info_text.trim()) parts.push(render(cfg.info_text, v));
  if (opts.deposit) {
    const dep = [cfg.deposit_text.trim() ? render(cfg.deposit_text, v) : "", cfg.transfer_text.trim()].filter(Boolean).join("\n");
    if (dep) parts.push(dep);
  }
  return parts.join("\n\n");
}

export function buildConfirmWhatsAppUrl(
  input: ConfirmWhatsAppInput,
  cfg: WhatsAppMessagesConfig = DEFAULT_WHATSAPP_CONFIG,
  opts: WhatsAppSendOptions = {},
): string | null {
  const raw = String(input.phone || "").replace(/\D/g, "").replace(/^0/, "");
  if (!raw) return null;
  const phone = raw.startsWith("56") ? raw : `56${raw}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(renderWhatsAppMessage(input, cfg, opts))}`;
}
