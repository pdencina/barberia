// En un negocio de una sola persona manda el horario del negocio. Uso: npx tsx scripts/test-negocio-una-persona.ts
import { limitarPorNegocio, esNegocioDeUnaPersona } from "../src/lib/negocio-una-persona";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
const prof = { open: "10:00", close: "20:00" };
const l = (neg: any, p = prof) => limitarPorNegocio(p, neg) as any;

ok(l(null).closed === false && l(null).close === "20:00", "sin fila del negocio para ese día: no se recorta nada");
ok(l({ is_closed: true, open_time: "10:00:00", close_time: "21:00:00" }).closed === true, "el negocio cerró ese día: no hay horas aunque el profesional lo tenga abierto");
let r = l({ is_closed: false, open_time: "10:00:00", close_time: "18:00:00" });
ok(r.closed === false && r.open === "10:00" && r.close === "18:00", "el negocio cierra a las 18:00 (el caso de Rody): se recorta de 20:00 a 18:00");
r = l({ is_closed: false, open_time: "11:00:00", close_time: "22:00:00" });
ok(r.open === "11:00" && r.close === "20:00", "si el negocio abre más tarde, se respeta; si cierra más tarde, manda el profesional");
r = l({ is_closed: false, open_time: "09:00:00", close_time: "19:00:00" }, { open: "09:00", close: "20:00" });
ok(r.open === "09:00" && r.close === "19:00", "sábado de Rody: 9 a 19");
ok(l({ is_closed: false, open_time: "21:00:00", close_time: "23:00:00" }).closed === true, "horarios que no se cruzan: ese día no hay horas");
ok(l({ is_closed: false, open_time: null, close_time: null }).close === "20:00", "fila del negocio sin horas: no se recorta");

// ¿Negocio de una sola persona? (un solo profesional activo que atiende)
const bd = (filas: any[]) => ({ from: () => { const q: any = { select: () => q, eq: () => q, in: () => q, then: (res: any) => Promise.resolve({ data: filas }).then(res) }; return q; } });
(async () => {
  ok(await esNegocioDeUnaPersona(bd([{ id: "1", role: "admin", also_attends_clients: true }]), "t"), "el dueño que atiende, solo: una persona");
  ok(await esNegocioDeUnaPersona(bd([{ id: "1", role: "admin", also_attends_clients: false }, { id: "2", role: "barber", also_attends_clients: false }]), "t"), "un barbero y el dueño que NO atiende: una persona (aunque el plan sea Pro)");
  ok(!(await esNegocioDeUnaPersona(bd([{ id: "1", role: "barber" }, { id: "2", role: "barber" }]), "t")), "dos profesionales: NO es de una persona (cada uno con su horario)");
  ok(!(await esNegocioDeUnaPersona(bd([{ id: "1", role: "admin", also_attends_clients: true }, { id: "2", role: "barber" }]), "t")), "el dueño atiende y hay otro profesional: no");
  ok(!(await esNegocioDeUnaPersona(bd([]), "t")) && !(await esNegocioDeUnaPersona(bd([{ id: "1", role: "barber" }]), null)), "sin profesionales o sin negocio: no");
  process.exit(fallos ? 1 : 0);
})();
