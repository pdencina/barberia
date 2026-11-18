// Simulador de conversaciones del agente con los datos REALES de un negocio (instantánea JSON, sin red ni llaves).
// Uso: npx tsx scripts/simulador-conversacion.ts <instantanea.json> [guion.json]
// El guion es una lista de conversaciones: [{ "titulo": "...", "mensajes": ["hola", {"boton":"c_malla"}, ...] }].
// La IA se simula apagada: lo que llegaría a la IA se marca como "→ IA". Las horas libres se inventan (pero con la regla de la reserva real no se usa).
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { crearManejadoresWebhook, type DependenciasWebhook } from "../src/lib/agente/whatsapp-webhook";
import { crearRepositorioDatosNegocio } from "../src/lib/agente/datos-negocio";
import { archivosPedidos } from "../src/lib/agente/archivos";
import type { EventoUso } from "../src/lib/agente/limite-de-uso";

const snap = JSON.parse(readFileSync(process.argv[2], "utf8"));
const guion = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")) : [];
const AHORA = Date.UTC(2026, 10, 19, 15, 0); // jueves 19-nov-2026, 12:00 Chile
const secret = "s", salt = "x", phone = "56911112222", TENANT = "T1";
let serial = 0;
const payload = (m: Record<string, unknown>) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "1001" }, messages: [{ id: `in.${++serial}`, from: phone, type: "text", ...m }] } }] }] });
const request = (p: unknown) => { const b = JSON.stringify(p); return new Request("https://t.invalid/w", { method: "POST", body: b, headers: { "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(b).digest("hex")}` } }); };

function crear() {
  const sent: string[] = [], extras: string[] = [], notices: string[] = [], events: any[] = [];
  const memoria = new Map<string, any>(); const citas: any[] = [];
  const dia = (n: number) => { const d = new Date(AHORA + n * 86400000); return d.toISOString().slice(0, 10); };
  const tables: Record<string, any[]> = {
    tenants: [{ id: TENANT, name: snap.tenant.name, slug: snap.tenant.slug, address: snap.tenant.address, phone: snap.tenant.phone, active: true }],
    business_hours: snap.horas.map((h: any, i: number) => ({ id: `h${i}`, tenant_id: TENANT, day_of_week: h.dia, is_closed: h.cerrado, open_time: h.abre, close_time: h.cierra })),
    services: snap.servicios.map((s: any, i: number) => ({ id: `s${i}`, tenant_id: TENANT, name: s[0], price: s[1], duration: s[2], active: true })),
    branches: (snap.sucursales ?? []).map((b: any, i: number) => ({ id: `b${i}`, tenant_id: TENANT, name: b[0], address: b[1], active: true })),
    profiles: snap.profesionales.map((p: any) => ({ id: p[0], tenant_id: TENANT, name: p[1], booking_slug: p[2], active: true, role: "barber", also_attends_clients: false, slot_duration: p[3] })),
    agent_faq_custom: [],
  };
  const db = { from(table: string) {
    const filters: [string, unknown][] = []; let single = false, from = 0, to = 999;
    const chain: any = { select: () => chain, eq: (k: string, v: unknown) => { filters.push([k, v]); return chain; }, order: () => chain, limit: () => chain,
      range: (a: number, b: number) => { from = a; to = b; return chain; }, maybeSingle: () => { single = true; return chain; },
      then: (res: any) => { const rows = (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v)).slice(from, to + 1); res({ data: single ? rows[0] ?? null : rows, error: null }); } };
    return chain; } };
  const repoDatos = crearRepositorioDatosNegocio(db, { enlace: async () => `https://www.re-booking.cl/${snap.tenant.slug}` });
  const deps: DependenciasWebhook = {
    ahora: () => AHORA,
    repo: {
      negocio: async (id: string) => id === "1001" ? { tenantId: TENANT, phoneNumberId: id, enabled: true } : null,
      admitir: async (e: any) => { const c = events.filter((x) => x.contactHash === e.contactHash); events.push({ ...e, atMs: e.ahora }); return { repetido: false, historial: c.filter((x) => x.atMs > e.ahora - 3600000) as EventoUso[], consecutivos: 0 }; },
      terminar: async () => {}, baja: async () => false, guardarBaja: async () => {}, reclamarAviso: async () => true, referenciaAlternativa: async () => null, referencia: async () => null,
    } as any,
    accion: async () => ({ motivo: "ok" } as any),
    responder: async (_n: any, _p: any, t: string) => { sent.push(t); },
    avisarAdministrador: async (t: string) => { notices.push(t); },
    datosDelNegocio: repoDatos.datosDelNegocio,
  } as any;
  // Horas libres inventadas pero razonables: cada profesional libre en bloques de su tiempo, salvo algunas ocupadas. Hoy ya pasó la mañana.
  (deps as any).horasLibres = async (id: string, fecha: string, dur: number) => {
    const d = new Date(fecha + "T12:00:00Z").getUTCDay(); const [ab, ci] = d === 0 ? [12, 18] : d === 6 ? [9, 17] : [10, 20];
    const slots: string[] = []; const ocupadas = new Set([id.charCodeAt(0) % 5, (id.charCodeAt(1) % 5) + 5]);
    for (let m = ab * 60, i = 0; m + dur <= ci * 60; m += dur, i++) { if (ocupadas.has(i % 10)) continue; if (fecha === dia(0) && m < 14 * 60) continue; slots.push(`${fecha}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`); }
    return { slots, cerrado: false, fueraDeVentana: false };
  };
  (deps as any).chat = {
    leerEstado: async (t: string, c: string) => memoria.get(t + c) ?? null, guardarEstado: async (t: string, c: string, e: any) => { memoria.set(t + c, e); }, borrarEstado: async (t: string, c: string) => { memoria.delete(t + c); },
    reservasFuturas: async () => citas.length, detalleFuturas: async () => citas.map((c) => ({ profesional: c.nombre, fecha: c.fecha, hora: c.hora })),
    crearReserva: async (_t: string, a: any) => { citas.push({ nombre: snap.profesionales.find((p: any) => p[0] === a.profesionalId)?.[1] ?? "?", fecha: a.fecha, hora: a.hora }); return { ok: true, citaId: "c" + citas.length }; },
    contar: async () => {},
  };
  (deps as any).conMenu = true; (deps as any).conCta = true; (deps as any).derivarAlTelefono = true;
  (deps as any).ia = async () => null;
  (deps as any).responderLista = async (_n: any, _p: any, l: any) => { sent.push(`[LISTA] ${l.cuerpo.replace(/\n+/g, " / ")}  {${l.filas.map((f: any) => f.title).join(" | ")}}`); return { estado: "aceptado" }; };
  (deps as any).archivos = { pedidos: (c: string, l: string) => archivosPedidos(c, l), enviar: async (_n: any, _p: any, a: any) => { extras.push(`[ARCHIVO] ${a.nombre}`); } };
  const h = crearManejadoresWebhook({ secretoFirma: secret, tokenVerificacion: "v", salHashes: salt, crearDependencias: () => deps });
  return { sent, extras, notices, async enviar(m: any) {
    const antes = sent.length; extras.length = 0; const nAv = notices.length;
    const msg = typeof m === "string" ? { text: { body: m } } : m.boton ? { type: "interactive", interactive: { type: "list_reply", list_reply: { id: m.boton, title: m.boton } } } : m.raw;
    await h.POST(request(payload(msg)));
    const resp = sent.slice(antes).join("\n   ");
    return (resp || "(sin respuesta → iría a la IA o se ignora)") + (extras.length ? "\n   " + extras.join(" ") : "") + (notices.length > nAv ? "\n   [AVISA A ADMIN]" : "");
  } };
}

(async () => {
  for (const conv of guion) {
    console.log(`\n=== ${conv.titulo}`);
    const s = crear();
    for (const m of conv.mensajes) {
      const txt = typeof m === "string" ? m : m.boton ? `<botón ${m.boton}>` : JSON.stringify(m.raw);
      console.log(`  👤 ${txt}\n  🤖 ${await s.enviar(m)}`);
    }
  }
})();
