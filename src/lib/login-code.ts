import { createHmac, timingSafeEqual } from "crypto";

// Huella del código: HMAC con una llave del servidor, así un respaldo de la tabla no revela los códigos.
export function hashLoginCode(email: string, code: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev";
  return createHmac("sha256", key).update(`${email.toLowerCase()}:${code}`).digest("hex");
}
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export const LOGIN_CODE_MINUTES = 10;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
export const LOGIN_CODE_MAX_PER_HOUR = 5;
export const LOGIN_CODE_COOLDOWN_SECONDS = 45;
