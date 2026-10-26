import { fetchAllRows } from "@/lib/accounting";
import { parseWallClock } from "@/lib/wallclock";

export const PENDING_APPOINTMENT_STATUSES = ["scheduled", "confirmed", "in_progress"] as const;
const COUNTED_APPOINTMENT_STATUSES = [...PENDING_APPOINTMENT_STATUSES, "completed"] as const;

export interface DailyAppointmentRow {
  id: string;
  tenant_id: string;
  date: string;
  start_time: string;
  status: string;
  client?: { name?: string | null } | Array<{ name?: string | null }> | null;
  barber?: { name?: string | null } | Array<{ name?: string | null }> | null;
  services?: Array<{ service?: { name?: string | null } | Array<{ name?: string | null }> | null }> | null;
}

export interface DailyReportAppointment {
  id: string;
  time: string;
  service: string;
  client: string;
  status: string;
}

export interface DailyReportProfessional {
  name: string;
  appointments: DailyReportAppointment[];
}

export interface DailyAppointmentReport {
  tenantId: string;
  businessName: string;
  date: string;
  totalAppointments: number;
  pendingAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  professionals: DailyReportProfessional[];
}

export type DailyReportSettingsResult =
  | { status: "ready"; recipients: string[] }
  | { status: "disabled"; recipients: string[] }
  | { status: "missing_migration"; recipients: [] };

const relation = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] || null : value || null;

export function isValidReportDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-([12]\d|3[01]|0[1-9])$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysPerMonth[month - 1];
}

export function wallClockTime(value: string): string {
  const parsed = parseWallClock(value);
  if (!Number.isFinite(parsed.getTime())) return "Hora no disponible";
  return `${String(parsed.getUTCHours()).padStart(2, "0")}:${String(parsed.getUTCMinutes()).padStart(2, "0")}`;
}

export async function fetchDailyAppointmentRows(
  supabase: any,
  tenantId: string,
  date: string
): Promise<DailyAppointmentRow[]> {
  if (!tenantId || tenantId === "ALL") throw new Error("Se requiere un negocio específico");
  if (!isValidReportDate(date)) throw new Error("Fecha inválida; usa YYYY-MM-DD");

  return fetchAllRows<DailyAppointmentRow>(() =>
    supabase
      .from("appointments")
      .select(`
        id, tenant_id, date, start_time, status,
        client:clients(name),
        barber:profiles!barber_id(name),
        services:appointment_services(service:services(name))
      `)
      .eq("tenant_id", tenantId)
      .eq("date", date)
  );
}

export function buildDailyAppointmentReport(args: {
  tenantId: string;
  businessName: string;
  date: string;
  rows: DailyAppointmentRow[];
}): DailyAppointmentReport {
  const groups = new Map<string, DailyReportAppointment[]>();
  let totalAppointments = 0;
  let pendingAppointments = 0;
  let cancelledAppointments = 0;
  let noShowAppointments = 0;

  for (const row of args.rows) {
    if (row.tenant_id !== args.tenantId || row.date !== args.date) continue;
    const professional = relation(row.barber)?.name?.trim() || "Sin profesional";
    const client = relation(row.client)?.name?.trim() || "Sin cliente";
    const service = (row.services || [])
      .map((item) => relation(item.service)?.name?.trim())
      .filter(Boolean)
      .join(" + ") || "Sin servicio";
    const appointment = {
      id: row.id,
      time: wallClockTime(row.start_time),
      service,
      client,
      status: row.status || "sin_estado",
    };
    const items = groups.get(professional) || [];
    items.push(appointment);
    groups.set(professional, items);
    if ((COUNTED_APPOINTMENT_STATUSES as readonly string[]).includes(row.status)) totalAppointments++;
    if ((PENDING_APPOINTMENT_STATUSES as readonly string[]).includes(row.status)) pendingAppointments++;
    if (row.status === "cancelled") cancelledAppointments++;
    if (row.status === "no_show") noShowAppointments++;
  }

  const professionals = Array.from(groups.entries())
    .map(([name, appointments]) => ({
      name,
      appointments: appointments.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    tenantId: args.tenantId,
    businessName: args.businessName,
    date: args.date,
    totalAppointments,
    pendingAppointments,
    cancelledAppointments,
    noShowAppointments,
    professionals,
  };
}

export async function createDailyAppointmentReport(
  supabase: any,
  args: { tenantId: string; businessName: string; date: string }
): Promise<DailyAppointmentReport> {
  const rows = await fetchDailyAppointmentRows(supabase, args.tenantId, args.date);
  return buildDailyAppointmentReport({ ...args, rows });
}

export async function getDailyReportSettings(
  supabase: any,
  tenantId: string
): Promise<DailyReportSettingsResult> {
  const { data, error } = await supabase
    .from("agent_daily_report_settings")
    .select("enabled, recipient_emails")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return { status: "missing_migration", recipients: [] };
    }
    throw new Error(error.message || "No se pudo leer la configuración del informe diario");
  }

  const recipients = Array.isArray(data?.recipient_emails)
    ? data.recipient_emails.filter((email: unknown): email is string => typeof email === "string" && /^\S+@\S+\.\S+$/.test(email))
    : [];
  return data?.enabled === true
    ? { status: "ready", recipients }
    : { status: "disabled", recipients };
}
