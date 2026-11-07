// Mapa de demanda. Uso: npx tsx scripts/test-demand-map.ts
import { construirMapa, horariosFlojos, diaSemana, horaDe, nivelesPorDia, nivelesPorHora, minutosPorHora } from "../src/lib/demand-map";
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
console.log(fallos ? `\n${fallos} fallas` : "\nTodo bien"); process.exit(fallos ? 1 : 0);
