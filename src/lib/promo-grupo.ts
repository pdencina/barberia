// «Solo si reservan 2 personas juntas»: quién puede crear un grupo y cuándo el grupo sigue valiendo.
import { createHmac, timingSafeEqual } from "crypto";

export const MENSAJE_DOS_PERSONAS = "Esta promoción es para 2 personas que reservan juntas, desde el link de la promoción.";

// Solo el servidor puede armar un grupo: la reserva comprueba esta firma (así nadie se inventa un «acompañante»).
const firmaDe = (id: string, secreto: string) => createHmac("sha256", secreto).update(`grupo-promo:${id}`).digest("hex");
export const firmarGrupo = (id: string, secreto = process.env.SUPABASE_SERVICE_ROLE_KEY || "") => firmaDe(id, secreto);
export function grupoValido(grupo: any, secreto = process.env.SUPABASE_SERVICE_ROLE_KEY || ""): string | null {
  const id = String(grupo?.id || ""), firma = String(grupo?.firma || "");
  if (!secreto || !/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/.test(firma)) return null;
  return timingSafeEqual(Buffer.from(firma, "hex"), Buffer.from(firmaDe(id, secreto), "hex")) ? id : null;
}

/** ¿Hay acompañante? Otra cita del mismo grupo, el mismo día, que no esté cancelada ni como «no llegó» y que cumpla las reglas. */
export function tieneAcompanante(cita: { id: string; date: string }, grupo: Array<{ id: string; date: string; status: string; cumple?: boolean }>): boolean {
  return grupo.some((g) => g.id !== cita.id && g.date === cita.date && g.status !== "cancelled" && g.status !== "no_show" && g.cumple !== false);
}
