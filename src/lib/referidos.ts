// Referidos, etapa 1: solo registro. NO cambia ningun cobro (el descuento y el mes gratis llegan en las etapas 2 y 3).
export const REFERIDOS_ACTIVOS = process.env.NEXT_PUBLIC_REFERIDOS === "1";
export const PREMIO = { referidoDescuentoPct: 50, referidoMeses: 2, invitadorMesesGratis: 1 } as const;

export const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para poder dictarlo
export const codigoValido = (c: unknown): c is string => typeof c === "string" && /^[A-HJ-NP-Z2-9]{6}$/.test(c.trim().toUpperCase());
export const normalizarCodigo = (c: string) => c.trim().toUpperCase();

export const urlInvitacion = (origen: string, codigo: string) => `${origen.replace(/\/$/, "")}/suscribirse?ref=${codigo}`;

// Un negocio no puede referirse a si mismo (mismo correo de administrador o mismo RUT de empresa que quien invita).
export function esAutoReferido(
  invitador: { adminEmails: string[]; rut: string | null },
  nuevo: { email: string; rut: string | null }
): boolean {
  const mail = nuevo.email.trim().toLowerCase();
  if (invitador.adminEmails.some((e) => e.trim().toLowerCase() === mail)) return true;
  const limpia = (r: string | null) => (r || "").replace(/[^0-9kK]/g, "").toLowerCase();
  return !!limpia(nuevo.rut) && limpia(nuevo.rut) === limpia(invitador.rut);
}
