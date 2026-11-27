// Qué botones de pago muestra el tótem cuando alguna de las citas tiene una promoción con medios de pago limitados. Puro.
// (El servidor vuelve a revisar lo mismo al cobrar.)
export function mediosDelTotem(citas: Array<{ promo?: { pagos: string[] } | null }>) {
  const listas = citas.map((c) => c.promo?.pagos || []).filter((l) => l.length > 0);
  const vale = (m: string) => listas.every((l) => l.includes(m));
  return {
    limitado: listas.length > 0,
    debito: vale("debit_card"),
    credito: vale("credit_card"),
    qr: listas.length === 0,
    efectivo: vale("cash"),
    transferencia: vale("transfer"),
  };
}
