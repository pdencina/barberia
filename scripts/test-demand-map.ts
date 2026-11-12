// Mapa de demanda. Uso: npx tsx scripts/test-demand-map.ts
import { construirMapa, horariosFlojos, diaSemana, horaDe, nivelesPorDia, nivelesPorHora, minutosPorHora, estaAbierta, resumenHorario } from "../src/lib/demand-map";
import { disponibilidadPorDiaHora } from "../src/lib/disponibilidad";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("ok:", n); };

ok(diaSemana("2026-11-02") === 1 && diaSemana("2026-11-01") === 7 && diaSemana("2026-11-07") === 6, "día de la semana (lunes=1, domingo=7)");
ok(horaDe("2026-10-10T16:00:00+00:00") === 16 && horaDe("2026-10-10 09:30:00") === 9 && horaDe("") === null, "hora leída del texto (sin convertir zona)");

// 2 semanas: lunes 14h (2 reservas), lunes 10h (8), lunes 11h (8), lunes 12h (8), 1 cancelada que no cuenta, 1 fuera de rango.
const rows: any[] = [];
const add = (date: string, h: number, n: number, status = "completed") => { for (let i = 0; i < n; i++) rows.push({ date, start_time: `${date}T${String(h).padStart(2, "0")}:00:00+00:00`, status }); };
add("2026-10-19", 10, 4); add("2026-10-26", 10, 4);
add("2026-10-19", 11, 4); add("2026-10-26", 11, 4);
add("2026-10-19", 12, 4); add("2026-10-26", 12, 4);
add("2026-10-19", 14, 1); add("2026-10-26", 14, 1);
add("2026-10-19", 15, 6, "cancelled");
add("2026-10-05", 10, 9); // fuera del rango
const m = construirMapa(rows, 2, "2026-10-19", "2026-11-01");
ok(m.totalReservas === 26, `no cuenta canceladas ni fuera de rango (${m.totalReservas})`);
ok(m.cells.find((c) => c.dow === 1 && c.hour === 10)?.avg === 4, "promedio por semana");
ok(m.horas.join() === "10,11,12" , `horas con actividad (${m.horas.join()}): la 14h con 2 reservas queda fuera del rango visible`);
ok(m.porDia[0].avg === 13, "total del lunes por semana");

