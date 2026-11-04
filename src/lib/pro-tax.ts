// Impuesto por profesional (migracion 117). INFORMATIVO: no cambia el total de la liquidacion.
//
//   Comision + retencion (ej. 15,25 %): el profesional emite boleta de honorarios por el bruto (la comision);
//                                       el negocio retiene y paga el neto. La retencion se declara al SII.
//   Comision + IVA 19 %:                el profesional factura con IVA; el negocio paga comision + IVA.
//   Arriendo + IVA 19 %:                el negocio cobra el arriendo + IVA al profesional.
//   Arriendo + retencion:               no aplica (la retencion es de honorarios).
//
// La retencion de honorarios cambia por ley cada año (15,25 % en 2026): por eso se elige/edita por profesional
// y no esta fija en los calculos.

export type ProMode = "commission" | "rental";
export type TaxKind = "none" | "retencion" | "iva";

export const IVA_RATE = 19;
export const TAX_PRESETS = [
  { rate: 0, label: "Sin impuesto" },
  { rate: 15.25, label: "Boleta de honorarios, retención 15,25 % (2026)" },
  { rate: IVA_RATE, label: "IVA 19 %" },
];

export function taxKindOf(rate: number): TaxKind {
  if (!(rate > 0)) return "none";
  return rate === IVA_RATE ? "iva" : "retencion";
}

export interface ProTax {
  kind: TaxKind;
  rate: number;
  base: number;
  amount: number;       // retencion o IVA
  finalAmount: number;  // comision: lo que paga el negocio; arriendo: lo que paga el profesional
  documentTotal: number; // monto de la boleta/factura
  note: string;
}

export function computeProTax(mode: ProMode, base: number, enabled: boolean, rate: number): ProTax {
  const r = Number(rate) || 0;
  const none = (note: string): ProTax => ({ kind: "none", rate: r, base, amount: 0, finalAmount: base, documentTotal: base, note });
  if (!enabled || !(r > 0)) return none("");
  const kind = taxKindOf(r);
  const amount = Math.round((base * r) / 100);
  if (kind === "retencion") {
    if (mode === "rental") return none("La retención de honorarios no aplica a arriendo");
    return { kind, rate: r, base, amount, finalAmount: base - amount, documentTotal: base, note: `Boleta de honorarios por ${base}; el negocio retiene ${amount}` };
  }
  return { kind, rate: r, base, amount, finalAmount: base + amount, documentTotal: base + amount, note: `IVA ${r}% sobre ${base}` };
}
