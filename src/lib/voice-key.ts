import { createHmac, randomBytes } from "crypto";

// Llave personal para el Atajo de iPhone. Se guarda solo la huella (HMAC con un secreto del servidor); la llave real se muestra una vez.
const pepper = () => process.env.PIN_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const FORMATO_LLAVE = /^rbk_[A-Za-z0-9_-]{43}$/;

export function nuevaLlave(): string { return `rbk_${randomBytes(32).toString("base64url")}`; }
export function huellaLlave(llave: string): string | null {
  const p = pepper();
  if (!p || !FORMATO_LLAVE.test(llave)) return null;
  return createHmac("sha256", p).update(`voicekey:${llave}`).digest("hex");
}
export function llaveDeEncabezado(auth: string | null): string {
  const m = /^Bearer\s+(\S+)$/i.exec(auth || "");
  return m ? m[1] : "";
}
