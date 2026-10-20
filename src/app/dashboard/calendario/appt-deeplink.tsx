"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Llega desde un aviso (campanita / push): /dashboard/calendario?appt=<id>&date=<YYYY-MM-DD>.
// Pone el calendario en ese dia, abre el cuadro de la cita y limpia la direccion.
export default function ApptDeepLink({ onOpen }: { onOpen: (apptId: string, date: string | null) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const appt = params.get("appt");
  const date = params.get("date");
  useEffect(() => {
    if (!appt) return;
    onOpen(appt, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null);
    router.replace("/dashboard/calendario");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt, date]);
  return null;
}
