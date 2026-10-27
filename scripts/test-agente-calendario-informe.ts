import assert from "node:assert/strict";
import { decidirInforme, PreferenciaCalendarioInforme, POLITICA_INFORME } from "../src/lib/agente/calendario-informe";

const p: PreferenciaCalendarioInforme = { enabled: true, frequency: "daily", custom_weekdays: [], weekly_weekday: null, anchor_date: null, send_local_time: null, effective_from: "2026-01-01" };
let checks = 0;
function check(label: string, fn: () => void) { fn(); checks++; console.log(`OK ${label}`); }
const decision = (now: number, overrides: Partial<PreferenciaCalendarioInforme> = {}, last: string | null = null) => decidirInforme({ ...p, ...overrides }, now, last);
check("política central decidida por Nico, mismo día a las 21:00", () => assert.deepEqual(POLITICA_INFORME, { diasAntes: 0, horaPredeterminada: "21:00" }));
check("un segundo antes de hora local no corresponde", () => assert.deepEqual(decision(Date.UTC(2026,9,26,23,59,59)), { toca: false, motivo: "antes_de_hora" }));
check("21:00 local informa hoy aunque UTC ya es mañana", () => assert.deepEqual(decision(Date.UTC(2026,9,27,0)), { toca: true, fechaInformada: "2026-10-26", fechaProgramada: "2026-10-26" }));
check("hora elegida por admin reemplaza predeterminada", () => assert.equal(decision(Date.UTC(2026,9,27,0), { send_local_time: "22:00" }).toca, false));
check("hora con segundos SQL se respeta", () => assert.equal(decision(Date.UTC(2026,9,27,0,0,29), { send_local_time: "21:00:30" }).toca, false));
check("hora con segundos SQL exacta", () => assert.equal(decision(Date.UTC(2026,9,27,0,0,30), { send_local_time: "21:00:30" }).toca, true));
check("última fecha informada impide repetición", () => assert.deepEqual(decision(Date.UTC(2026,9,27,0), {}, "2026-10-26"), { toca: false, motivo: "ya_informado" }));
check("última fecha futura falla cerrado", () => assert.equal(decision(Date.UTC(2026,9,27,0), {}, "2026-10-27").toca, false));
check("fecha anterior no bloquea siguiente informe", () => assert.equal(decision(Date.UTC(2026,9,27,0), {}, "2026-10-25").toca, true));
check("effective_from futuro no recibe", () => assert.deepEqual(decision(Date.UTC(2026,9,27,0), { effective_from: "2026-10-27" }), { toca: false, motivo: "fuera_de_calendario" }));
check("apagado no recibe", () => assert.deepEqual(decision(Date.UTC(2026,9,27,0), { enabled: false }), { toca: false, motivo: "apagado" }));
check("fila apagada sin vigencia ni hora tolera configuración incompleta", () => assert.deepEqual(decision(Date.UTC(2026,9,27,0), { enabled: false, effective_from: null, frequency: "weekly", weekly_weekday: null }), { toca: false, motivo: "apagado" }));
check("encendido sin vigencia se rechaza", () => assert.throws(() => decision(Date.UTC(2026,9,27,0), { effective_from: null })));
check("23:59 informa el mismo día local", () => assert.deepEqual(decision(Date.UTC(2026,9,27,2,59), { send_local_time: "00:00" }), { toca: true, fechaInformada: "2026-10-26", fechaProgramada: "2026-10-26" }));
check("medianoche con hora personalizada informa el día local nuevo", () => assert.deepEqual(decision(Date.UTC(2026,9,27,3), { send_local_time: "00:00" }), { toca: true, fechaInformada: "2026-10-27", fechaProgramada: "2026-10-27" }));
for (const [year, month, day, expected] of [[2027,0,1,"2027-01-01"], [2028,1,29,"2028-02-29"], [2026,2,1,"2026-03-01"]] as const) {
  check(`día informado borde ${expected}`, () => { const d = decision(Date.UTC(year,month,day+1,0)); assert.ok(d.toca); if(d.toca) assert.equal(d.fechaInformada, expected); });
}
check("adelanto Chile: hora inexistente elegible en primera pasada posterior (IA3)", () => assert.equal(decision(Date.UTC(2026,8,6,4), { send_local_time: "00:30" }).toca, true));
check("retroceso Chile: primer tramo informa una vez", () => { const d=decision(Date.UTC(2026,3,5,2,59), { send_local_time: "23:00" }); assert.ok(d.toca); if(d.toca) assert.equal(d.fechaInformada,"2026-04-04"); });
check("retroceso Chile: última fecha impide duplicar en hora repetida", () => assert.equal(decision(Date.UTC(2026,3,5,3), { send_local_time: "23:00" }, "2026-04-04").toca, false));
check("cada 3 días: distancia civil cruza horario de verano", () => assert.equal(decision(Date.UTC(2026,8,8,0), { frequency: "every_3_days", anchor_date: "2026-09-04" }).toca, true));
check("cada 3 días: no adelanta fecha intermedia", () => assert.equal(decision(Date.UTC(2026,8,7,0), { frequency: "every_3_days", anchor_date: "2026-09-04" }).toca, false));
check("semanal lunes", () => assert.equal(decision(Date.UTC(2026,9,27,0), { frequency: "weekly", weekly_weekday: 1 }).toca,true));
check("personalizado martes no lunes", () => assert.equal(decision(Date.UTC(2026,9,27,0), { frequency: "custom", custom_weekdays:[2] }).toca,false));
check("cambio de frecuencia con nueva ancla sin retroactividad", () => assert.equal(decision(Date.UTC(2026,9,27,0), { frequency:"every_3_days", anchor_date:"2026-10-27", effective_from:"2026-10-27" }).toca,false));
check("a medianoche la hora por defecto no recupera el informe de ayer", () => assert.deepEqual(decision(Date.UTC(2026,9,27,3)), { toca: false, motivo: "antes_de_hora" }));
check("hora personalizada anterior informa hoy", () => assert.deepEqual(decision(Date.UTC(2026,9,26,23,30), { send_local_time: "20:30" }), { toca: true, fechaInformada: "2026-10-26", fechaProgramada: "2026-10-26" }));
for (const [y,m,d,h,expected] of [
  [2026,3,5,0,"2026-04-04"], [2026,3,6,1,"2026-04-05"],
  [2026,8,6,1,"2026-09-05"], [2026,8,7,0,"2026-09-06"],
] as const) {
  check(`21:00 Santiago en borde DST ${expected} conserva día`, () => assert.deepEqual(decision(Date.UTC(y,m,d,h)), { toca: true, fechaInformada: expected, fechaProgramada: expected }));
  check(`un segundo antes de 21:00 en borde DST ${expected}`, () => assert.deepEqual(decision(Date.UTC(y,m,d,h)-1000), { toca: false, motivo: "antes_de_hora" }));
}
for(const bad of [NaN, Infinity, 9e99]) check(`rechaza instante inválido ${bad}`,()=>assert.throws(()=>decision(bad)));
for(const bad of ["24:00", "08:60", "8:00", "08:00:60"]) check(`rechaza hora ${bad}`,()=>assert.throws(()=>decision(Date.UTC(2026,9,27,0),{send_local_time:bad})));
check("rechaza última fecha imposible",()=>assert.throws(()=>decision(Date.UTC(2026,9,27,0),{},"2026-02-31")));
console.log(`RESULTADO: ${checks} casos, 0 fallas; calendario puro sin red/base/llaves/envíos.`);
