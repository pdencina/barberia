import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";

// Curso de barbería de Estudio Levels: evaluación práctica de desempeño (documento Word del negocio).
export const CRITERIOS = [
  { key: "presencia", nombre: "Presencia", desc: "Imagen personal, higiene, presentación general." },
  { key: "postura", nombre: "Postura", desc: "Posición corporal, ergonomía y control durante el servicio." },
  { key: "asesoria", nombre: "Claridad en la asesoría", desc: "Capacidad de explicar el servicio y orientar al cliente." },
  { key: "servicio", nombre: "Servicio al cliente", desc: "Trato, comunicación, respeto y experiencia entregada." },
  { key: "eficiencia", nombre: "Eficiencia", desc: "Uso del tiempo, orden y fluidez del trabajo." },
  { key: "tecnica", nombre: "Técnica", desc: "Dominio de herramientas, precisión y ejecución." },
  { key: "profesionalismo", nombre: "Profesionalismo", desc: "Actitud, responsabilidad y comportamiento." },
] as const;
export const ESCALA = "1 = Deficiente  |  3 = Básico  |  5 = Bueno  |  7 = Excelente";

// Negocio dueño del curso. En pruebas se cambia con ALUMNOS_TENANT_ID.
export function tenantAlumnos(): string {
  return process.env.ALUMNOS_TENANT_ID || "c81dce57-211e-46fe-b5ac-704d01912bcf";
}

const COOKIE = "alumnos_sesion";
const DURACION_S = 60 * 60 * 12;

