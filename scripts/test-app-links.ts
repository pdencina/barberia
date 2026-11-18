// Enlaces de descarga de la app en los correos con credenciales. Uso: npx tsx scripts/test-app-links.ts
import fs from "node:fs";
import { APP_STORE_URL, PLAY_STORE_URL, bloqueDescargaApps } from "../src/lib/app-links";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
const html = bloqueDescargaApps();
ok(html.includes(APP_STORE_URL) && html.includes(PLAY_STORE_URL), "el bloque trae los links de iPhone y Android");
ok(/^https:\/\/apps\.apple\.com\/cl\/app\/id\d+$/.test(APP_STORE_URL) && /^https:\/\/play\.google\.com\/store\/apps\/details\?id=cl\.rebooking\.app$/.test(PLAY_STORE_URL), "los links tienen la forma correcta");
import { htmlBienvenidaEmpresa } from "../src/lib/mail-bienvenida-empresa";
const correo = htmlBienvenidaEmpresa({ adminName: "María <b>", businessName: "Studio Ejemplo", adminEmail: "maria@studioejemplo.cl", tempPassword: "Ejemplo-2026-xyz", planLine: "Pro (15 días gratis)", appUrl: "https://www.re-booking.cl" });
ok(correo.includes(APP_STORE_URL) && correo.includes(PLAY_STORE_URL), "el correo de credenciales trae los dos links de descarga");
ok(correo.includes("Ejemplo-2026-xyz") && correo.includes("maria@studioejemplo.cl") && correo.includes("Pro (15 días gratis)"), "y las credenciales y el plan");
ok(!correo.includes("<b>") && correo.includes("María &lt;b&gt;"), "los nombres se escapan (no se cuela HTML)");
ok(correo.includes("#0F8B8D") && correo.includes("logo-horizontal-white.png"), "usa el diseño verde con el logo blanco");
for (const f of ["src/app/api/superadmin/tenants/route.ts", "src/lib/tenant-provisioning.ts"]) ok(fs.readFileSync(f, "utf8").includes("htmlBienvenidaEmpresa("), `${f}: usa la plantilla compartida`);
process.exit(fallos ? 1 : 0);
