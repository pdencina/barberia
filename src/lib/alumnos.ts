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
    ${ev.comments ? `<div style="background:#1a1a1a;border-radius:8px;padding:14px;margin-top:12px;"><p style="color:#888;font-size:11px;text-transform:uppercase;margin:0 0 6px;">Comentarios del instructor</p><p style="color:#ccc;font-size:14px;margin:0;white-space:pre-wrap;">${esc(ev.comments)}</p></div>` : ""}
    <p style="color:#555;font-size:12px;text-align:center;margin-top:24px;">Adjuntamos tu evaluación en PDF.</p>
  </div>
</body></html>`;
}
