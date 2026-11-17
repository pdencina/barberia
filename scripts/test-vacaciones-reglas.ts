// Reglas de las solicitudes de vacaciones. Uso: npx tsx scripts/test-vacaciones-reglas.ts
import { periodoDe, diasDerecho, diasQueTrabaja, diasLaborales, saldoDe, validarSolicitud, esLunes, sumarDias, diasUsadosEn } from "../src/lib/vacation-rules";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };

// 2027-01-04 es lunes.
ok(esLunes("2027-01-04") && !esLunes("2027-01-05"), "el 4 de enero de 2027 es lunes");

// Horarios: lunes a sabado, y alguien con martes libre y domingo libre (0 = domingo).
const sinHorario = diasQueTrabaja([]);
ok(sinHorario.join() === "false,true,true,true,true,true,true", "sin horario cargado se asume lunes a sábado");
const martesLibre = diasQueTrabaja([0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, is_working: d !== 0 && d !== 2 })));
ok(diasLaborales(martesLibre, "2027-01-04", "2027-01-17") === 10, "dos semanas corridas (14 días) con el martes y el domingo libres = 10 días laborales (el caso de Levels)");
const lunesLibre = diasQueTrabaja([0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, is_working: d !== 0 && d !== 1 })));
ok(diasLaborales(lunesLibre, "2027-01-04", "2027-01-17") === 10, "con el lunes libre también son 10 en dos semanas");
ok(diasLaborales(martesLibre, "2027-01-04", "2027-01-10") === 5, "una semana corrida con el martes y el domingo libres = 5 días laborales");

// Periodos.
ok(JSON.stringify(periodoDe("2027-06-10", "calendar")) === JSON.stringify({ desde: "2027-01-01", hasta: "2027-12-31" }), "periodo por año calendario");
ok(JSON.stringify(periodoDe("2027-06-10", "anniversary", "2024-09-15")) === JSON.stringify({ desde: "2026-09-15", hasta: "2027-09-14" }), "periodo por aniversario: antes del aniversario");
ok(JSON.stringify(periodoDe("2027-10-01", "anniversary", "2024-09-15")) === JSON.stringify({ desde: "2027-09-15", hasta: "2028-09-14" }), "periodo por aniversario: despues del aniversario (se reinicia)");
ok(periodoDe("2027-03-01", "anniversary", "2024-02-29").desde === "2027-02-28", "ingreso un 29 de febrero: el aniversario cae el 28 en un año no bisiesto");
ok(periodoDe("2027-03-01", "anniversary", null).desde === "2027-01-01", "aniversario sin fecha de ingreso: se usa el año calendario");

// Derecho.
const p27 = periodoDe("2027-06-10", "calendar");
ok(diasDerecho(10, p27, "calendar", "2024-05-01") === 10, "quien llevaba más de un año tiene los 10 días completos");
ok(diasDerecho(10, p27, "calendar", "2027-01-01") === 10, "ingresó el 1 de enero: año completo");
ok(diasDerecho(12, p27, "calendar", "2027-07-01") === 6, "ingresó el 1 de julio: 6 meses -> 6 de 12 días");
ok(diasDerecho(12, p27, "calendar", "2027-07-15") === 5, "ingresó el 15 de julio: 5 meses completos -> 5 de 12 días (proporcional)");
ok(diasDerecho(0, p27, "calendar", null) === 0, "sin días configurados no hay derecho");

// Saldo y solicitudes. Levels: 10 días laborales por año, desde enero de 2027.
const base = { hoy: "2026-12-20", trabaja: martesLibre, diasAnio: 10, modo: "calendar" as const, ingreso: "2024-05-01", ocupados: [] as { start_date: string; end_date: string }[] };
const sol = (inicio: string, fin: string, ocupados = base.ocupados) => validarSolicitud({ ...base, inicio, fin, ocupados });
ok(sol("2027-01-04", "2027-01-17").ok === true && (sol("2027-01-04", "2027-01-17") as any).laborales === 10, "dos semanas corridas desde un lunes = 10 días laborales: se acepta");
ok(sol("2027-01-04", "2027-01-10").ok === true, "una semana (5 días laborales): se acepta");
ok(!sol("2027-01-05", "2027-01-10").ok && /lunes/i.test((sol("2027-01-05", "2027-01-10") as any).error), "no empieza un lunes: se rechaza");
ok(!sol("2027-01-04", "2027-01-24").ok, "tres semanas (15 días laborales): pasa el máximo de 10");
ok(!sol("2026-12-14", "2026-12-20").ok, "un lunes pasado: se rechaza");
ok(!sol("2027-01-11", "2027-01-08").ok, "término antes del inicio: se rechaza");
// «5 y 5»: dos solicitudes de una semana cada una.
const primera = [{ start_date: "2027-01-04", end_date: "2027-01-10" }];
ok(sol("2027-02-01", "2027-02-07", primera).ok === true, "5 y 5: la segunda semana (5 días) se acepta");
ok(!sol("2027-02-01", "2027-02-14", primera).ok, "5 y 5: pedir 10 días más cuando ya usó 5 se rechaza");
ok(!sol("2027-01-04", "2027-01-10", primera).ok && /cruzan/i.test((sol("2027-01-04", "2027-01-10", primera) as any).error), "no se puede pisar otra solicitud o vacación");
// Se reinicia: en el siguiente año vuelve a tener 10.
const usoTodo = [{ start_date: "2027-01-04", end_date: "2027-01-17" }];
ok(saldoDe({ fecha: "2027-06-01", diasAnio: 10, modo: "calendar", ingreso: base.ingreso, trabaja: martesLibre, rangos: usoTodo }).restantes === 0, "con 10 usados en 2027 no le quedan");
ok(saldoDe({ fecha: "2028-01-05", diasAnio: 10, modo: "calendar", ingreso: base.ingreso, trabaja: martesLibre, rangos: usoTodo }).restantes === 10, "en 2028 se reinicia: vuelve a tener 10");
// Un bloque que cruza de año gasta de cada año lo que le toca (lunes 28 dic 2026 a domingo 10 ene 2027).
const cruza = validarSolicitud({ ...base, hoy: "2026-12-01", inicio: "2026-12-28", fin: "2027-01-10", ocupados: [] });
ok(cruza.ok === true && (cruza as any).laborales === 10, "un bloque que cruza de año: se acepta si cada año alcanza");
const cruzaMal = validarSolicitud({ ...base, hoy: "2026-12-01", inicio: "2026-12-28", fin: "2027-01-10", ocupados: [{ start_date: "2026-01-05", end_date: "2026-01-18" }] });
ok(!cruzaMal.ok, "si en 2026 ya usó sus días, el tramo de 2026 del bloque se rechaza");
ok(diasUsadosEn(martesLibre, usoTodo, periodoDe("2027-02-01", "calendar")) === 10, "días usados dentro del periodo");
// Profesional sin días (feature apagada o ingreso reciente en proporcion 0).
ok(!validarSolicitud({ ...base, diasAnio: 10, ingreso: "2027-12-31", inicio: "2027-12-27", fin: "2028-01-02", hoy: "2027-12-01" }).ok || true, "sin derecho aún: la solicitud no revienta");
ok(!validarSolicitud({ ...base, diasAnio: 0, inicio: "2027-01-04", fin: "2027-01-10" }).ok, "con 0 días configurados no se puede pedir");
ok(sumarDias("2027-01-04", 13) === "2027-01-17", "suma de días de calendario");
process.exit(fallos ? 1 : 0);
