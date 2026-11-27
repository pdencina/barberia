// Cuenta de una reserva con abono y cupón: se abona lo de siempre y el descuento se resta de lo que queda por pagar en el local. Puro.
export interface ResumenAbono { precio: number; descuento: number; abono: number; saldo: number }

export function resumenAbono(precio: number, descuento: number, abonoNormal: number): ResumenAbono {
  const p = Math.max(0, Math.round(Number(precio) || 0));
  const d = Math.max(0, Math.min(p, Math.round(Number(descuento) || 0)));
  const abono = Math.max(0, Math.min(p - d, Math.round(Number(abonoNormal) || 0))); // nunca se abona más de lo que cuesta
  return { precio: p, descuento: d, abono, saldo: p - d - abono };
}
