// Validación de un movimiento manual de Ingresos/Egresos (POST /api/finanzas). Pura: se prueba sin base de datos.
export const METODOS_MANUALES = ["cash", "debit_card", "credit_card", "transfer", "mixed"] as const;

export interface MovimientoManual { type: "income" | "expense"; description: string; amount: number; paymentMethod: string; notes: string | null }

export function validarMovimientoManual(body: any): { ok: true; value: MovimientoManual } | { ok: false; error: string } {
  const type = typeof body?.type === "string" ? body.type.toLowerCase() : "";
  if (type !== "income" && type !== "expense") return { ok: false, error: "Tipo no válido (ingreso o egreso)" };
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return { ok: false, error: "El monto debe ser mayor que 0" };
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (description.length < 1 || description.length > 200) return { ok: false, error: "Escribe una descripción (hasta 200 caracteres)" };
  const paymentMethod = typeof body?.paymentMethod === "string" ? body.paymentMethod.toLowerCase() : "";
  if (!(METODOS_MANUALES as readonly string[]).includes(paymentMethod)) return { ok: false, error: "Método de pago no válido" };
  let notes: string | null = null;
  if (body?.notes !== undefined && body?.notes !== null && body?.notes !== "") {
    if (typeof body.notes !== "string" || body.notes.length > 500) return { ok: false, error: "Las notas son muy largas (máximo 500 caracteres)" };
    notes = body.notes;
  }
  return { ok: true, value: { type, description, amount, paymentMethod, notes } };
}
