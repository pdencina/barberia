// Calculo del abono al reservar. Puro: sin dependencias del servidor, se usa en la pagina de reservas y en la API.
export type ModoAbono = "percent" | "fixed";
export interface ConfigAbono { mode: ModoAbono; percent: number; fixed: number | null; minAmount?: number | null }

// Cuanto se cobra de abono por una reserva de `total` pesos. Nunca mas que el total ni menos de 0; siempre entero.
export function calcularAbono(total: number, cfg: ConfigAbono): number {
  const t = Math.max(0, Math.round(Number(total) || 0));
  if (t === 0) return 0;
  let a: number;
  if (cfg.mode === "fixed") a = Math.round(Number(cfg.fixed) || 0);
  else a = Math.ceil((t * Math.min(100, Math.max(1, Number(cfg.percent) || 30))) / 100);
  if (cfg.minAmount && cfg.minAmount > a) a = Math.round(cfg.minAmount);
  return Math.min(t, Math.max(0, a));
}