// Dia grande con hueco al medio.
const r2: any[] = []; for (let w = 0; w < 4; w++) { const d = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"][w]; for (const [h, n] of [[10, 6], [11, 6], [12, 6], [13, 0], [14, 1], [15, 6], [16, 6]] as const) for (let i = 0; i < n; i++) r2.push({ date: d, start_time: `${d}T${String(h).padStart(2, "0")}:00:00+00:00`, status: "confirmed" }); }
const m2 = construirMapa(r2, 4, "2026-10-05", "2026-11-01");
const fl = horariosFlojos(m2);
ok(fl.length > 0 && fl[0].hour === 13, `el hueco de las 13h sale primero (${fl[0]?.hour})`);
ok(horariosFlojos(m2, [13, 14]).every((f) => f.hour !== 13 && f.hour !== 14), "las horas de descanso no cuentan");
ok(horariosFlojos(construirMapa([], 4, "2026-10-05", "2026-11-01")).length === 0, "sin datos no hay horarios flojos");

// Negocio chico (caso real de Looky Estudio): 1 profesional, ~9 reservas por semana. Antes todos los días salían "cerrados" y todo en 0.
const r3: any[] = [];
const sem = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
sem.forEach((d, i) => {
  const lun = d, mar = `2026-10-${String(6 + i * 7).padStart(2, "0")}`, mie = `2026-10-${String(7 + i * 7).padStart(2, "0")}`;
  for (const [fecha, h] of [[lun, 8], [lun, 11], [mar, 8], [mar, 11], [mar, 15], [mie, 11]] as [string, number][]) r3.push({ date: fecha, start_time: `${fecha}T${String(h).padStart(2, "0")}:00:00+00:00`, status: "completed" });
});
const m3 = construirMapa(r3, 4, "2026-10-05", "2026-11-01");
const d3 = nivelesPorDia(m3);
ok(m3.totalReservas === 24 && [1, 2, 3].every((dow) => d3.get(dow)!.nivel !== "cerrado"), "negocio chico: los días con reservas ya no salen 'cerrados'");
ok(d3.get(4)!.nivel === "cerrado" && d3.get(7)!.nivel === "cerrado", "negocio chico: un día sin reservas sí sale cerrado");
ok(m3.horas.length > 0, `negocio chico: se muestran horas (${m3.horas.join()})`);
ok(nivelesPorHora(m3).some((h) => h.avg > 0), "negocio chico: las horas muestran un promedio mayor que 0");
ok(horariosFlojos(m3).length > 0, "negocio chico: hay horarios donde conviene promocionar");

// Servicios largos (caso Looky): una cita de 3 horas ocupa a su profesional en las 3 horas, no solo en la de inicio.
ok(JSON.stringify(Array.from(minutosPorHora("2026-10-05T09:00:00+00:00", "2026-10-05T12:00:00+00:00").entries())) === JSON.stringify([[9, 60], [10, 60], [11, 60]]), "cita de 3 h reparte 60 min en 9, 10 y 11");
ok(JSON.stringify(Array.from(minutosPorHora("2026-10-05T09:30:00", "2026-10-05T10:45:00").entries())) === JSON.stringify([[9, 30], [10, 45]]), "cita 9:30-10:45 reparte 30 y 45 min");
ok(JSON.stringify(Array.from(minutosPorHora("2026-10-05T09:00:00", null).entries())) === JSON.stringify([[9, 60]]), "sin hora de término cuenta solo la hora de inicio (como antes)");
const r4: any[] = [];
["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"].forEach((lun, i) => {
  // Lunes: una cita de 3 h a las 9. Martes y miércoles: citas cortas de 1 h a las 9, 10 y 11.
  r4.push({ date: lun, start_time: `${lun}T09:00:00+00:00`, end_time: `${lun}T12:00:00+00:00`, status: "completed" });
  for (const dd of [6, 7]) { const f = `2026-10-${String(dd + i * 7).padStart(2, "0")}`; for (const h of [9, 10, 11]) r4.push({ date: f, start_time: `${f}T${String(h).padStart(2, "0")}:00:00+00:00`, end_time: `${f}T${String(h + 1).padStart(2, "0")}:00:00+00:00`, status: "completed" }); }
});
const m4 = construirMapa(r4, 4, "2026-10-05", "2026-11-01");
const lun = m4.cells.filter((c) => c.dow === 1);
ok(lun.length === 3 && Math.abs(lun[0].avg - lun[1].avg) < 1e-9 && Math.abs(lun[1].avg - lun[2].avg) < 1e-9, "lunes: las horas 9, 10 y 11 tienen la misma carga (antes solo la 9 tenía datos)");
ok(Math.abs(m4.cells.find((c) => c.dow === 1 && c.hour === 10)!.avg - m4.cells.find((c) => c.dow === 2 && c.hour === 10)!.avg) < 1e-9, "una hora ocupada por una cita larga pesa igual que una ocupada por una corta");
ok(nivelesPorDia(m4).get(1)!.nivel !== "flojo" && nivelesPorHora(m4).every((h) => h.nivel !== "flojo"), "el lunes (servicios largos) ya no sale como día flojo ni las horas 10 y 11 como flojas");
console.log(fallos ? `\n${fallos} fallas` : "\nTodo bien"); 
const semana = (dows: number[]) => { const out: string[] = []; for (let w = 0; w < 4; w++) for (const dow of dows) { const d = new Date(Date.UTC(2026, 9, 19 + w * 7 + (dow - 1))); out.push(d.toISOString().slice(0, 10)); } return out; };
// ---- Cada negocio con SU horario (caso Estudio Levels: lun-vie 10 a 20, sábado 9 a 17, colación 14 a 15 el lunes) ----
{
  const hor = (barber_id: string, dow: number, a: string, z: string, extra: any = {}) => ({ barber_id, day_of_week: dow, is_working: true, start_time: a, end_time: z, ...extra });
  const horarios: any[] = [];
  for (const dow of [1, 2, 3, 4, 5]) horarios.push(hor("p1", dow, "10:00", "20:00"), hor("p2", dow, "10:00", "20:00"));
  horarios[0] = hor("p1", 1, "10:00", "20:00", { break_start: "14:00", break_end: "15:00" }); // colación del lunes
  horarios.push(hor("p1", 6, "09:00", "17:00"), hor("p2", 6, "09:00", "17:00"));
  const desde = "2026-10-19", hasta = "2026-11-15"; // 4 semanas completas
  const disp = disponibilidadPorDiaHora({ proIds: ["p1", "p2"], horarios, descansos: [], bloqueos: [], vacaciones: [], desde, hasta });
  ok(disp["1-10"] === 8 && disp["6-9"] === 8 && !disp["6-17"] && !disp["1-9"] && !disp["1-20"], "disponibilidad: lun 10 sí, sáb 9 sí, sáb 17 no, lun 9 y 20 no");
  ok(disp["1-14"] === 4, "disponibilidad: la colación (14 a 15 del lunes de p1) no cuenta (solo p2 trabaja esa hora)");
  const filas: any[] = [];
  for (const d of semana([1, 2, 3, 4, 5])) for (const h of [10, 11, 12, 13, 15, 16, 17, 18, 19]) filas.push({ date: d, start_time: `${d}T${h}:00:00+00:00`.replace("T1:", "T01:"), end_time: `${d}T${h + 1}:00:00+00:00`, status: "completed" });
  for (const d of semana([6])) for (const h of [9, 10, 11, 12, 13, 14, 15, 16]) filas.push({ date: d, start_time: `${d}T${String(h).padStart(2, "0")}:00:00+00:00`, end_time: `${d}T${String(h + 1).padStart(2, "0")}:00:00+00:00`, status: "completed" });
  const mp = construirMapa(filas, 4, desde, hasta, disp);
  ok(mp.fuente === "horarios", "usa los horarios del equipo");
  ok(estaAbierta(mp, 6, 9) && !estaAbierta(mp, 6, 17) && !estaAbierta(mp, 1, 9) && estaAbierta(mp, 1, 19) && !estaAbierta(mp, 1, 20), "abierto: sáb 9 sí, sáb 17 no, lun 9 no, lun 19 sí, lun 20 no");
  ok(!estaAbierta(mp, 7, 12), "el domingo no se atiende");
  ok(mp.horas[0] === 9 && mp.horas[mp.horas.length - 1] === 19, `las filas van de 9 a 19 (${mp.horas[0]}..${mp.horas[mp.horas.length - 1]})`);
  ok(resumenHorario(mp) === "Lun a Vie 10:00–20:00 · Sáb 09:00–17:00", `resumen del horario: ${resumenHorario(mp)}`);
  const flojos = horariosFlojos(mp, [], 40);
  ok(flojos.every((f) => estaAbierta(mp, f.dow, f.hour)), "ningún horario flojo cae fuera del horario de ese día");
  ok(!flojos.some((f) => f.dow === 6 && f.hour >= 17) && !flojos.some((f) => f.dow === 1 && f.hour === 9), "no sugiere promocionar a las 17 o 18 del sábado, ni el lunes a las 9");
  const horasNiv = nivelesPorHora(mp);
  ok(horasNiv.find((h) => h.hour === 9)!.avg > 0, "las 9 se promedian solo con el sábado (único día que abre a esa hora, no se diluye con lunes a viernes)");
}
// ---- Un negocio con otros horarios y servicios largos (tipo Looky): lo abierto lo marca SU horario, no el de otro ----
{
  const horarios: any[] = [1, 2, 3, 4, 5, 6].map((dow) => ({ barber_id: "a", day_of_week: dow, is_working: true, start_time: "08:00", end_time: "19:00" }));
  const disp = disponibilidadPorDiaHora({ proIds: ["a"], horarios, descansos: [], bloqueos: [], vacaciones: [], desde: "2026-10-19", hasta: "2026-11-15" });
  const mp = construirMapa([{ date: "2026-10-20", start_time: "2026-10-20T09:00:00+00:00", end_time: "2026-10-20T12:00:00+00:00", status: "completed" }], 4, "2026-10-19", "2026-11-15", disp);
  ok(estaAbierta(mp, 2, 8) && estaAbierta(mp, 2, 18) && !estaAbierta(mp, 2, 19) && estaAbierta(mp, 6, 8), "otro negocio: abre a las 8 y cierra a las 19, también el sábado");
  ok(resumenHorario(mp) === "Lun a Sáb 08:00–19:00", `resumen: ${resumenHorario(mp)}`);
}
// ---- Sin horarios cargados: cada día toma su propio rango según las reservas ----
{
  const r: any[] = []; const f = (date: string, h: number, n: number) => { for (let i = 0; i < n; i++) r.push({ date, start_time: `${date}T${String(h).padStart(2, "0")}:00:00+00:00`, end_time: `${date}T${String(h + 1).padStart(2, "0")}:00:00+00:00`, status: "completed" }); };
  for (const d of ["2026-10-19", "2026-10-26"]) { for (const h of [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]) f(d, h, 4); }           // lunes 10 a 20
  for (const d of ["2026-10-24", "2026-10-31"]) { for (const h of [9, 10, 11, 12, 13, 14, 15, 16]) f(d, h, 4); }                   // sábado 9 a 17
  const mp = construirMapa(r, 2, "2026-10-19", "2026-11-01");
  ok(mp.fuente === "reservas" && estaAbierta(mp, 6, 9) && !estaAbierta(mp, 6, 17) && !estaAbierta(mp, 1, 9) && estaAbierta(mp, 1, 19), "sin horarios: lunes 10-20 y sábado 9-17 por separado");
  ok(!horariosFlojos(mp, [], 40).some((x) => x.dow === 6 && x.hour >= 17), "sin horarios: tampoco sugiere horas fuera de lo que ese día atiende");
}

// ---- Los horarios cargados son MÁS amplios que lo que se atiende de verdad (caso real: horario hasta las 23, se cierra a las 20) ----
{
  const horarios: any[] = [1, 2, 3, 4, 5].map((dow) => ({ barber_id: "a", day_of_week: dow, is_working: true, start_time: "10:00", end_time: "23:00" }));
  horarios.push({ barber_id: "a", day_of_week: 0, is_working: true, start_time: "12:00", end_time: "18:00" }); // domingo configurado, pero sin reservas
  const desde = "2026-10-19", hasta = "2026-11-15";
  const disp = disponibilidadPorDiaHora({ proIds: ["a"], horarios, descansos: [], bloqueos: [], vacaciones: [], desde, hasta });
  const filas: any[] = [];
  for (const d of semana([1, 2, 3, 4, 5])) for (const h of [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]) filas.push({ date: d, start_time: `${d}T${String(h).padStart(2, "0")}:00:00+00:00`, end_time: `${d}T${String(h + 1).padStart(2, "0")}:00:00+00:00`, status: "completed" });
  const mp = construirMapa(filas, 4, desde, hasta, disp);
  ok(estaAbierta(mp, 1, 19) && !estaAbierta(mp, 1, 20) && !estaAbierta(mp, 1, 22), "horario cargado hasta las 23 pero solo hay reservas hasta las 20: el horario termina a las 20");
  ok(!estaAbierta(mp, 7, 13), "un domingo configurado pero sin reservas no se considera abierto");
  ok(resumenHorario(mp) === "Lun a Vie 10:00–20:00", `resumen: ${resumenHorario(mp)}`);
  ok(mp.horas[mp.horas.length - 1] === 19, "las filas del mapa terminan a las 19 (no llegan a las 22)");
  // Colación: queda dentro del rango pero fuera del horario si nadie atiende esa hora y no hay reservas.
  const h2: any[] = [1].map((dow) => ({ barber_id: "a", day_of_week: dow, is_working: true, start_time: "10:00", end_time: "20:00", break_start: "14:00", break_end: "15:00" }));
  const d2 = disponibilidadPorDiaHora({ proIds: ["a"], horarios: h2, descansos: [], bloqueos: [], vacaciones: [], desde, hasta });
  const f2: any[] = []; for (const d of semana([1])) for (const h of [10, 11, 12, 13, 15, 16, 17, 18, 19]) f2.push({ date: d, start_time: `${d}T${String(h).padStart(2, "0")}:00:00+00:00`, end_time: `${d}T${String(h + 1).padStart(2, "0")}:00:00+00:00`, status: "completed" });
  const m2 = construirMapa(f2, 4, desde, hasta, d2);
  ok(!estaAbierta(m2, 1, 14) && estaAbierta(m2, 1, 13) && estaAbierta(m2, 1, 15), "la colación de las 14 queda fuera del horario (no es demanda baja)");
  ok(!horariosFlojos(m2, [], 40).some((f) => f.hour === 14), "y no se sugiere promocionar la hora de colación");
}

// ---- Negocio de servicios largos (tipo Looky): se mide por BLOQUES DE TRABAJO, no por hora ----
{
  const filas: any[] = [];
  const lun = (w: number) => { const d = new Date(Date.UTC(2026, 8, 7 + 7 * w)); return d.toISOString().slice(0, 10); }; // lunes desde el 7-sep
  const mas = (f: string, k: number) => new Date(Date.parse(f) + k * 86400000).toISOString().slice(0, 10);
  const cita = (f: string, h: number, min: number, dur: number) => filas.push({ date: f, start_time: `${f}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+00:00`, end_time: `${f}T${String(h + Math.floor((min + dur) / 60)).padStart(2, "0")}:${String((min + dur) % 60).padStart(2, "0")}:00+00:00`, status: "completed" });
  for (let w = 0; w < 8; w++) {
    const L = lun(w);
    for (const k of [0, 1, 2, 3]) { cita(mas(L, k), 10, 0, 180); if (w % 2 === 0) cita(mas(L, k), 14, 0, 180); } // lun a jue: bloque 10-13 siempre, 14-17 cada 2 semanas
    cita(mas(L, 4), 10, 0, 120); // viernes: solo bloque 10-12
    if (w % 4 === 0) cita(mas(L, 5), 9, 30, 120); // sabado esporadico
  }
  const mb = construirMapa(filas, 8, "2026-09-07", "2026-11-01");
  ok(mb.modo === "bloques" && (mb.bloques || []).length >= 2, `detecta negocio por bloques (${mb.modo}, ${(mb.bloques || []).map((b) => b.etiqueta).join(" | ")})`);
  const b1 = mb.bloques?.find((b) => b.hour === 10), b2 = mb.bloques?.find((b) => b.hour === 14);
  ok(!!b1 && b1.etiqueta === "10:00–13:00", `bloque de la mañana 10:00–13:00 (${b1?.etiqueta})`);
  ok(!!b2 && b2.etiqueta === "14:00–17:00", `bloque de la tarde 14:00–17:00 (${b2?.etiqueta})`);
  ok(mb.cells.find((c) => c.dow === 1 && c.hour === 10)?.avg === 1, "cada lunes hay una reserva en el bloque de la mañana");
  ok(mb.cells.find((c) => c.dow === 1 && c.hour === 14)?.avg === 0.5, "la tarde se reserva cada 2 semanas (0,5 por semana)");
  ok(!horariosFlojos(mb, [], 40).some((f) => f.hour === 11 || f.hour === 12), "no aparecen horas sueltas (11, 12): solo bloques");
  ok(mb.horas.every((h) => h === 9 || h === 10 || h === 14), `las filas son solo los bloques (${mb.horas.join()})`);
  ok(resumenHorario(mb).includes("10:00–13:00"), `el resumen habla de bloques (${resumenHorario(mb)})`);
  // un negocio de servicios cortos sigue por horas
  const cortos: any[] = []; for (let w = 0; w < 4; w++) for (const h of [10, 11, 12, 15]) for (let i = 0; i < 3; i++) { const f = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"][w]; cortos.push({ date: f, start_time: `${f}T${h}:00:00+00:00`, end_time: `${f}T${h}:45:00+00:00`, status: "completed" }); }
  ok(construirMapa(cortos, 4, "2026-10-05", "2026-11-01").modo !== "bloques", "servicios de 45 min siguen midiéndose por hora");
}
process.exit(fallos ? 1 : 0);
