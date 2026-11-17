"use client";

import { ResultadoAbono } from "@/components/booking/resultado-abono";

// Vuelta de Mercado Pago «pendiente» (por ejemplo, un pago que el banco aun esta revisando). Se espera la confirmacion real del servidor.
export default function DepositPendingPage() {
  return <ResultadoAbono modo="pending" />;
}
