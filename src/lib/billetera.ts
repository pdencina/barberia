// Mi Billetera: reparto del sueldo (gastos, ahorro, saldo), ahorro recomendado y reporte con porcentajes.
// Puro: se prueba sin base de datos.

export interface GastoCat { category: string; amount: number }

export interface Recomendacion { pct: number; razon: string }

// Ahorro recomendado (% del ingreso) según el sueldo y la realidad de los gastos del mes anterior (o lo que va del mes).
// Meta ideal: 20 %. Si los gastos ya se comen casi todo el sueldo, se sugiere un porcentaje que se pueda cumplir de verdad:
// un ahorro que no se cumple no sirve. Nunca menos de 5 % ni más de 30 %.
export function ahorroRecomendado(sueldo: number, gastosReferencia: number | null): Recomendacion {
  if (!(sueldo > 0)) return { pct: 10, razon: "Anota tu sueldo para calcular una recomendación a tu medida. Mientras tanto, 10 % es un buen comienzo." };
  const ratio = gastosReferencia === null ? null : gastosReferencia / sueldo;
  let pct = 20;
  let razon = "La meta ideal es guardar el 20 % de lo que ganas.";
  if (ratio !== null) {
    if (ratio > 0.95) { pct = 5; razon = "Tus gastos se llevan casi todo el sueldo: parte con 5 % y ve subiendo cuando logres recortar."; }
    else if (ratio > 0.85) { pct = 8; razon = "Tus gastos son altos (más del 85 % del sueldo): 8 % es una meta que sí puedes cumplir."; }
    else if (ratio > 0.7) { pct = 12; razon = "Gastas cerca de tres cuartos del sueldo: 12 % es realista para tu situación."; }
    else if (ratio > 0.55) { pct = 15; razon = "Tus gastos están controlados: puedes guardar 15 %."; }
    else { pct = 20; razon = "Gastas menos de lo que ganas con holgura: puedes llegar a la meta ideal de 20 %."; }
  }
  // Con sueldos bajos, exigir mucho ahorro ahoga el presupuesto.
  if (sueldo < 500_000 && pct > 10) { pct = 10; razon += " Con tu sueldo actual conviene no pasar de 10 %."; }
  // Si el sueldo es alto y aguanta más, se puede subir un poco.
  if (sueldo >= 1_500_000 && ratio !== null && ratio <= 0.55) { pct = 25; razon = "Tienes un buen margen: podrías guardar hasta 25 %."; }
  return { pct: Math.min(30, Math.max(5, pct)), razon };
}

export interface Reparto {
  base: number;          // sueldo + otros ingresos del mes
  gastos: number;
  ahorro: number;        // apartado, intocable
  saldo: number;         // lo que queda libre (nunca negativo)
  sobregiro: number;     // cuánto se pasó de lo disponible (0 si no se pasó)
  pct: { gastos: number; ahorro: number; saldo: number };  // sobre la base, enteros
}

const redondear = (n: number) => Math.round(n);

export function repartoMes(o: { sueldo: number; otrosIngresos: number; gastos: number; ahorroPct: number }): Reparto {
  const base = Math.max(0, redondear(o.sueldo) + redondear(o.otrosIngresos));
  const ahorro = redondear(base * Math.min(100, Math.max(0, o.ahorroPct)) / 100);
  const gastos = Math.max(0, redondear(o.gastos));
  const libre = base - ahorro - gastos;
  const saldo = Math.max(0, libre);
  const pc = (n: number) => (base > 0 ? Math.round((n / base) * 100) : 0);
  return { base, gastos, ahorro, saldo, sobregiro: libre < 0 ? -libre : 0, pct: { gastos: pc(gastos), ahorro: pc(ahorro), saldo: pc(saldo) } };
}

export interface CategoriaPct { category: string; amount: number; pctGastos: number; pctBase: number }

// Gastos por categoría, de mayor a menor, con el % sobre el total de gastos y sobre el ingreso del mes.
export function gastosPorCategoria(gastos: GastoCat[], base: number): CategoriaPct[] {
  const acc = new Map<string, number>();
  for (const g of gastos) acc.set(g.category || "Otros", (acc.get(g.category || "Otros") || 0) + g.amount);
  const total = Array.from(acc.values()).reduce((s, v) => s + v, 0);
  return Array.from(acc.entries()).map(([category, amount]) => ({
    category, amount,
    pctGastos: total > 0 ? Math.round((amount / total) * 100) : 0,
    pctBase: base > 0 ? Math.round((amount / base) * 100) : 0,
  })).sort((a, b) => b.amount - a.amount);
}

// Texto corto del reporte: qué pasó este mes y una sugerencia.
export function lecturaDelMes(r: Reparto, ahorroPct: number, gastosMesAnterior: number | null): string[] {
  const out: string[] = [];
  if (r.base <= 0) return ["Anota tu sueldo del mes para ver el reporte con porcentajes."];
  out.push(`Gastaste el ${r.pct.gastos} % de tus ingresos y apartaste el ${Math.round(ahorroPct)} % para ahorro; te queda el ${r.pct.saldo} % libre.`);
  if (r.sobregiro > 0) out.push("Ojo: lo gastado más el ahorro supera tus ingresos del mes. Conviene recortar gastos antes que tocar el ahorro.");
  if (gastosMesAnterior !== null && gastosMesAnterior > 0) {
    const d = Math.round(((r.gastos - gastosMesAnterior) / gastosMesAnterior) * 100);
    if (Math.abs(d) >= 5) out.push(d > 0 ? `Tus gastos subieron ${d} % respecto del mes anterior.` : `Tus gastos bajaron ${Math.abs(d)} % respecto del mes anterior. ¡Bien!`);
  }
  return out;
}

export interface FilaMes { mes: string; ganado: number; atendidos: number; nuevos: number }

// Variación porcentual entre el último mes y el anterior (para el texto bajo cada gráfico de crecimiento).
export function variacion(actual: number, anterior: number): number | null {
  if (!(anterior > 0)) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}
