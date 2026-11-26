import { cuponDeCita } from "../src/lib/cupon-cita";

// Base de mentira: devuelve la fila de cada tabla.
const base = (cita: any, cupon: any) => ({
  from: (t: string) => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: t === "appointments" ? cita : cupon, error: null }) };
    return q;
  },
});
const pablo = "91bede52-f11a-46b0-970a-91b83cb6227e";
const cita = { coupon_id: "c1", barber_id: pablo, date: "2026-12-05", start_time: "2026-12-05T12:00:00+00:00", tenant_id: "t" };
const cupon = { id: "c1", code: "CUANDO-PAGAN", discount_type: "percentage", discount_value: 20, active: false, valid_until: "2026-12-01", conditions: { profesionalIds: [pablo] } };

(async () => {
  let f = 0;
  const ok = (c: boolean, t: string) => { if (!c) { f++; console.log("FALLA", t); } };
  const r = await cuponDeCita(base(cita, cupon), "a", 17000);
  ok(r?.discount === 3400, "20% de 17.000 (vale aunque el cupón venza después de reservar)");
  ok((await cuponDeCita(base({ ...cita, barber_id: "otro" }, cupon), "a", 17000)) === null, "cambiada a otro profesional");
  ok((await cuponDeCita(base({ ...cita, coupon_id: null }, cupon), "a", 17000)) === null, "sin código");
  ok((await cuponDeCita(base(cita, { ...cupon, discount_type: "fixed_amount", discount_value: 99000 }), "a", 17000))?.discount === 17000, "nunca más que el total");
  console.log(f ? "HAY FALLAS" : "OK cupón de la cita");
  process.exit(f ? 1 : 0);
})();
