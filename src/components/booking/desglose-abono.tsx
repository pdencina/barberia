import type { ResumenAbono } from "@/lib/resumen-abono";

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

// Mismo cuadro antes y después de pagar. Hereda los colores de la pantalla donde va.
export function DesgloseAbono({ r, codigo, pagado }: { r: ResumenAbono; codigo?: string | null; pagado?: boolean }) {
  const fila = (t: string, v: string, fuerte = false) => <div className={`flex items-baseline justify-between gap-3 ${fuerte ? "text-base font-extrabold" : "text-sm"}`}><dt>{t}</dt><dd className="flex-shrink-0">{v}</dd></div>;
  return (
    <dl className="space-y-1.5 text-left">
      {fila("Valor del servicio", pesos(r.precio))}
      {r.descuento > 0 && fila(codigo ? `Descuento ${codigo}` : "Descuento", `-${pesos(r.descuento)}`)}
      {fila(pagado ? "Abono pagado" : "Abonas ahora", pagado ? `-${pesos(r.abono)}` : pesos(r.abono))}
      <div className="border-t border-current opacity-20" />
      {fila("Pagas en el local", pesos(r.saldo), true)}
    </dl>
  );
}
