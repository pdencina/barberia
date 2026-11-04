// Validacion de movimientos personales (gastos e ingresos de Mi Billetera). Pura: se prueba sin base de datos.
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO } from "@/lib/oti/personal";

export interface EntradaPersonalInput { kind: "expense" | "income"; amount: number; description: string; category: string; entry_date: string; source: "manual" | "oti" }
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const msDe = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fechaValida = (s: string) => { if (!FECHA.test(s)) return false; const [y, m, d] = s.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };

export function validarEntradaPersonal(body: any, hoy: string, parcial = false): { ok: true; value: Partial<EntradaPersonalInput> } | { ok: false; error: string } {
  const v: Partial<EntradaPersonalInput> = {};
  const tiene = (k: string) => body && body[k] !== undefined;
  if (!parcial || tiene("kind")) { if (body?.kind !== "expense" && body?.kind !== "income") return { ok: false, error: "Tipo no valido (gasto o ingreso)" }; v.kind = body.kind; }
  if (!parcial || tiene("amount")) { const n = Number(body?.amount); if (!Number.isInteger(n) || n < 1 || n > 100_000_000) return { ok: false, error: "El monto debe ser un numero entero de pesos (1 a 100.000.000)" }; v.amount = n; }
  if (!parcial || tiene("description")) { const d = typeof body?.description === "string" ? body.description.trim() : ""; if (d.length < 1 || d.length > 200) return { ok: false, error: "Escribe una descripcion (hasta 200 caracteres)" }; v.description = d; }
  if (!parcial || tiene("category")) {
    const c = typeof body?.category === "string" ? body.category.trim() : "Otros";
    const permitidas: string[] = [...CATEGORIAS_GASTO, ...CATEGORIAS_INGRESO];
    v.category = permitidas.includes(c) ? c : "Otros";
  }
  if (!parcial || tiene("entry_date")) {
    const f = body?.entry_date;
    if (typeof f !== "string" || !fechaValida(f)) return { ok: false, error: "Fecha no valida" };
    if (msDe(f) > msDe(hoy) + 86400000) return { ok: false, error: "La fecha no puede ser futura" };
    if (msDe(f) < msDe(hoy) - 5 * 366 * 86400000) return { ok: false, error: "La fecha es demasiado antigua" };
    v.entry_date = f;
  }
  if (tiene("source")) v.source = body.source === "oti" ? "oti" : "manual";
  else if (!parcial) v.source = "manual";
  return { ok: true, value: v };
}
