// Resumen legible del estado de una cuenta de Mercado Pago para cobrar online. Puro: se prueba sin llamar a Mercado Pago.
export interface ResumenCuenta { tokenTipo: "produccion" | "prueba" | "desconocido"; puedeVender: boolean | null; tipoCuenta: string | null; pais: string | null; problemas: string[] }

export function resumirCuenta(token: string, u: any): ResumenCuenta {
  const tokenTipo = /^APP_USR-/.test(token) ? "produccion" : /^TEST-/.test(token) ? "prueba" : "desconocido";
  const problemas: string[] = [];
  if (tokenTipo === "prueba") problemas.push("El token es de PRUEBA (empieza con TEST-). Para cobrar de verdad hace falta el de producción (APP_USR-).");
  const venta = u?.status?.sell;
  const puedeVender = typeof venta?.allow === "boolean" ? venta.allow : null;
  if (puedeVender === false) problemas.push(`Mercado Pago indica que esta cuenta NO puede recibir pagos${venta?.codes?.length ? ` (${venta.codes.join(", ")})` : ""}. Hay que completar la verificación de la cuenta en Mercado Pago.`);
  if (u?.site_id && u.site_id !== "MLC") problemas.push(`La cuenta es de otro país (${u.site_id}); para Chile debe ser MLC.`);
  const tags: string[] = Array.isArray(u?.tags) ? u.tags : [];
  if (tags.includes("user_profile_incomplete") || tags.includes("incomplete_data")) problemas.push("El perfil de la cuenta está incompleto en Mercado Pago.");
  return { tokenTipo, puedeVender, tipoCuenta: u?.user_type || null, pais: u?.site_id || null, problemas };
}
