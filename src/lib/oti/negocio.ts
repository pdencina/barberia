// Oti para administradores: un gasto o ingreso que va a Ingresos/Egresos del NEGOCIO (no a Mi Billetera personal). Pura: se prueba sin base de datos.
import { norm } from "@/lib/oti/texto";

export const MEDIOS_PAGO_NEGOCIO = [
  { value: "cash", label: "Efectivo" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Crédito" },
  { value: "transfer", label: "Transferencia" },
] as const;

// ¿La frase habla del negocio? («compré insumos para la barbería», «pagué la luz del local»). Solo sugiere el destino; el administrador confirma.
export function pareceDelNegocio(texto: string): boolean {
  return /\b(negocio|local|barberia|estudio|salon|insumo|insumos|proveedor|proveedores|arriendo del local|sueldo|sueldos|publicidad)\b/.test(norm(texto));
}

export interface MovimientoNegocioInput { tipo: "gasto" | "ingreso"; monto: number; descripcion: string; fecha: string; medio: string }
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const msDe = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };

export function validarMovimientoNegocio(body: any, hoy: string): { ok: true; value: MovimientoNegocioInput } | { ok: false; error: string } {
  if (body?.tipo !== "gasto" && body?.tipo !== "ingreso") return { ok: false, error: "Tipo no válido (gasto o ingreso)" };
  const monto = Number(body?.monto);
  if (!Number.isInteger(monto) || monto < 1 || monto > 100_000_000) return { ok: false, error: "El monto debe ser un número entero de pesos (1 a 100.000.000)" };
  const descripcion = typeof body?.descripcion === "string" ? body.descripcion.trim() : "";
  if (descripcion.length < 1 || descripcion.length > 200) return { ok: false, error: "Escribe una descripción (hasta 200 caracteres)" };
  const medio = typeof body?.medio === "string" ? body.medio : "";
  if (!MEDIOS_PAGO_NEGOCIO.some((m) => m.value === medio)) return { ok: false, error: "Elige el método de pago" };
  const fecha = body?.fecha;
  if (typeof fecha !== "string" || !FECHA.test(fecha) || Number.isNaN(msDe(fecha))) return { ok: false, error: "Fecha no válida" };
  if (msDe(fecha) > msDe(hoy) + 86400000) return { ok: false, error: "La fecha no puede ser futura" };
  if (msDe(fecha) < msDe(hoy) - 366 * 86400000) return { ok: false, error: "La fecha es demasiado antigua para anotarla desde Oti" };
  return { ok: true, value: { tipo: body.tipo, monto, descripcion, fecha, medio } };
}
