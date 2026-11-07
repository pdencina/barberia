import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { THEMES, isAppTheme, normalizeTheme, applyColorTheme, clearColorTheme } from "../src/lib/themes";
let passed = 0;
async function t(name: string, fn: () => unknown) { await fn(); passed++; console.log(`OK ${name}`); }
const Module = require("node:module"); const original = Module._load;
let caller: any = { userId: "example-user", role: "admin", tenantId: "tenant-a" };
let denied = false, dbError: any = null; let writes: any[] = [];
Module._load = function (name: string, ...args: any[]) {
  if (name === "@/lib/supabase/server") return {
    getCurrentUserRoleAndTenant: async () => caller,
    resolveTenantForRequest: async () => ({ tenantId: caller.tenantId, denied }),
    createAdminSupabase: () => ({ from(table: string) { const filters: any[] = []; const q: any = { update(value: any) { writes.push({ table, value, filters }); return q; }, eq(k: string, v: any) { filters.push([k,v]); return q; }, then(resolve: any) { return Promise.resolve({ error: dbError }).then(resolve); } }; return q; } }),
  };
  return original.call(this, name, ...args);
};
const business = require("../src/app/api/settings/theme/route").POST;
const personal = require("../src/app/api/profile/theme/route").POST;
Module._load = original;
const req = (body: any) => new NextRequest("https://example.test/api/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function main() {
  await t("se conservan Claro y Oscuro y se agregan exactamente las tres opciones aprobadas", () => assert.deepEqual(THEMES.map(t => t.value), ["light","dark","rose","monochrome","monochrome-dark"]));
  await t("valores desconocidos conservan el tema claro seguro", () => { for (const v of [undefined,null,"",{},"bad"]) { assert.equal(isAppTheme(v),false); assert.equal(normalizeTheme(v),"light"); } });
  const classes = new Set<string>(); const root: any = { dataset: {}, classList: { toggle(k: string, on: boolean) { on ? classes.add(k) : classes.delete(k); }, remove(k: string) { classes.delete(k); } } };
  for (const theme of THEMES) {
    await t(`aplicar ${theme.label} y limpiar no deja colores en la siguiente sesión`, () => { applyColorTheme(root,theme.value); assert.equal(root.dataset.colorTheme,theme.value); assert.equal(classes.has("dark"), ["dark","monochrome-dark"].includes(theme.value)); clearColorTheme(root); assert.equal(root.dataset.colorTheme,undefined); assert.equal(classes.size,0); });
    await t(`guardar ${theme.label} como tema del negocio filtra por el negocio autorizado`, async () => { writes=[]; const r = await business(req({ theme:theme.value, tenantId:"tenant-a" })); assert.equal(r.status,200); assert.deepEqual(writes[0].filters,[["id","tenant-a"]]); assert.equal((await r.json()).theme,theme.value); });
    await t(`guardar ${theme.label} como tema propio ignora IDs de otros perfiles`, async () => { writes=[]; const r = await personal(req({ theme:theme.value, userId:"otro",tenantId:"otro" })); assert.equal(r.status,200); assert.deepEqual(writes[0].filters,[["id","example-user"],["tenant_id","tenant-a"]]); });
  }
  await t("del negocio se guarda como null", async () => { writes=[]; assert.equal((await personal(req({theme:null}))).status,200); assert.equal(writes[0].value.theme,null); });
  await t("sin sesión no guarda temas", async () => { caller={}; writes=[]; assert.equal((await business(req({theme:"rose"}))).status,401); assert.equal((await personal(req({theme:"rose"}))).status,401); assert.equal(writes.length,0); caller={userId:"example-user",role:"admin",tenantId:"tenant-a"}; });
  await t("recepción y profesional no cambian el tema de todo el negocio", async () => { writes=[]; for (const role of ["barber","receptionist"]) { caller.role=role; assert.equal((await business(req({theme:"rose"}))).status,403); } caller.role="admin"; assert.equal(writes.length,0); });
  await t("otro negocio queda rechazado antes de escribir", async () => { denied=true; writes=[]; assert.equal((await business(req({theme:"rose",tenantId:"other"}))).status,403); assert.equal(writes.length,0); denied=false; });
  await t("tema inválido o JSON nulo no restablece preferencias silenciosamente", async () => { writes=[]; for (const b of [null,{}, {theme:"unknown"}, {theme:{}}]) { assert.equal((await business(req(b))).status,400); assert.equal((await personal(req(b))).status,400); } assert.equal(writes.length,0); });
  await t("sin migración informa el pendiente y no anuncia tema guardado", async () => { dbError={code:"23514"}; const r=await personal(req({theme:"rose"})); assert.equal(r.status,503); assert.match((await r.json()).error,/148/); dbError=null; });
  console.log(`${passed} pruebas correctas`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
