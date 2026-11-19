// Prueba de cambiar/agregar el servicio de una cita desde el tótem. Usa la base de PRUEBAS y limpia lo que crea.
//   npx tsx scripts/test-kiosk-cambiar-servicio.ts <tenantId> <codigoDelTotem>
import "./_solo-con-base";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/totem/cita-servicios/route";

const [tenantId, codigoTotem] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0, ip = 1;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };
const llamar = async (cuerpo: any) => {
  const r = await POST(new NextRequest("http://localhost/api/totem/cita-servicios", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.9.9.${ip++}` }, body: JSON.stringify({ codigo: codigoTotem, ...cuerpo }) }));
  return { status: r.status, d: await r.json() };
};

(async () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const { data: barber } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").limit(1).single();
  const { data: svcs } = await sb.from("services").select("id, price").eq("tenant_id", tenantId).eq("active", true).limit(3);
  const { data: cli } = await sb.from("clients").insert({ name: "Cliente Cambia Servicio", phone: "+56911115050", tenant_id: tenantId }).select("id").single();
  const { data: ap } = await sb.from("appointments").insert({ client_id: cli.id, barber_id: barber.id, date: hoy, start_time: `${hoy}T21:00:00Z`, end_time: `${hoy}T21:30:00Z`, status: "scheduled", tenant_id: tenantId }).select("id, checkin_code").single();
  await sb.from("appointment_services").insert({ appointment_id: ap.id, service_id: svcs[0].id, price: svcs[0].price });
  const kps: string[] = [];
  try {
    const l = await llamar({ code: ap.checkin_code, appointmentId: ap.id });
    if (l.status !== 200) console.log("   respuesta:", l.status, JSON.stringify(l.d).slice(0, 200));
    ok(l.status === 200 && l.d.servicios?.length > 0 && l.d.actuales?.[0] === svcs[0].id, "lista los servicios y marca el que ya tiene la cita");
    const mal = await llamar({ code: "ZZZZZ", appointmentId: ap.id });
    ok(mal.status === 404, "con un código ajeno se rechaza");
    const dos = [svcs[0].id, svcs[1].id];
    const c = await llamar({ code: ap.checkin_code, appointmentId: ap.id, serviceIds: dos });
    const { data: filas } = await sb.from("appointment_services").select("service_id, price").eq("appointment_id", ap.id);
    ok(c.status === 200 && filas.length === 2, "agrega un segundo servicio: la cita queda con 2");
    const invalido = await llamar({ code: ap.checkin_code, appointmentId: ap.id, serviceIds: ["00000000-0000-0000-0000-000000000000"] });
    const { data: filas2 } = await sb.from("appointment_services").select("service_id").eq("appointment_id", ap.id);
    ok(invalido.status === 400 && filas2.length === 2, "un servicio inexistente se rechaza y la cita no cambia");
    const uno = await llamar({ code: ap.checkin_code, appointmentId: ap.id, serviceIds: [svcs[1].id] });
    const { data: filas3 } = await sb.from("appointment_services").select("service_id").eq("appointment_id", ap.id);
    ok(uno.status === 200 && filas3.length === 1 && filas3[0].service_id === svcs[1].id, "cambia a otro servicio: queda solo ese");
    // con un cobro en curso ya no se puede cambiar
    const { data: kp } = await sb.from("kiosk_payments").insert({ tenant_id: tenantId, appointment_id: ap.id, amount: 1000, method: "terminal", provider: "mercadopago" }).select("id").single();
    kps.push(kp.id);
    const bloq = await llamar({ code: ap.checkin_code, appointmentId: ap.id, serviceIds: [svcs[0].id] });
    ok(bloq.status === 409, "con un cobro en curso no se puede cambiar el servicio");
  } finally {
    for (const id of kps) await sb.from("kiosk_payments").delete().eq("id", id);
    await sb.from("appointment_services").delete().eq("appointment_id", ap.id);
    await sb.from("appointments").delete().eq("id", ap.id);
    await sb.from("clients").delete().eq("id", cli.id);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
