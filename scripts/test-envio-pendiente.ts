import { correrEnvio, TANDA, type EnvioPendiente } from "../src/lib/envio-pendiente";
let f = 0;
const ok = (c: boolean, t: string) => { if (!c) { f++; console.log("FALLA", t); } };
const ids = Array.from({ length: 150 }, (_, i) => `c${i}`);
const base: EnvioPendiente = { cuerpo: { type: "email" }, pendientes: ids, enviados: 0, total: 150, campaignId: null, creado: "" };

(async () => {
  const vistos: string[] = [];
  let guardado: EnvioPendiente = base, tandas = 0;
  const pedir = async (c: any) => { tandas++; vistos.push(...c.soloIds); return { ok: true, data: { sent: c.soloIds.length, total: c.soloIds.length, campaignId: "camp" } }; };
  // se detiene despues de la primera tanda
  const a = await correrEnvio(base, { pedir, detener: () => tandas >= 1, guardar: (e) => (guardado = e) });
  ok(a.fin === "detenido" && a.envio.enviados === TANDA && guardado.pendientes.length === 150 - TANDA, "detiene y guarda lo que falta");
  // reanuda
  const b = await correrEnvio(guardado, { pedir, detener: () => false, guardar: (e) => (guardado = e) });
  ok(b.fin === "completo" && b.envio.enviados === 150 && guardado.pendientes.length === 0, "completa");
  ok(new Set(vistos).size === 150 && vistos.length === 150, "nadie repetido ni saltado");
  ok(b.envio.campaignId === "camp", "misma campaña");
  const c = await correrEnvio(base, { pedir: async () => { throw new Error("red"); }, detener: () => false, guardar: () => {} });
  ok(c.fin === "error" && c.envio.pendientes.length === 150, "error de red: no pierde pendientes");
  const d = await correrEnvio(base, { pedir: async () => ({ ok: true, data: { sent: 0, total: 60 } }), detener: () => false, guardar: () => {} });
  ok(d.fin === "proveedor", "proveedor no acepta");
  console.log(f ? "HAY FALLAS" : "OK envío pendiente");
  process.exit(f ? 1 : 0);
})();
