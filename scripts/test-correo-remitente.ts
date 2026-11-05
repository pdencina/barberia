// El remitente de respaldo de los correos debe ser del dominio verificado en Resend (re-booking.cl, con guion).
// "rebooking.cl" no está verificado: Resend rechaza el envío en silencio y el cliente nunca recibe el correo.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
}
const malos = archivos("src").filter((p) => readFileSync(p, "utf8").includes("no-reply@rebooking.cl"));
assert.deepEqual(malos, [], `Remitente de respaldo con dominio no verificado en: ${malos.join(", ")}`);
console.log("OK correo-remitente: ningún respaldo usa el dominio no verificado rebooking.cl.");
