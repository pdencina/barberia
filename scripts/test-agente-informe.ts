// Pruebas sin red, base ni llaves para la fase 1 del agente.
// Ejecutar: npx tsx scripts/test-agente-informe.ts
import {
  buildDailyAppointmentReport,
  fetchDailyAppointmentRows,
  getDailyReportSettings,
  wallClockTime,
  type DailyAppointmentRow,
} from "../src/lib/agente/informe-diario";
import { renderDailyReportEmail } from "../src/lib/agente/informe-diario-email";

let failures = 0;
function test(name: string, ok: boolean, detail = "") {
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
  return {
    filters,
    from(table: string) {
      if (table !== "appointments") throw new Error(`Tabla inesperada: ${table}`);
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        order: () => builder,
        range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }),
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
  test("día sin citas: totales en cero", empty.totalAppointments === 0 && empty.pendingAppointments === 0);
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

  test("cita cerca de medianoche conserva 23:55 de la hora de pared", wallClockTime("2026-10-26T23:55:00+00:00") === "23:55");
  test("cita después de medianoche conserva 00:05 de la hora de pared", wallClockTime("2026-10-26T00:05:00") === "00:05");

  const rows1005 = Array.from({ length: 1005 }, (_, index) => row({ id: `cita-${String(index).padStart(4, "0")}` }));
  const paged = fakePagedSupabase(rows1005);
  const fetched = await fetchDailyAppointmentRows(paged, tenantId, date);
  test("más de 1.000 filas: trae todas las páginas", fetched.length === 1005, String(fetched.length));
  test(
    "consulta siempre filtra tenant_id y date",
    paged.filters.some(([key, value]) => key === "tenant_id" && value === tenantId) &&
      paged.filters.some(([key, value]) => key === "date" && value === date)
  );

  const disabled = await getDailyReportSettings(fakeSettings({ data: { enabled: false, recipient_emails: ["negocio@example.cl"] }, error: null }), tenantId);
  test("interruptor apagado: no queda listo para enviar", disabled.status === "disabled");

  const absent = await getDailyReportSettings(fakeSettings({ data: null, error: { code: "42P01", message: "relation does not exist" } }), tenantId);
  test("migración faltante: devuelve estado controlado", absent.status === "missing_migration");

  const ready = await getDailyReportSettings(fakeSettings({ data: { enabled: true, recipient_emails: ["negocio@example.cl", "correo-invalido"] }, error: null }), tenantId);
  test("configuración activa: conserva solo correos válidos", ready.status === "ready" && ready.recipients.length === 1);

  process.exit(failures ? 1 : 0);
})();