function secreto(): string {
  return (process.env.PIN_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "") + ":alumnos";
}
function firmar(data: string): string {
  return createHmac("sha256", secreto()).update(data).digest("hex");
}
// Código de acceso: scrypt con sal propia ("sal:huella"), así se puede sembrar sin conocer ningún secreto del servidor.
export function hashCodigo(codigo: string, sal = randomBytes(8).toString("hex")): string {
  return `${sal}:${scryptSync(codigo, sal, 32).toString("hex")}`;
}
export function codigoValido(codigo: string, guardado: string): boolean {
  const [sal] = guardado.split(":");
  if (!sal) return false;
  const a = Buffer.from(hashCodigo(codigo, sal)), b = Buffer.from(guardado);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function crearToken(evaluatorId: string): string {
  const exp = Math.floor(Date.now() / 1000) + DURACION_S;
  const d = `${evaluatorId}.${exp}`;
  return `${d}.${firmar(d)}`;
}
export const cookieAlumnos = { name: COOKIE, maxAge: DURACION_S };

// Devuelve al evaluador de la sesión (cookie firmada) o null. Nunca se confía en datos del navegador.
export async function evaluadorActual(): Promise<{ id: string; name: string } | null> {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return null;
  const [id, exp, sig] = t.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  const esperado = firmar(`${id}.${exp}`);
  const a = Buffer.from(sig), b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const { data } = await createAdminSupabase()
    .from("course_evaluators").select("id,name,active")
    .eq("id", id).eq("tenant_id", tenantAlumnos()).maybeSingle();
  if (!data || !data.active) return null;
  return { id: data.id, name: data.name };
}

export function calcular(scores: any): { ok: true; scores: Record<string, number>; total: number; average: number } | { ok: false } {
  if (!scores || typeof scores !== "object") return { ok: false };
  const out: Record<string, number> = {};
  let total = 0;
  for (const c of CRITERIOS) {
    const v = scores[c.key];
    if (!Number.isInteger(v) || v < 1 || v > 7) return { ok: false };
    out[c.key] = v;
    total += v;
  }
  return { ok: true, scores: out, total, average: Math.round((total / 7) * 100) / 100 };
}

// Notas parciales (borrador): solo claves conocidas con enteros 1 a 7. Devuelve la suma de lo puesto.
export function parcial(scores: any): { scores: Record<string, number>; total: number } | null {
  if (!scores || typeof scores !== "object") return { scores: {}, total: 0 };
  const out: Record<string, number> = {};
  let total = 0;
  for (const c of CRITERIOS) {
    const v = scores[c.key];
    if (v === undefined || v === null) continue;
    if (!Number.isInteger(v) || v < 1 || v > 7) return null;
    out[c.key] = v; total += v;
  }
  return { scores: out, total };
}

// Comentarios: cada salto de línea es un punto aparte (se quitan guiones/viñetas escritos a mano).
export function lineas(texto: string | null | undefined): string[] {
  return String(texto || "").split(/\r?\n/).map((l) => l.replace(/^\s*[-•*–]+\s*/, "").trim()).filter(Boolean);
}
function comentariosHtml(texto: string | null | undefined, titulo = "Comentarios del instructor"): string {
  const ls = lineas(texto);
  if (!ls.length) return "";
  return `<div style="background:#1a1a1a;border-radius:8px;padding:14px;margin-top:12px;"><p style="color:#888;font-size:11px;text-transform:uppercase;margin:0 0 8px;">${esc(titulo)}</p>${ls.map((l) => `<p style="color:#ccc;font-size:14px;margin:0 0 8px;padding-left:14px;text-indent:-14px;">• ${esc(l)}</p>`).join("")}</div>`;
}

// Etiqueta única por evaluación (nombre de quien evaluó; si se repite, con la fecha).
export function etiquetas(evs: any[]): string[] {
  const cuenta: Record<string, number> = {};
  evs.forEach((e) => (cuenta[e.evaluator_name] = (cuenta[e.evaluator_name] || 0) + 1));
  return evs.map((e) => (cuenta[e.evaluator_name] > 1 ? `${e.evaluator_name} (${new Date(e.created_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })})` : e.evaluator_name));
}
export function unificar(evs: any[]) {
  const n = evs.length;
  const porCriterio = CRITERIOS.map((c) => Math.round((evs.reduce((a, e) => a + (e.scores[c.key] || 0), 0) / n) * 100) / 100);
  const promedio = Math.round((evs.reduce((a, e) => a + Number(e.average), 0) / n) * 100) / 100;
  const total = Math.round((evs.reduce((a, e) => a + e.total, 0) / n) * 100) / 100;
  return { porCriterio, promedio, total };
}

export function fechaCL(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "long", timeStyle: "short" });
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function correoEvaluacionHtml(ev: any, alumno: string): string {
  const filas = CRITERIOS.map((c) =>
    `<tr><td style="padding:8px 0;color:#ccc;font-size:14px;border-bottom:1px solid #222;">${c.nombre}</td><td style="padding:8px 0;color:#fff;font-weight:bold;text-align:right;border-bottom:1px solid #222;">${ev.scores[c.key]} / 7</td></tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a;">
  <div style="background: #111; padding: 30px; border-radius: 12px; border: 1px solid #333;">
    <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #0F8B8D; padding-bottom: 16px;">
      <p style="color:#fff;font-size:20px;font-weight:bold;margin:0;">Estudio Levels</p>
      <p style="color: #0F8B8D; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Evaluación práctica de desempeño</p>
    </div>
    <p style="color: #ccc; font-size: 16px;">Hola <strong style="color: #fff;">${esc(alumno)}</strong>, estos son los resultados de tu evaluación.</p>
    <p style="color:#888;font-size:13px;">Evaluó: <strong style="color:#fff;">${esc(ev.evaluator_name)}</strong> · ${esc(fechaCL(ev.created_at))}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">${filas}</table>
    <p style="color:#fff;font-size:16px;margin:12px 0;">Suma: <strong>${ev.total} / 49</strong> &nbsp;·&nbsp; Nota promedio: <strong style="color:#0F8B8D;">${Number(ev.average).toFixed(2)} / 7</strong></p>
    ${comentariosHtml(ev.comments)}
    <p style="color:#555;font-size:12px;text-align:center;margin-top:24px;">Adjuntamos tu evaluación en PDF.</p>
  </div>
</body></html>`;
}

export function correoUnificadoHtml(evs: any[], alumno: string): string {
  const et = etiquetas(evs);
  const u = unificar(evs);
  const th = (t: string) => `<th style="padding:8px 4px;color:#0F8B8D;font-size:12px;text-align:center;border-bottom:1px solid #333;">${esc(t)}</th>`;
  const filas = CRITERIOS.map((c, i) =>
    `<tr><td style="padding:8px 0;color:#ccc;font-size:14px;border-bottom:1px solid #222;">${c.nombre}</td>${evs.map((e) => `<td style="padding:8px 4px;color:#fff;text-align:center;border-bottom:1px solid #222;">${e.scores[c.key]}</td>`).join("")}<td style="padding:8px 4px;color:#0F8B8D;font-weight:bold;text-align:center;border-bottom:1px solid #222;">${u.porCriterio[i].toFixed(2)}</td></tr>`).join("");
  const filaTot = `<tr><td style="padding:8px 0;color:#fff;font-weight:bold;">Nota promedio</td>${evs.map((e) => `<td style="padding:8px 4px;color:#fff;font-weight:bold;text-align:center;">${Number(e.average).toFixed(2)}</td>`).join("")}<td style="padding:8px 4px;color:#0F8B8D;font-weight:bold;text-align:center;">${u.promedio.toFixed(2)}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a;">
  <div style="background: #111; padding: 30px; border-radius: 12px; border: 1px solid #333;">
    <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #0F8B8D; padding-bottom: 16px;">
      <p style="color:#fff;font-size:20px;font-weight:bold;margin:0;">Estudio Levels</p>
      <p style="color: #0F8B8D; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Evaluación práctica unificada</p>
    </div>
    <p style="color: #ccc; font-size: 16px;">Hola <strong style="color: #fff;">${esc(alumno)}</strong>, estos son los resultados de tus evaluaciones.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><th></th>${et.map(th).join("")}${th("Promedio")}</tr>${filas}${filaTot}</table>
    <p style="color:#fff;font-size:16px;margin:12px 0;">Nota final (promedio de las evaluaciones): <strong style="color:#0F8B8D;">${u.promedio.toFixed(2)} / 7</strong></p>
    ${evs.map((e, i) => comentariosHtml(e.comments, `Comentarios de ${et[i]}`)).join("")}
    <p style="color:#555;font-size:12px;text-align:center;margin-top:24px;">Adjuntamos tu evaluación unificada en PDF.</p>
  </div>
</body></html>`;
}

// Evaluaciones terminadas de UN alumno (para unificar). Devuelve null si algo no cuadra.
export async function cargarParaUnificar(ids: unknown, studentId?: string) {
  const lista = Array.from(new Set(Array.isArray(ids) ? ids.map(String) : String(ids || "").split(",").filter(Boolean)));
  if (lista.length < 2 || lista.length > 6) return null;
  const { data } = await createAdminSupabase().from("course_evaluations")
    .select("*, course_students(id,first_name,last_name,email)").in("id", lista).eq("tenant_id", tenantAlumnos()).eq("status", "final")
    .order("created_at");
  if (!data || data.length !== lista.length) return null;
  const al = (data[0] as any).course_students;
  if (data.some((e: any) => e.student_id !== data[0].student_id) || (studentId && al.id !== studentId)) return null;
  return { evs: data as any[], alumno: al as { id: string; first_name: string; last_name: string; email: string | null } };
}
