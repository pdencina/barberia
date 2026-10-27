import assert from "node:assert/strict";
import { decidirInforme, PreferenciaCalendarioInforme, POLITICA_PROVISIONAL_INFORME } from "../src/lib/agente/calendario-informe";

const p: PreferenciaCalendarioInforme = { enabled: true, frequency: "daily", custom_weekdays: [], weekly_weekday: null, anchor_date: null, send_local_time: null, effective_from: "2026-01-01" };
let checks = 0;
function check(label: string, fn: () => void) { fn(); checks++; console.log(`OK ${label}`); }
const decision = (now: number, overrides: Partial<PreferenciaCalendarioInforme> = {}, last: string | null = null) => decidirInforme({ ...p, ...overrides }, now, last);
check("política central provisional, no confirmada por Nico", () => assert.deepEqual(POLITICA_PROVISIONAL_INFORME, { diasAntes: 1, horaPredeterminada: "08:00" }));
check("un segundo antes de hora local no corresponde", () => assert.deepEqual(decision(Date.UTC(2026,9,26,10,59,59)), { toca: false, motivo: "antes_de_hora" }));
check("hora provisional exacta informa ayer", () => assert.deepEqual(decision(Date.UTC(2026,9,26,11)), { toca: true, fechaInformada: "2026-10-25", fechaProgramada: "2026-10-26" }));
check("hora elegida por admin reemplaza predeterminada", () => assert.equal(decision(Date.UTC(2026,9,26,11), { send_local_time: "09:00" }).toca, false));
check("hora con segundos SQL se respeta", () => assert.equal(decision(Date.UTC(2026,9,26,11,0,29), { send_local_time: "08:00:30" }).toca, false));
check("hora con segundos SQL exacta", () => assert.equal(decision(Date.UTC(2026,9,26,11,0,30), { send_local_time: "08:00:30" }).toca, true));
check("última fecha informada impide repetición", () => assert.deepEqual(decision(Date.UTC(2026,9,26,12), {}, "2026-10-25"), { toca: false, motivo: "ya_informado" }));
check("última fecha futura falla cerrado", () => assert.equal(decision(Date.UTC(2026,9,26,12), {}, "2026-10-27").toca, false));
check("fecha anterior no bloquea siguiente informe", () => assert.equal(decision(Date.UTC(2026,9,26,12), {}, "2026-10-24").toca, true));
check("effective_from futuro no recibe", () => assert.deepEqual(decision(Date.UTC(2026,9,26,12), { effective_from: "2026-10-27" }), { toca: false, motivo: "fuera_de_calendario" }));
check("apagado no recibe", () => assert.deepEqual(decision(Date.UTC(2026,9,26,12), { enabled: false }), { toca: false, motivo: "apagado" }));
check("fila apagada sin vigencia ni hora tolera configuración incompleta", () => assert.deepEqual(decision(Date.UTC(2026,9,26,12), { enabled: false, effective_from: null, frequency: "weekly", weekly_weekday: null }), { toca: false, motivo: "apagado" }));
check("encendido sin vigencia se rechaza", () => assert.throws(() => decision(Date.UTC(2026,9,26,12), { effective_from: null })));
check("medianoche conserva día anterior al cambio", () => assert.deepEqual(decision(Date.UTC(2026,9,27,2,59), { send_local_time: "00:00" }), { toca: true, fechaInformada: "2026-10-25", fechaProgramada: "2026-10-26" }));
check("medianoche nueva informa fecha anterior correcta", () => assert.deepEqual(decision(Date.UTC(2026,9,27,3), { send_local_time: "00:00" }), { toca: true, fechaInformada: "2026-10-26", fechaProgramada: "2026-10-27" }));
for (const [year, month, day, expected] of [[2027,0,1,"2026-12-31"], [2028,2,1,"2028-02-29"], [2026,2,1,"2026-02-28"]] as const) {
  check(`día informado borde ${expected}`, () => { const d = decision(Date.UTC(year,month,day,15)); assert.ok(d.toca); if(d.toca) assert.equal(d.fechaInformada, expected); });
}
check("adelanto Chile: hora inexistente elegible en primera pasada posterior (IA3)", () => assert.equal(decision(Date.UTC(2026,8,6,4), { send_local_time: "00:30" }).toca, true));
check("retroceso Chile: primer tramo informa una vez", () => { const d=decision(Date.UTC(2026,3,5,2,59), { send_local_time: "23:00" }); assert.ok(d.toca); if(d.toca) assert.equal(d.fechaInformada,"2026-04-03"); });
check("retroceso Chile: última fecha impide duplicar en hora repetida", () => assert.equal(decision(Date.UTC(2026,3,5,3), { send_local_time: "23:00" }, "2026-04-03").toca, false));
check("cada 3 días: distancia civil cruza horario de verano", () => assert.equal(decision(Date.UTC(2026,8,7,12), { frequency: "every_3_days", anchor_date: "2026-09-04" }).toca, true));
check("cada 3 días: no adelanta fecha intermedia", () => assert.equal(decision(Date.UTC(2026,8,6,12), { frequency: "every_3_days", anchor_date: "2026-09-04" }).toca, false));
check("semanal lunes", () => assert.equal(decision(Date.UTC(2026,9,26,12), { frequency: "weekly", weekly_weekday: 1 }).toca,true));
check("personalizado martes no lunes", () => assert.equal(decision(Date.UTC(2026,9,26,12), { frequency: "custom", custom_weekdays:[2] }).toca,false));
check("cambio de frecuencia con nueva ancla sin retroactividad", () => assert.equal(decision(Date.UTC(2026,9,26,12), { frequency:"every_3_days", anchor_date:"2026-10-27", effective_from:"2026-10-27" }).toca,false));
for(const bad of [NaN, Infinity, 9e99]) check(`rechaza instante inválido ${bad}`,()=>assert.throws(()=>decision(bad)));
for(const bad of ["24:00", "08:60", "8:00", "08:00:60"]) check(`rechaza hora ${bad}`,()=>assert.throws(()=>decision(Date.UTC(2026,9,26,12),{send_local_time:bad})));
check("rechaza última fecha imposible",()=>assert.throws(()=>decision(Date.UTC(2026,9,26,12),{},"2026-02-31")));
console.log(`RESULTADO: ${checks} casos, 0 fallas; calendario puro sin red/base/llaves/envíos.`);
