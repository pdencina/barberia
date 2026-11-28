import { limpiarDuracionPublica as l, conDuracionPublica, duracionVisibleDeCita } from "../src/lib/duracion-publica";
let f = 0;
const ok = (c: boolean, t: string) => { if (!c) { f++; console.log("FALLA", t); } };
const sb = (data: any[], error: any = null) => ({ from: () => ({ select: () => ({ in: async () => ({ data, error }), eq: async () => ({ data, error }) }) }) });
(async () => {
  ok(l("") === null && l(50) === 50 && l("40") === 40 && l(0) === undefined && l(700) === undefined && l("x") === undefined, "validación");
  const r = await conDuracionPublica(sb([{ id: "a", public_duration: 50 }, { id: "b", public_duration: null }]), [{ id: "a", duration: 40 }, { id: "b", duration: 25 }]);
  ok(r[0].duration === 40 && r[0].publicDuration === 50 && r[1].publicDuration === 25, "la agenda no cambia");
  ok((await conDuracionPublica(sb([], { message: "sin columna" }), [{ id: "a", duration: 40 }]))[0].publicDuration === 40, "sin migración");
  ok(await duracionVisibleDeCita(sb([{ service: { duration: 40, public_duration: 50 } }, { service: { duration: 20, public_duration: null } }]), "c", 60) === 70, "cita");
  ok(await duracionVisibleDeCita(sb([{ service: { duration: 40, public_duration: null } }]), "c", 45) === 45, "sin pública, como antes");
  console.log(f ? `${f} FALLAS` : "OK duración pública");
  process.exit(f ? 1 : 0);
})();
