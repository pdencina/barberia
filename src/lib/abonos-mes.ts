import { fetchAllRows } from "@/lib/accounting";

// Abonos recibidos al reservar, de un período. Son ingreso del mes en que se pagaron (no del mes de la atención): la venta posterior
// solo trae lo que faltaba cobrar, así que sumar ambos no cuenta nada dos veces. Un abono devuelto o por devolver no es ingreso.
// Sin la tabla (migración 131) devuelve vacío.
export async function fetchAbonosRecibidos(supabase: any, scope: (q: any) => any, startIso: string, endIso: string): Promise<Array<{ amount: number; appointment_id: string | null }>> {
  try {
    const rows = await fetchAllRows<any>(() => scope(supabase.from("booking_deposits").select("id, amount, appointment_id").eq("status", "approved").gte("created_at", startIso).lt("created_at", endIso)));
    return rows.map((r) => ({ amount: Math.max(0, Math.round(Number(r.amount) || 0)), appointment_id: r.appointment_id || null }));
  } catch { return []; }
}

export const sumarAbonos = (rows: Array<{ amount: number }>) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

// ¿Existe transactions.prepaid_amount (migración 135)? fetchMonthTx traga los errores y devuelve vacío, así que se pregunta antes.
let prepaidOk: boolean | null = null; let prepaidRecheck = 0;
export async function prepaidColumnAvailable(supabase: any): Promise<boolean> {
  if (prepaidOk === true) return true;
  if (prepaidOk === false && Date.now() < prepaidRecheck) return false;
  const { error } = await supabase.from("transactions").select("prepaid_amount").limit(1);
  prepaidOk = !error; prepaidRecheck = Date.now() + 30_000;
  return prepaidOk;
}
