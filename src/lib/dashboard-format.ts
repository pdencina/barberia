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

// ---- Intensidad de cada día/semana/mes (azul = más fuerte, rojo = más lento; más opacidad = más extremo) ----

export type Tono = "fuerte" | "lento" | "normal" | "sin";
export interface Intensidad { tono: Tono; nivel: number; opacidad: number; ratio: number | null; referencia: number }

const mediana = (v: number[]) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const diaSemana = (date: string) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); };

// Escalones de la razón «venta / lo normal»: cuanto más lejos de 1, más opacidad. Dentro de ±10 % queda neutro.
const ESCALA_LENTO: [number, number, number][] = [[0.35, -3, 0.55], [0.65, -2, 0.35], [0.9, -1, 0.18]];
const ESCALA_FUERTE: [number, number, number][] = [[1.35, 1, 0.3], [1.8, 2, 0.55], [Infinity, 3, 0.85]];

// «Lo normal» de cada punto: en días, la mediana de ese mismo día de la semana dentro del período (un domingo se compara con los
// domingos, no con un viernes); si hay menos de 3 del mismo día, o son semanas/meses, la mediana de los puntos con ventas.
export function intensidades(data: PuntoVentas[], porDiaSemana: boolean): Intensidad[] {
  const conVenta = data.filter((d) => d.total > 0).map((d) => d.total);
  const global = mediana(conVenta);
  const porDia = new Map<number, number[]>();
  if (porDiaSemana) for (const d of data) if (d.total > 0) porDia.set(diaSemana(d.date), [...(porDia.get(diaSemana(d.date)) || []), d.total]);
  return data.map((d) => {
    const mismos = porDiaSemana ? porDia.get(diaSemana(d.date)) || [] : [];
    const referencia = mismos.length >= 3 ? mediana(mismos) : global;
    if (!(d.total > 0) || !(referencia > 0)) return { tono: "sin", nivel: 0, opacidad: 0, ratio: null, referencia };
    const ratio = d.total / referencia;
    if (ratio < 0.9) { const [, nivel, opacidad] = ESCALA_LENTO.find(([lim]) => ratio <= lim)!; return { tono: "lento", nivel, opacidad, ratio, referencia }; }
    if (ratio > 1.1) { const [, nivel, opacidad] = ESCALA_FUERTE.find(([lim]) => ratio <= lim)!; return { tono: "fuerte", nivel, opacidad, ratio, referencia }; }
    return { tono: "normal", nivel: 0, opacidad: 0, ratio, referencia };
  });
}
