// Formatos y cálculos puros de los gráficos del Dashboard (se prueban sin base de datos).

const coma = (x: number, d: number) => {
  const s = x.toFixed(d).replace(".", ",");
  return s.includes(",") ? s.replace(/0+$/, "").replace(/,$/, "") : s;
};

// Monto corto para ejes y etiquetas: 1.250.000 -> «$1,25 M», 350.000 -> «$350 mil», 900 -> «$900».
export function montoCorto(n: number): string {
  const v = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (v >= 1_000_000) return `${s}$${coma(v / 1_000_000, v >= 10_000_000 ? 0 : 2)} M`;
  if (v >= 1_000) return `${s}$${coma(v / 1_000, v >= 100_000 ? 0 : 1)} mil`;
  return `${s}$${Math.round(v)}`;
}

// Marcas «redondas» del eje vertical: de 0 hasta un máximo agradable (1, 2, 2,5 o 5 por potencia de 10).
export function marcasEje(max: number, cuantas = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const bruto = max / cuantas;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) || pot * 10;
  const out: number[] = [];
  for (let v = 0; v < max + paso * 0.999; v += paso) out.push(Math.round(v * 100) / 100);
  return out;
}

export interface PuntoVentas { label: string; date: string; total: number; prev?: number }

// Resumen del período: total, promedio por día/balde con venta, mejor balde.
export function resumenPeriodo(data: PuntoVentas[]): { total: number; promedio: number; mejor: PuntoVentas | null; conVenta: number } {
  const total = data.reduce((s, d) => s + d.total, 0);
  const conVenta = data.filter((d) => d.total > 0).length;
  const mejor = data.reduce<PuntoVentas | null>((m, d) => (d.total > 0 && (!m || d.total > m.total) ? d : m), null);
  return { total, promedio: conVenta ? Math.round(total / conVenta) : 0, mejor, conVenta };
}

const NOMBRES_MEDIO: Record<string, string> = { cash: "Efectivo", debit_card: "Débito", credit_card: "Crédito", transfer: "Transferencia", mixed: "Mixto", other: "Otro" };
export const nombreMedio = (m: string | null | undefined) => NOMBRES_MEDIO[String(m || "other")] || "Otro";

// Suma por medio de pago: las ventas «mixtas» se reparten con sus partes (transaction_payments).
export function ventasPorMedio(
  txs: { id: string; total: number; payment_method: string | null }[],
  partes: { transaction_id: string; payment_method: string; amount: number }[]
): { medio: string; nombre: string; total: number }[] {
  const porTx = new Map<string, { m: string; a: number }[]>();
  for (const p of partes) porTx.set(p.transaction_id, [...(porTx.get(p.transaction_id) || []), { m: p.payment_method, a: Number(p.amount) || 0 }]);
  const acc = new Map<string, number>();
  const sumar = (m: string, a: number) => acc.set(m, (acc.get(m) || 0) + a);
  for (const t of txs) {
    const sub = t.payment_method === "mixed" ? porTx.get(t.id) : undefined;
    if (sub && sub.length) sub.forEach((p) => sumar(p.m, p.a));
    else sumar(t.payment_method || "other", Number(t.total) || 0);
  }
  return Array.from(acc.entries())
    .filter(([, v]) => v > 0)
    .map(([medio, total]) => ({ medio, nombre: nombreMedio(medio), total }))
    .sort((a, b) => b.total - a.total);
}
