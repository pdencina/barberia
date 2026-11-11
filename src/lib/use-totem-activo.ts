"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";

// ¿Este negocio tiene el tótem de autoatención? (servicio aparte). Sirve para mostrar u ocultar el código del cliente.
export function useTotemActivo(): boolean {
  const { tenant } = useTenant();
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/totem/activo${tenant?.id ? `?tenantId=${tenant.id}` : ""}`).then((r) => r.json()).then((d) => { if (vivo) setActivo(!!d?.activo); }).catch(() => {});
    return () => { vivo = false; };
  }, [tenant?.id]);
  return activo;
}
