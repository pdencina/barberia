// Doble reserva: una hora de un dia guardada bajo la fecha de otro no debe dejar el horario libre. Uso: npx tsx scripts/test-doble-reserva.ts
import { fechaCoincideConHora, isSlotFull } from "../src/lib/capacity";
let fallos = 0;
const ok = (c: boolean, n: string) => { if (!c) { fallos++; console.log("FALLA:", n); } else console.log("OK  ", n); };

ok(fechaCoincideConHora("2026-11-14", "2026-11-14T10:45:00"), "fecha y hora del mismo dia: se acepta");
ok(!fechaCoincideConHora("2026-11-14", "2026-11-13T10:45:00"), "hora de ayer con fecha de hoy: se rechaza (el caso de Eric Taquias)");
ok(!fechaCoincideConHora("2026-11-14", undefined) && !fechaCoincideConHora(undefined, "2026-11-14T10:45:00") && !fechaCoincideConHora("14-11-2026", "14-11-2026T10:45"), "datos faltantes o con otro formato: se rechazan");

// Base de datos simulada: filas de citas de un profesional. «porFecha» responde a eq("date"), «porRango» al filtro por horas.
type Fila = { id: string; date: string; start_time: string; end_time: string; status: string };
function bd(filas: Fila[]) {
  return {
    from(tabla: string) {
      if (tabla === "tenants") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      const q: any = { _fecha: null as string | null, _lt: null as string | null, _gt: null as string | null };
      q.select = () => q; q.in = () => q; q.eq = (c: string, v: string) => { if (c === "date") q._fecha = v; return q; };
      q.lt = (_c: string, v: string) => { q._lt = v; return q; }; q.gt = (_c: string, v: string) => { q._gt = v; return q; };
      q.then = (res: any) => {
        const out = filas.filter((f) => f.status !== "cancelled").filter((f) => (q._fecha ? f.date === q._fecha : Date.parse(f.start_time) < Date.parse(q._lt!) && Date.parse(f.end_time) > Date.parse(q._gt!)));
        return Promise.resolve({ data: out, error: null }).then(res);
      };
      return q;
    },
  } as any;
}
const d = (s: string) => new Date(`${s}Z`);
(async () => {
  // Cita normal 10:45-11:30 del 14: otra a las 10:45 del 14 NO se puede.
  const normal: Fila = { id: "a", date: "2026-11-14", start_time: "2026-11-14T10:45:00+00:00", end_time: "2026-11-14T11:30:00+00:00", status: "confirmed" };
  ok(await isSlotFull(bd([normal]), "b1", "t1", "2026-11-14", d("2026-11-14T10:45:00"), d("2026-11-14T11:30:00")), "misma hora: horario ocupado");
  ok(await isSlotFull(bd([normal]), "b1", "t1", "2026-11-14", d("2026-11-14T11:15:00"), d("2026-11-14T12:00:00")), "se pisan 15 minutos: ocupado");
  ok(!(await isSlotFull(bd([normal]), "b1", "t1", "2026-11-14", d("2026-11-14T11:30:00"), d("2026-11-14T12:15:00"))), "empieza justo cuando termina la otra: libre");
  // Cita con fecha del 14 pero hora del 13 (el error antiguo): igual debe bloquear las 10:45 del 14.
  const mezclada: Fila = { id: "m", date: "2026-11-14", start_time: "2026-11-13T10:45:00+00:00", end_time: "2026-11-13T11:30:00+00:00", status: "confirmed" };
  ok(await isSlotFull(bd([mezclada]), "b1", "t1", "2026-11-14", d("2026-11-14T10:45:00"), d("2026-11-14T11:30:00")), "cita con fecha de hoy y hora de ayer: bloquea la hora de hoy");
  ok(!(await isSlotFull(bd([mezclada]), "b1", "t1", "2026-11-14", d("2026-11-14T14:00:00"), d("2026-11-14T14:45:00"))), "y no bloquea otras horas");
  // Cita con la hora del 14 pero la fecha del 13: bloquea el horario del 14 (lo encuentra por el rango de horas).
  const otraFecha: Fila = { id: "o", date: "2026-11-13", start_time: "2026-11-14T10:45:00+00:00", end_time: "2026-11-14T11:30:00+00:00", status: "scheduled" };
  ok(await isSlotFull(bd([otraFecha]), "b1", "t1", "2026-11-14", d("2026-11-14T10:45:00"), d("2026-11-14T11:30:00")), "cita con hora de hoy y fecha de ayer: tambien bloquea");
  // Una cancelada no bloquea.
  ok(!(await isSlotFull(bd([{ ...normal, status: "cancelled" }]), "b1", "t1", "2026-11-14", d("2026-11-14T10:45:00"), d("2026-11-14T11:30:00"))), "una cita cancelada no bloquea");
  // Reagendar: la propia cita no cuenta contra si misma.
  ok(!(await isSlotFull(bd([normal]), "b1", "t1", "2026-11-14", d("2026-11-14T10:45:00"), d("2026-11-14T11:30:00"), "a")), "al reagendar, la propia cita no cuenta");
  process.exit(fallos ? 1 : 0);
})();
