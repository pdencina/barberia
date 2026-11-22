// El dueño de un negocio de 1 profesional atiende clientes (si no, «no hay profesionales disponibles»). Uso: npx tsx scripts/test-admin-atiende.ts
import fs from "node:fs";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
const leer = (f: string) => fs.readFileSync(f, "utf8");
ok(/maxProfessionals <= 1 \? \{ also_attends_clients: true/.test(leer("src/app/api/superadmin/tenants/route.ts")), "Super admin: la empresa de 1 profesional crea al dueño atendiendo clientes");
ok(/Number\(professionals\) === 1 \? \{ also_attends_clients: true/.test(leer("src/app/api/auth/signup-business/route.ts")), "Registro propio: quien trabaja solo queda atendiendo clientes");
ok(/maxProfessionals <= 1 \? \{ also_attends_clients: true/.test(leer("src/lib/tenant-provisioning.ts")), "Compra desde /suscribirse: igual (ya estaba)");
const api = leer("src/app/api/barberos/[id]/route.ts");
ok(api.includes("body.also_attends_clients === false") && api.includes("única persona que atiende"), "el dueño que es el único que atiende no puede dejar de atender");
process.exit(fallos ? 1 : 0);
