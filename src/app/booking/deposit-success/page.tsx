"use client";

import { ResultadoAbono } from "@/components/booking/resultado-abono";

// Vuelta de Mercado Pago «aprobado». No da nada por confirmado: lo verifica el servidor (ver resultado-abono.tsx).
export default function DepositSuccessPage() {
  return <ResultadoAbono modo="success" />;
}
