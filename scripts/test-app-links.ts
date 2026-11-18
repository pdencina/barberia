// Enlaces de descarga de la app en los correos con credenciales. Uso: npx tsx scripts/test-app-links.ts
import fs from "node:fs";
import { APP_STORE_URL, PLAY_STORE_URL, bloqueDescargaApps } from "../src/lib/app-links";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
const html = bloqueDescargaApps();
ok(html.includes(APP_STORE_URL) && html.includes(PLAY_STORE_URL), "el bloque trae los links de iPhone y Android");
ok(/^https:\/\/apps\.apple\.com\/cl\/app\/id\d+$/.test(APP_STORE_URL) && /^https:\/\/play\.google\.com\/store\/apps\/details\?id=cl\.rebooking\.app$/.test(PLAY_STORE_URL), "los links tienen la forma correcta");
for (const f of ["src/app/api/superadmin/tenants/route.ts", "src/lib/tenant-provisioning.ts"]) ok(fs.readFileSync(f, "utf8").includes("${bloqueDescargaApps()}"), `${f}: el correo de credenciales incluye el bloque de descarga`);
process.exit(fallos ? 1 : 0);
