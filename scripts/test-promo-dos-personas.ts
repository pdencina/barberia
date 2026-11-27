// Promoción «2 personas juntas» de punta a punta con las rutas reales. Solo base de PRUEBAS; borra lo que crea.
//   npx tsx scripts/test-promo-dos-personas.ts <tenantId>
import "./_solo-con-base";
import { readFileSync } from "fs";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes("ucwrdmwtlesayjxmlbve")) { console.log("ABORTADO: solo contra la base de pruebas"); process.exit(1); }
delete process.env.RESEND_API_KEY;

const tenantId = process.argv[2];
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

(async () => {
  const { NextRequest } = require("next/server");
  const { createAdminSupabase } = require("../src/lib/supabase/server");
  const { cuponDeCita } = require("../src/lib/cupon-cita");
  const sb = createAdminSupabase();
  const pedir = async (ruta: string, body: any) => {
    const r = await require(`../src/app/api/public/${ruta}/route`).POST(new NextRequest(`http://localhost/api/public/${ruta}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${Math.floor(Math.random() * 250)}` } }));
    return { status: r.status, d: await r.json() };
  };
  // un dia habil dentro de la proxima semana en que los dos atiendan
  const { data: barbers } = await sb.from("profiles").select("id").eq("tenant_id", tenantId).eq("role", "barber").eq("active", true).order("name").limit(3);
  const [A, B, FUERA] = barbers.map((b: any) => b.id);
  const { data: svc } = await sb.from("services").select("id, price").eq("tenant_id", tenantId).eq("active", true).order("price").limit(1).single();
  let fecha = "", libresA: string[] = [], libresB: string[] = [];
  for (let i = 1; i <= 7 && !fecha; i++) {
    const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
    const h = async (id: string) => (await (await require("../src/app/api/public/availability/route").GET(new NextRequest(`http://localhost/api/public/availability?barberId=${id}&date=${d}&duration=45`))).json()).slots || [];
    const [a, b] = [await h(A), await h(B)];
    if (a.length >= 3 && b.length >= 3) { fecha = d; libresA = a; libresB = b; }
  }
  if (!fecha) { console.log("No hay horas libres en pruebas"); process.exit(1); }
  const codigo = `PRUEBA-DOS-${Date.now() % 100000}`;
  const { data: cupon } = await sb.from("coupons").insert({ code: codigo, discount_type: "percentage", discount_value: 20, active: true, tenant_id: tenantId, conditions: { personas: 2, profesionalIds: [A, B] } }).select("id").single();
  const P = (n: number, barberId: string, startTime: string) => ({ serviceIds: [svc.id], barberId, startTime, clientName: n === 1 ? "Zeta Uno" : "Yankee Dos", clientPhone: n === 1 ? "900000011" : "900000022", clientEmail: n === 1 ? "zeta.promo@example.com" : "" });
  try {
    const solo = await pedir("book", { ...P(1, A, libresA[0]), date: fecha, couponCode: codigo });
    ok(solo.status === 409 && /2 personas/.test(solo.d.error), "1. una persona sola no puede usar el cupón");
    const falso = await pedir("book", { ...P(1, A, libresA[0]), date: fecha, couponCode: codigo, grupoPromo: { id: "11111111-1111-1111-1111-111111111111", firma: "a".repeat(64) } });
    ok(falso.status === 409, "2. no se puede inventar un acompañante");
    const revisar = await pedir("coupon", { code: codigo, barberId: A, startTime: libresA[0], total: 10000 });
    ok(!revisar.d.valid, "3. el campo de cupón de la reserva normal lo rechaza");
    const misma = await pedir("promo/reservar", { date: fecha, couponCode: codigo, personas: [P(1, A, libresA[0]), P(2, A, libresA[0])] });
    ok(misma.status === 409, "4. misma hora con el mismo profesional: no");
    const fuera = await pedir("promo/reservar", { date: fecha, couponCode: codigo, personas: [P(1, A, libresA[0]), P(2, FUERA, `${fecha}T12:00:00`)] });
    const { data: tras } = await sb.from("appointments").select("status").eq("coupon_id", cupon.id);
    ok(fuera.status !== 200 && (tras || []).every((x: any) => x.status === "cancelled"), `5. si la 2ª no cumple, no queda ninguna reserva (${fuera.d.error})`);
    const bien = await pedir("promo/reservar", { date: fecha, couponCode: codigo, personas: [P(1, A, libresA[1]), P(2, B, libresB[2])] });
    ok(bien.status === 200 && bien.d.reservas?.length === 2, `6. reserva de 2 personas ${bien.d.error || ""}`);
    const [id1, id2] = (bien.d.reservas || []).map((r: any) => r.appointmentId);
    const { data: dos } = await sb.from("appointments").select("coupon_group, client_id").in("id", [id1, id2]);
    ok(dos?.length === 2 && dos[0].coupon_group && dos[0].coupon_group === dos[1].coupon_group && dos[0].client_id !== dos[1].client_id, "7. quedan unidas y son dos clientes distintos");
    const precio = Number(svc.price), desc = Math.round(precio * 0.2);
    ok((await cuponDeCita(sb, id1, precio))?.discount === desc && (await cuponDeCita(sb, id2, precio))?.discount === desc, "8. las dos tienen el 20% al cobrar");
    await sb.from("coupons").update({ conditions: { personas: 2, profesionalIds: [A, B], servicioIds: ["33333333-3333-3333-3333-333333333333"] } }).eq("id", cupon.id);
    ok((await cuponDeCita(sb, id1, precio)) === null, "8b. un servicio que no entra no tiene descuento");
    const otro = await pedir("book", { ...P(1, A, libresA[0]), date: fecha, couponCode: codigo });
    ok(otro.status === 409 && /servicio/.test(otro.d.error), "8c. no se puede reservar la promoción con otro servicio");
    await sb.from("coupons").update({ conditions: { personas: 2, profesionalIds: [A, B], servicioIds: [svc.id] } }).eq("id", cupon.id);
    ok((await cuponDeCita(sb, id1, precio + 5000))?.discount === desc, "8d. con un extra, el descuento es solo sobre el servicio incluido");
    await sb.from("appointments").update({ status: "cancelled" }).eq("id", id2);
    ok((await cuponDeCita(sb, id1, precio)) === null, "9. si una cancela, la otra paga normal");
    await sb.from("appointments").update({ status: "completed" }).eq("id", id2);
    ok((await cuponDeCita(sb, id1, precio))?.discount === desc, "10. si la otra ya fue atendida, el descuento vale");
  } finally {
    const { data: citas } = await sb.from("appointments").select("id, client_id").eq("coupon_id", cupon.id);
    const { data: extra } = await sb.from("clients").select("id").eq("tenant_id", tenantId).in("name", ["Zeta Uno", "Yankee Dos"]);
    const clientes = (extra || []).map((c: any) => c.id);
    const ids = new Set<string>((citas || []).map((c: any) => c.id));
    if (clientes.length) for (const c of (await sb.from("appointments").select("id").in("client_id", clientes)).data || []) ids.add(c.id);
    const l = Array.from(ids);
    if (l.length) { await sb.from("appointment_services").delete().in("appointment_id", l); await sb.from("appointments").delete().in("id", l); }
    if (clientes.length) await sb.from("clients").delete().in("id", clientes);
    await sb.from("coupons").delete().eq("id", cupon.id);
  }
  console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK: promoción de 2 personas");
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error("ERROR", e?.message || e); process.exit(1); });
