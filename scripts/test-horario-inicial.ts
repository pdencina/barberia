// El horario que se propone a un profesional parte del horario del negocio. Uso: npx tsx scripts/test-horario-inicial.ts
import { horarioInicial } from "../src/lib/horario-inicial";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };
const sinNegocio = horarioInicial("b1", []);
ok(sinNegocio.length === 7 && sinNegocio[0].is_working === false && sinNegocio[1].is_working && sinNegocio[1].start_time === "10:00" && sinNegocio[1].end_time === "20:00", "sin horario del negocio: lunes a sábado de 10 a 20 y domingo libre (como siempre)");
const negocio = [
  { day_of_week: 0, is_closed: false, open_time: "10:00:00", close_time: "13:00:00" },
  { day_of_week: 1, is_closed: true, open_time: "10:00:00", close_time: "21:00:00" },
  { day_of_week: 2, is_closed: false, open_time: "10:00:00", close_time: "18:00:00" },
];
const h = horarioInicial("b1", negocio);
ok(h[0].is_working && h[0].start_time === "10:00" && h[0].end_time === "13:00", "el domingo abierto del negocio (10 a 13) se propone igual");
ok(!h[1].is_working, "el día que el negocio cierra se propone como día libre");
ok(h[2].is_working && h[2].end_time === "18:00", "el martes se propone hasta las 18:00, como el negocio (no hasta las 20:00)");
ok(h[3].is_working && h[3].end_time === "20:00" && h[6].start_time === "10:00", "un día sin fila del negocio usa lo de siempre");
ok(h.every((d) => d.barber_id === "b1" && d.break_start === null && d.break_end === null), "sin colaciones y con el id del profesional");
process.exit(fallos ? 1 : 0);
