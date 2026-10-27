import assert from "node:assert/strict";
import { renderDailyReportEmail } from "../src/lib/agente/informe-diario-email";
import type { DailyAppointmentReport } from "../src/lib/agente/informe-diario";

const report = (date: string): DailyAppointmentReport => ({
  date, tenantId: "negocio-ficticio", businessName: "Negocio ficticio",
  totalAppointments: 0, pendingAppointments: 0, cancelledAppointments: 0,
  noShowAppointments: 0, professionals: [],
});
let checks = 0;
function check(label: string, fn: () => void) { fn(); checks++; console.log(`OK ${label}`); }
for (const [year,month,day,hour,date] of [
  [2026,9,27,0,"2026-10-26"], // UTC de mañana, mismo día chileno
  [2026,3,5,0,"2026-04-04"], [2026,3,6,1,"2026-04-05"],
  [2026,8,6,1,"2026-09-05"], [2026,8,7,0,"2026-09-06"],
] as const) {
  check(`correo 21:00 Santiago ${date}, incluso cambio DST`, () => {
    const html = renderDailyReportEmail(report(date), Date.UTC(year,month,day,hour));
    assert.ok(html.includes("Citas de hoy, generado a las 21:00 (hora de Santiago)"));
    assert.ok(html.includes("La información puede cambiar después de esta hora."));
  });
}
check("correo a hora elegida por administrador", () => assert.ok(renderDailyReportEmail(report("2026-10-26"), Date.UTC(2026,9,27,1,17)).includes("Citas de hoy, generado a las 22:17")));
check("medianoche cambia el día del correo sin reutilizar ayer", () => assert.ok(renderDailyReportEmail(report("2026-10-27"), Date.UTC(2026,9,27,3)).includes("Citas de hoy, generado a las 00:00")));
check("informe manual de otra fecha no se presenta como hoy", () => {
  const html = renderDailyReportEmail(report("2026-10-25"), Date.UTC(2026,9,27,0));
  assert.ok(!html.includes("Citas de hoy"));
  assert.ok(html.includes("Citas del 2026-10-25, generado a las 21:00 del 2026-10-26"));
});
check("sin instante explícito conserva fecha sin inventar hora ni consultar reloj", () => {
  const html = renderDailyReportEmail(report("2026-10-26"));
  assert.ok(html.includes("Citas del 2026-10-26")); assert.ok(!html.includes("generado a las"));
});
check("el encabezado histórico escapa la fecha recibida", () => assert.ok(!renderDailyReportEmail(report("<script>"), Date.UTC(2026,9,27,0)).includes("<script>")));
check("instante inválido se rechaza", () => assert.throws(() => renderDailyReportEmail(report("2026-10-26"), NaN)));
check("el pie explica como dejar de recibir el informe (Mi Perfil > Informes), sin datos del cliente", () => {
  const html = renderDailyReportEmail(report("2026-10-26"), Date.UTC(2026, 9, 27, 0));
  assert.ok(html.includes("Para dejar de recibirlo") && html.includes("Mi Perfil") && html.includes("Informes"));
});
console.log(`RESULTADO: ${checks} casos, 0 fallas; HTML con instantes fijos, sin red/base/llaves/envíos.`);
