// Pruebas sin red, base ni llaves para la fase 1 del agente.
// Ejecutar: npx tsx scripts/test-agente-informe.ts
import {
  buildDailyAppointmentReport,
  createDailyAppointmentReport,
  fetchDailyAppointmentRows,
  getDailyReportSettings,
  isValidReportDate,
  wallClockTime,
  type DailyAppointmentRow,
} from "../src/lib/agente/informe-diario";
import { renderDailyReportEmail } from "../src/lib/agente/informe-diario-email";

let failures = 0;
let checks = 0;
function test(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${detail ? ` -> ${detail}` : ""}`);
}

const tenantId = "tenant-prueba";
const date = "2026-10-26";
const row = (overrides: Partial<DailyAppointmentRow> = {}): DailyAppointmentRow => ({
  id: "cita-1",
  tenant_id: tenantId,
  date,
  start_time: "2026-10-26T10:00:00+00:00",
  status: "scheduled",
  client: { name: "Cliente prueba" },
  barber: { name: "Ana" },
  services: [{ service: { name: "Corte" } }],
  ...overrides,
});

function fakePagedSupabase(rows: DailyAppointmentRow[]) {
  const filters: Array<[string, unknown]> = [];
  const requests: Array<{ from: number; to: number; filters: Array<[string, unknown]>; orderBy: string; ascending: boolean }> = [];
  return {
    filters,
    requests,
    from(table: string) {
      if (table !== "appointments") throw new Error(`Tabla inesperada: ${table}`);
      const queryFilters: Array<[string, unknown]> = [];
      let orderBy = "";
      let ascending = false;
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          queryFilters.push([column, value]);
          return builder;
        },
        order: (column: string, options: { ascending: boolean }) => {
          orderBy = column;
          ascending = options.ascending;
          return builder;
        },
        range: async (from: number, to: number) => {
          requests.push({ from, to, filters: [...queryFilters], orderBy, ascending });
          const selected = rows.filter((item) => queryFilters.every(([column, value]) => item[column as keyof DailyAppointmentRow] === value));
          return { data: selected.slice(from, to + 1), error: null };
        },
      };
      return builder;
    },
  };
}

function fakeSettings(result: { data: any; error: any }) {
  return {
    from(table: string) {
      if (table !== "agent_daily_report_settings") throw new Error(`Tabla inesperada: ${table}`);
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => result,
      };
      return builder;
    },
  };
}

(async () => {
  const empty = buildDailyAppointmentReport({ tenantId, businessName: "Negocio prueba", date, rows: [] });
  test("día sin citas: todos los contadores en cero", empty.totalAppointments === 0 && empty.pendingAppointments === 0 && empty.cancelledAppointments === 0 && empty.noShowAppointments === 0);
  test("día sin citas: HTML informa que no hay citas", /No hay citas registradas/.test(renderDailyReportEmail(empty)));

  const several = buildDailyAppointmentReport({
    tenantId,
    businessName: "Negocio <prueba>",
    date,
    rows: [
      row({ id: "a", start_time: "2026-10-26T11:30:00+00:00", status: "confirmed" }),
      row({ id: "b", start_time: "2026-10-26T09:15:00+00:00", status: "completed" }),
      row({ id: "c", start_time: "2026-10-26T10:00:00+00:00", barber: { name: "Bruno" }, services: [{ service: { name: "Barba" } }] }),
      row({ id: "otro-tenant", tenant_id: "tenant-ajeno" }),
    ],
  });
  test("varios profesionales: agrupa solo el tenant y día pedidos", several.totalAppointments === 3 && several.professionals.length === 2);
  test("varios profesionales: ordena citas por hora", several.professionals[0].appointments.map((a) => a.time).join(",") === "09:15,11:30");
  test("pendientes: scheduled/confirmed/in_progress, no completed", several.pendingAppointments === 2);
  test("HTML escapa datos del negocio", /Negocio &lt;prueba&gt;/.test(renderDailyReportEmail(several)));

  const mixed = buildDailyAppointmentReport({
    tenantId, businessName: "Negocio prueba", date,
    rows: [
      row({ id: "agendada" }),
      row({ id: "confirmada", status: "confirmed" }),
      row({ id: "en-atencion", status: "in_progress" }),
      row({ id: "completada", status: "completed" }),
      row({ id: "cancelada", status: "cancelled", client: { name: "Cliente cancelada" } }),
      row({ id: "ausente", status: "no_show" }),
      row({ id: "cancelada-ajena", tenant_id: "otro", status: "cancelled" }),
      row({ id: "ausente-otro-dia", date: "2026-10-27", status: "no_show" }),
    ],
  });
  test("total excluye canceladas y ausencias, incluye completadas", mixed.totalAppointments === 4);
  test("pendientes cuenta solo agendada, confirmada y en atención", mixed.pendingAppointments === 3);
  test("canceladas y ausencias separadas, aisladas por tenant y día", mixed.cancelledAppointments === 1 && mixed.noShowAppointments === 1);
  const mixedHtml = renderDailyReportEmail(mixed);
  test("HTML muestra contadores separados", mixedHtml.includes("Canceladas: 1 · No asistió: 1"));
  test("lista conserva cancelada marcada y ausencia", mixed.professionals[0].appointments.length === 6 && /Cliente cancelada[\s\S]*?Cancelada/.test(mixedHtml) && mixedHtml.includes("No asistió</td>"));
  const onlyExcluded = buildDailyAppointmentReport({ tenantId, businessName: "Negocio", date, rows: [row({ status: "cancelled" }), row({ id: "ausente", status: "no_show" })] });
  test("día solo con cancelada y ausencia: cero activas y lista visible", onlyExcluded.totalAppointments === 0 && onlyExcluded.pendingAppointments === 0 && onlyExcluded.professionals[0].appointments.length === 2);

  for (const [value, expected] of [
    ["2026-02-31", false], ["2026-04-31", false], ["2028-02-29", true], ["2026-02-29", false],
    ["1900-02-29", false], ["2000-02-29", true], ["2026-04-30", true], ["2026-12-31", true],
    ["2026-13-01", false], ["2026-00-01", false], ["2026-01-00", false], ["2026-1-01", false],
    ["0000-01-01", false], [null, false],
  ] as const) {
    test(`fecha ${String(value)}: ${expected ? "válida" : "inválida"}`, isValidReportDate(value) === expected);
  }

  test("cita cerca de medianoche conserva 23:55 de la hora de pared", wallClockTime("2026-10-26T23:55:00+00:00") === "23:55");
  test("cita después de medianoche conserva 00:05 de la hora de pared", wallClockTime("2026-10-26T00:05:00") === "00:05");
  test("cita justo a medianoche conserva 00:00 sin zona", wallClockTime("2026-10-26T00:00:00") === "00:00");
  test("cita justo a medianoche conserva 00:00 con UTC", wallClockTime("2026-10-26T00:00:00+00:00") === "00:00");

  for (const [target, previous, next] of [
    ["2026-01-31", "2026-01-30", "2026-02-01"],
    ["2026-02-01", "2026-01-31", "2026-02-02"],
    ["2027-01-01", "2026-12-31", "2027-01-02"],
    ["2028-02-29", "2028-02-28", "2028-03-01"],
    ["2028-03-01", "2028-02-29", "2028-03-02"],
  ]) {
    const boundary = buildDailyAppointmentReport({ tenantId, businessName: "Negocio", date: target, rows: [
      row({ id: "inicio", date: target, start_time: `${target}T00:00:00+00:00` }),
      row({ id: "fin", date: target, start_time: `${target}T23:59:00+00:00`, status: "completed" }),
      row({ id: "anterior", date: previous, start_time: `${previous}T23:59:00+00:00`, status: "cancelled" }),
      row({ id: "siguiente", date: next, start_time: `${next}T00:00:00+00:00`, status: "no_show" }),
      row({ id: "ajena", tenant_id: "ajeno", date: target }),
    ] });
    test(`borde ${target}: aísla día y negocio`, boundary.totalAppointments === 2 && boundary.pendingAppointments === 1 && boundary.cancelledAppointments === 0 && boundary.noShowAppointments === 0);
    test(`borde ${target}: conserva medianoche y cierre`, boundary.professionals[0].appointments.map((a) => a.time).join(",") === "00:00,23:59");
  }

  const relationObject = buildDailyAppointmentReport({ tenantId, businessName: "Negocio", date, rows: [row()] });
  const relationLists = buildDailyAppointmentReport({ tenantId, businessName: "Negocio", date, rows: [row({
    client: [{ name: "Cliente prueba" }], barber: [{ name: "Ana" }], services: [{ service: [{ name: "Corte" }] }],
  })] });
  test("PostgREST: relaciones objeto y lista producen mismo informe", JSON.stringify(relationObject) === JSON.stringify(relationLists));
  const missingRelations = buildDailyAppointmentReport({ tenantId, businessName: "Negocio", date, rows: [
    row({ id: "nulas", client: null, barber: null, services: null }),
    row({ id: "listas-vacias", client: [], barber: [], services: [{ service: [] }, { service: null }] }),
    row({ id: "objetos-vacios", client: {}, barber: {}, services: [] }),
  ] });
  test("PostgREST: relaciones ausentes no borran citas", missingRelations.totalAppointments === 3 && missingRelations.professionals[0].name === "Sin profesional");
  test("PostgREST: relaciones vacías tienen etiquetas controladas", missingRelations.professionals[0].appointments.every((a) => a.client === "Sin cliente" && a.service === "Sin servicio"));
  const severalServices = buildDailyAppointmentReport({ tenantId, businessName: "Negocio", date, rows: [row({
    services: [{ service: { name: "Corte" } }, { service: [{ name: "Barba" }] }, { service: null }],
  })] });
  test("PostgREST: varios servicios mezclan objetos y listas", severalServices.professionals[0].appointments[0].service === "Corte + Barba");

  const special = `<img src=x onerror='prueba'>&\"`;
  const escaped = "&lt;img src=x onerror=&#039;prueba&#039;&gt;&amp;&quot;";
  const specialReport = buildDailyAppointmentReport({ tenantId, businessName: special, date, rows: [row({
    barber: { name: special }, client: { name: special }, services: [{ service: { name: special } }], status: special,
  })] });
  const specialHtml = renderDailyReportEmail(specialReport);
  test("HTML: escapa negocio, profesional, cliente, servicio y estado", specialHtml.split(escaped).length - 1 === 5);
  test("HTML: no deja etiquetas ni comillas de entrada ejecutables", !specialHtml.includes(special) && !specialHtml.includes("<img src=x"));
  test("día vacío: resumen cero y sin filas de clientes", empty.professionals.length === 0 && renderDailyReportEmail(empty).includes("Canceladas: 0 · No asistió: 0"));

  const rows1005 = Array.from({ length: 1005 }, (_, index) => row({ id: `cita-${String(index).padStart(4, "0")}` }));
  const paged = fakePagedSupabase(rows1005);
  const fetched = await fetchDailyAppointmentRows(paged, tenantId, date);
  test("más de 1.000 filas: trae todas las páginas", fetched.length === 1005, String(fetched.length));
  test(
    "consulta siempre filtra tenant_id y date",
    paged.filters.some(([key, value]) => key === "tenant_id" && value === tenantId) &&
      paged.filters.some(([key, value]) => key === "date" && value === date)
  );
  test("1.005 filas: páginas sin solapar y orden por id", paged.requests.length === 2 && paged.requests[0].from === 0 && paged.requests[0].to === 999 && paged.requests[1].from === 1000 && paged.requests[1].to === 1999 && paged.requests.every((q) => q.orderBy === "id" && q.ascending));
  test("1.005 filas: filtros repetidos en TODAS las páginas", paged.requests.every((q) => q.filters.some(([k, v]) => k === "tenant_id" && v === tenantId) && q.filters.some(([k, v]) => k === "date" && v === date)));
  for (const count of [0, 1000, 2005]) {
    const manyRows = Array.from({ length: count }, (_, index) => row({ id: `paginada-${String(index).padStart(5, "0")}` }));
    const simulated = fakePagedSupabase([
      ...manyRows,
      row({ id: "ajena", tenant_id: "ajeno" }),
      row({ id: "otro-dia", date: "2026-10-27" }),
    ]);
    const report = await createDailyAppointmentReport(simulated, { tenantId, businessName: "Negocio", date });
    test(`consulta completa ${count}: solo citas de tenant y día`, report.totalAppointments === count && report.pendingAppointments === count);
    test(`consulta completa ${count}: páginas correctas incluido múltiplo exacto`, simulated.requests.length === Math.floor(count / 1000) + 1);
    test(`consulta completa ${count}: IDs únicos sin pérdida`, new Set(report.professionals.flatMap((p) => p.appointments.map((a) => a.id))).size === count);
  }

  const disabled = await getDailyReportSettings(fakeSettings({ data: { enabled: false, recipient_emails: ["negocio@example.cl"] }, error: null }), tenantId);
  test("interruptor apagado: no queda listo para enviar", disabled.status === "disabled");

  const absent = await getDailyReportSettings(fakeSettings({ data: null, error: { code: "42P01", message: "relation does not exist" } }), tenantId);
  test("migración faltante: devuelve estado controlado", absent.status === "missing_migration");

  const ready = await getDailyReportSettings(fakeSettings({ data: { enabled: true, recipient_emails: ["negocio@example.cl", "correo-invalido"] }, error: null }), tenantId);
  test("configuración activa: conserva solo correos válidos", ready.status === "ready" && ready.recipients.length === 1);

  console.log(`RESULTADO: ${checks} comprobaciones, ${failures} fallas; datos simulados sin red/base/llaves.`);
  process.exit(failures ? 1 : 0);
})();
