// El dueño de un negocio de una sola persona no ve comision ni arriendo. Uso: npx tsx scripts/test-dueno-solo.ts
import fs from "node:fs";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
const leer = (f: string) => fs.readFileSync(f, "utf8");
const api = leer("src/app/api/barberos/[id]/route.ts");
ok(api.includes("solo_dueno: soloDueno") && api.includes("esNegocioDeUnaPersona(supabase, data.tenant_id)"), "el perfil informa si es el dueño de un negocio de una sola persona");
const pag = leer("src/app/dashboard/barberos/[id]/page.tsx");
ok(/show: !isReceptionistProfile && !data\.solo_dueno/.test(pag), "la pestaña «Modalidad de trabajo» (comisión / arriendo) no se muestra al dueño solo");
ok(pag.includes("Dueño del negocio") && /data\.solo_dueno \?/.test(pag), "en vez de «Comisión»/«Arriendo» dice «Dueño del negocio»");
const bil = leer("src/app/api/wallet/route.ts");
ok(bil.includes("if (soloDueno) mode = \"rental\"") && bil.includes("soloDueno"), "Mi Billetera: el dueño solo se queda con el 100% (sin comisión)");
for (const f of ["src/lib/tenant-provisioning.ts", "src/app/api/superadmin/tenants/route.ts", "src/app/api/auth/signup-business/route.ts"]) ok(/work_mode: "rental", rental_daily_rate: 0/.test(leer(f)), `${f}: el dueño de un negocio de 1 profesional nace sin comisión ni arriendo`);
const menu = leer("src/components/layout/sidebar.tsx");
ok(/SOLO_BUSINESS_HIDDEN_ROUTES = \[[^\]]*"\/dashboard\/comisiones"[^\]]*"\/dashboard\/arriendo"/.test(menu), "el menú oculta Comisiones y Arriendo en un negocio de una sola persona");
process.exit(fallos ? 1 : 0);
