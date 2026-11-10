// Embudo de ventas de las visitas que llegan por un link de vendedor o creador. Puro: se prueba sin base de datos.
// Solo datos anonimos (id de visita al azar, paso, dispositivo, ciudad aproximada). Nunca IP, correo, telefono ni nombres.
export const PASOS = ["landing_view", "precios_view", "plan_click", "checkout_open", "form_started", "pay_click"] as const;
export type Paso = (typeof PASOS)[number] | "pay_error";
export const PASOS_VALIDOS: string[] = [...PASOS, "pay_error"];
export const ETIQUETA_PASO: Record<string, string> = {
  landing_view: "Entraron a la página",
  precios_view: "Vieron los precios",
  plan_click: "Eligieron un plan",
  checkout_open: "Abrieron el formulario de pago",
  form_started: "Empezaron a llenar sus datos",
  pay_click: "Pulsaron «Continuar con Mercado Pago»",
  paid: "Pagaron",
};

export type Dispositivo = { device: "celular" | "tablet" | "computador"; os: string; browser: string };
export function parseUserAgent(ua: string): Dispositivo {
  const s = ua || "";
  const device = /iPad|Tablet|PlayBook/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s)) ? "tablet" : /Mobi|iPhone|Android|iPod/i.test(s) ? "celular" : "computador";
  const os = /iPhone|iPad|iPod/i.test(s) ? "iOS" : /Android/i.test(s) ? "Android" : /Windows/i.test(s) ? "Windows" : /Mac OS X|Macintosh/i.test(s) ? "macOS" : /Linux/i.test(s) ? "Linux" : "Otro";
  const browser = /Instagram/i.test(s) ? "Instagram (dentro de la app)" : /FBAN|FBAV|FB_IAB/i.test(s) ? "Facebook (dentro de la app)" : /TikTok|musical_ly/i.test(s) ? "TikTok (dentro de la app)" : /EdgA?\//i.test(s) ? "Edge" : /OPR\/|Opera/i.test(s) ? "Opera" : /SamsungBrowser/i.test(s) ? "Samsung Internet" : /Firefox|FxiOS/i.test(s) ? "Firefox" : /CriOS|Chrome/i.test(s) ? "Chrome" : /Safari/i.test(s) ? "Safari" : "Otro";
  return { device, os, browser };
}

export type EventoEmbudo = { created_at: string; visit_id: string; step: string; source?: string | null; campaign?: string | null; plan?: string | null; device?: string | null; os?: string | null; browser?: string | null; city?: string | null };
export type Solicitud = { status: string; amount: number | null; plan?: string | null; created_at?: string | null; ad_attribution?: any };

const top = (m: Map<string, number>, n = 5) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([nombre, cantidad]) => ({ nombre, cantidad }));
const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Hora y dia de la semana en Chile (no en UTC), para saber cuando conviene publicar o enviar el link.
export function horaChile(iso: string): { hora: number; dia: number } {
  const d = new Date(iso);
  const hora = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", hour12: false }).format(d)) % 24;
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", weekday: "short" }).format(d);
  return { hora, dia: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) };
}

export function analizarEmbudo(eventos: EventoEmbudo[], solicitudes: Solicitud[]) {
  // Visitas unicas por paso
  const porPaso = new Map<string, Set<string>>();
  for (const e of eventos) { if (!porPaso.has(e.step)) porPaso.set(e.step, new Set()); porPaso.get(e.step)!.add(e.visit_id); }
  const pagaron = solicitudes.filter((s) => s.status === "paid").length;
  const filas = PASOS.map((p) => ({ paso: p, etiqueta: ETIQUETA_PASO[p], visitas: porPaso.get(p)?.size || 0 }));
  const embudo = [...filas, { paso: "paid" as const, etiqueta: ETIQUETA_PASO.paid, visitas: pagaron }].map((f, i, arr) => {
    const anterior = i === 0 ? null : arr[i - 1].visitas;
    const pasan = anterior && anterior > 0 ? Math.round((f.visitas / anterior) * 100) : null;
    return { ...f, pasanDelAnterior: pasan, seQuedan: anterior != null && anterior >= f.visitas ? anterior - f.visitas : 0 };
  });
  // Donde se pierde mas gente (solo cuando el paso anterior tiene volumen suficiente)
  const candidatos = embudo.filter((f, i) => i > 0 && embudo[i - 1].visitas >= 5 && f.seQuedan > 0);
  const peor = candidatos.sort((a, b) => b.seQuedan - a.seQuedan)[0];
  const mayorCaida = peor ? { entre: `${ETIQUETA_PASO[embudo[embudo.indexOf(peor) - 1].paso]} → ${peor.etiqueta}`, seQuedan: peor.seQuedan, pct: 100 - (peor.pasanDelAnterior ?? 0) } : null;

  // Cuando llegan (landing_view) y cuando compran (solicitudes pagadas)
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, visitas: 0, pagos: 0 }));
  const dias = DIAS.map((nombre) => ({ nombre, visitas: 0, pagos: 0 }));
  for (const e of eventos.filter((x) => x.step === "landing_view")) { const t = horaChile(e.created_at); horas[t.hora].visitas++; dias[t.dia].visitas++; }
  for (const s of solicitudes.filter((x) => x.status === "paid" && x.created_at)) { const t = horaChile(String(s.created_at)); horas[t.hora].pagos++; dias[t.dia].pagos++; }
  const mejoresHoras = horas.filter((h) => h.visitas > 0).sort((a, b) => b.visitas - a.visitas).slice(0, 3).map((h) => `${String(h.hora).padStart(2, "0")}:00`);

  // Dispositivos, sistemas, navegadores y ciudades: una vez por visita
  const vistas = new Map<string, EventoEmbudo>();
  for (const e of eventos) if (!vistas.has(e.visit_id)) vistas.set(e.visit_id, e);
  const dev = new Map<string, number>(), os = new Map<string, number>(), nav = new Map<string, number>(), ciu = new Map<string, number>(), plan = new Map<string, number>();
  for (const e of Array.from(vistas.values())) { inc(dev, e.device || "desconocido"); inc(os, e.os || "desconocido"); inc(nav, e.browser || "desconocido"); inc(ciu, e.city || "desconocida"); }
  for (const e of eventos.filter((x) => x.step === "plan_click" && x.plan)) inc(plan, String(e.plan));

  return {
    visitas: vistas.size, pagaron, embudo, mayorCaida,
    horas, dias, mejoresHoras,
    dispositivos: top(dev), sistemas: top(os), navegadores: top(nav), ciudades: top(ciu, 6), planes: top(plan),
    errores: new Set(eventos.filter((e) => e.step === "pay_error").map((e) => e.visit_id)).size,
  };
}
