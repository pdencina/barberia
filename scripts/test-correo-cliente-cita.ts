// Pruebas del aviso por correo al cliente cuando el equipo crea o cambia una cita (src/lib/appointment-client-email.ts).
// Ejecutar: npx tsx scripts/test-correo-cliente-cita.ts
process.env.RESEND_API_KEY = "re_clave_de_prueba";

import { clientVisibleChanges, emailClientAboutAppointment } from "../src/lib/appointment-client-email";

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

// ---------- 1) cuando se avisa ----------
const base = { start_time: "2026-10-22T15:00:00+00:00", barber_id: "b1", serviceIds: ["s1", "s2"] };
const c = (after: any, before = base) => clientVisibleChanges({ before, after }).join(",");

t("misma hora (la base trae +00:00, el calendario manda sin zona) -> no avisa", c({ start_time: "2026-10-22T15:00:00" }) === "");
t("misma hora con Z -> no avisa", c({ start_time: "2026-10-22T15:00:00.000Z" }) === "");
t("mover 15 minutos -> avisa (hora)", c({ start_time: "2026-10-22T15:15:00" }) === "hora");
t("mover a otro dia -> avisa (hora)", c({ start_time: "2026-10-23T15:00:00" }) === "hora");
t("cambiar de profesional -> avisa", c({ barber_id: "b2" }) === "profesional");
t("mismo profesional -> no avisa", c({ barber_id: "b1" }) === "");
t("mismos servicios en otro orden -> no avisa", c({ serviceIds: ["s2", "s1"] }) === "");
t("otro servicio -> avisa", c({ serviceIds: ["s1", "s3"] }) === "servicios");
t("lista de servicios vacia -> no avisa", c({ serviceIds: [] }) === "");
t("solo estirar el bloque (no manda hora de inicio) -> no avisa", c({}) === "");
t("hora + profesional juntos -> un solo aviso con ambos motivos", c({ start_time: "2026-10-22T16:00:00", barber_id: "b2" }) === "hora,profesional");
t("hora invalida no rompe ni avisa", c({ start_time: "no-es-fecha" }) === "");

// ---------- 2) el envio completo, con base falsa y capturando el correo ----------
const enviados: any[] = [];
(globalThis as any).fetch = async (url: any, init: any) => {
  enviados.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
  return new Response(JSON.stringify({ id: "correo-de-prueba" }), { status: 200, headers: { "content-type": "application/json" } });
};

function fakeSupabase(appt: any) {
  const q = (data: any) => {
    const b: any = { select: () => b, eq: () => b, maybeSingle: async () => ({ data }), single: async () => ({ data }) };
    return b;
  };
  return { from: (table: string) => (table === "appointments" ? q(appt) : q(null)) };
}
const cita = (over: any = {}) => ({
  id: "a1",
  start_time: "2026-10-22T15:30:00+00:00", // 15:30 hora de Chile guardada como UTC
  end_time: "2026-10-22T16:15:00+00:00",
  status: "scheduled",
  tenant_id: null, // sin negocio: no consulta cupo ni logo (esas partes usan la base real)
  client: { name: "Alan Cabrera", email: "alan@example.cl" },
  barber: { name: "Javier" },
  services: [{ price: 12000, service: { name: "Corte", duration: 30 } }, { price: 3000, service: { name: "Barba", duration: 15 } }],
  ...over,
});

(async () => {
  enviados.length = 0;
  let r = await emailClientAboutAppointment(fakeSupabase(cita()), "a1", "created");
  const m1 = enviados[0]?.body;
  t("cita nueva: envia 1 correo al cliente", r === "enviado" && enviados.length === 1 && Array.isArray(m1?.to) ? m1.to.includes("alan@example.cl") : m1?.to === "alan@example.cl", `to=${JSON.stringify(m1?.to)}`);
  t("cita nueva: asunto de confirmacion", /Cita confirmada/.test(m1?.subject || ""), m1?.subject);
  t("cita nueva: trae la hora 03:30 p. m. (15:30 de Chile), profesional, servicios, duracion 45 y precio", /03:30 p\. m\./.test(m1?.html) && /Javier/.test(m1?.html) && /Corte \+ Barba/.test(m1?.html) && /45 minutos/.test(m1?.html) && /15[.,]000/.test(m1?.html));
  t("cita nueva: incluye el enlace para cancelar", /\/cancel\/a1/.test(m1?.html));

  enviados.length = 0;
  r = await emailClientAboutAppointment(fakeSupabase(cita({ start_time: "2026-10-23T10:00:00+00:00", end_time: "2026-10-23T10:45:00+00:00" })), "a1", "updated");
  const m2 = enviados[0]?.body;
  t("cita movida: envia el correo de modificacion", r === "enviado" && /Cita modificada/.test(m2?.subject || ""), m2?.subject);
  t("cita movida: muestra la hora NUEVA (10:00 a. m.) y el dia nuevo", /10:00 a\. m\./.test(m2?.html) && /23 de octubre/.test(m2?.html));

  enviados.length = 0;
  r = await emailClientAboutAppointment(fakeSupabase(cita({ client: { name: "Gabriel Vargas", email: null } })), "a1", "created");
  t("cliente sin correo: no envia ni falla", r === "sin_correo" && enviados.length === 0, r);

  enviados.length = 0;
  r = await emailClientAboutAppointment(fakeSupabase(cita({ client: { name: "X", email: "no-es-correo" } })), "a1", "created");
  t("correo invalido: no envia", r === "sin_correo" && enviados.length === 0, r);

  enviados.length = 0;
  r = await emailClientAboutAppointment(fakeSupabase(cita({ client: null })), "a1", "created");
  t("cita sin cliente (hora reservada): no envia", r === "no_aplica" && enviados.length === 0, r);

  for (const status of ["cancelled", "completed", "no_show"]) {
    enviados.length = 0;
    r = await emailClientAboutAppointment(fakeSupabase(cita({ status })), "a1", "updated");
    t(`cita ${status}: no envia`, r === "no_aplica" && enviados.length === 0, r);
  }

  enviados.length = 0;
  r = await emailClientAboutAppointment(fakeSupabase(null), "a1", "created");
  t("cita que no existe: no envia ni falla", r === "no_aplica" && enviados.length === 0, r);

  enviados.length = 0;
  r = await emailClientAboutAppointment(fakeSupabase(cita({ client: { name: "null Pedro null", email: "p@example.cl" } })), "a1", "created");
  t("nombre con 'null' de importaciones antiguas: se limpia en el saludo", /Hola <strong[^>]*>Pedro<\/strong>/.test(enviados[0]?.body?.html || ""), (enviados[0]?.body?.html || "").match(/Hola <strong[^>]*>[^<]*/)?.[0]);

  process.exit(fails ? 1 : 0);
})();
