// Prueba de que el tótem NO repite avisos al equipo. Usa la base de PRUEBAS (necesita la tabla audit_log) y limpia lo que crea.
//   npx tsx scripts/test-kiosk-avisos.ts <tenantId> <codigoNegocio>
import { NextRequest } from "next/server";
import { POST as solicitud } from "../src/app/api/totem/solicitud/route";

const [tenantId, codigoNegocio] = process.argv.slice(2);
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };
let ip = 0;
const llamar = async (body: any) => (await solicitud(new NextRequest("http://x/api", { method: "POST", headers: { "x-forwarded-for": `10.2.0.${++ip}` }, body: JSON.stringify({ codigo: codigoNegocio, ...body }) }))).json();
const avisos = async () => (await sb.from("audit_log").select("id").eq("action", "kiosk_aviso").eq("entity_id", tenantId)).data.length;

(async () => {
  await sb.from("audit_log").delete().eq("action", "kiosk_aviso").eq("entity_id", tenantId);
  try {
    let d = await llamar({ tipo: "pago", code: "ABCDE" }); ok(d.ok && !d.repetido && (await avisos()) === 1, "1er «quiero pagar»: se avisa al equipo");
    d = await llamar({ tipo: "pago", code: "ABCDE" }); ok(d.ok && d.repetido === true && (await avisos()) === 1, "2º igual, seguido: NO se avisa de nuevo (el cliente igual ve «listo»)");
    d = await llamar({ tipo: "pago", code: "ABCDE" }); ok(d.ok && d.repetido === true && (await avisos()) === 1, "3º igual: tampoco");
    d = await llamar({ tipo: "pago", code: "FGHJK" }); ok(d.ok && !d.repetido && (await avisos()) === 2, "OTRO cliente pide pagar: sí se avisa");
    // pasados 3 minutos vuelve a avisar
    await sb.from("audit_log").update({ created_at: new Date(Date.now() - 4 * 60_000).toISOString() }).eq("action", "kiosk_aviso").eq("entity_id", tenantId).eq("metadata->>clave", "pago:ABCDE");
    d = await llamar({ tipo: "pago", code: "ABCDE" }); ok(d.ok && !d.repetido && (await avisos()) === 3, "pasados 3 min, si insiste: vuelve a avisar");
  } finally {
    await sb.from("audit_log").delete().eq("action", "kiosk_aviso").eq("entity_id", tenantId);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
