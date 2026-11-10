import { analizarEmbudo, parseUserAgent, horaChile, PASOS_VALIDOS } from "../src/lib/embudo";
let fails = 0;
const t = (n: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FALLA", n, JSON.stringify(got), "esperado", JSON.stringify(want)); } else console.log("ok", n); };

// --- aparato / navegador ---
t("iPhone con Safari", parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"), { device: "celular", os: "iOS", browser: "Safari" });
t("Android Chrome", parseUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36"), { device: "celular", os: "Android", browser: "Chrome" });
t("Instagram dentro de la app", parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Instagram 300.0").browser, "Instagram (dentro de la app)");
t("Mac con Chrome", parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"), { device: "computador", os: "macOS", browser: "Chrome" });
t("pasos validos incluyen error de pago", PASOS_VALIDOS.includes("pay_error"), true);

// --- hora de Chile (no UTC): 2026-11-10 13:00 UTC = 10:00 en Chile (UTC-3 en verano) ---
t("hora de Chile", horaChile("2026-11-10T13:00:00Z"), { hora: 10, dia: 2 });

// --- embudo ---
const ev = (visit: string, step: string, extra: any = {}) => ({ created_at: "2026-11-10T13:00:00Z", visit_id: visit, step, device: "celular", os: "iOS", browser: "Safari", city: "Santiago", ...extra });
const eventos: any[] = [];
for (let i = 0; i < 20; i++) eventos.push(ev("v" + i, "landing_view"));
for (let i = 0; i < 12; i++) eventos.push(ev("v" + i, "precios_view"));
for (let i = 0; i < 6; i++) eventos.push(ev("v" + i, "plan_click", { plan: i < 4 ? "basic" : "pro" }));
for (let i = 0; i < 5; i++) eventos.push(ev("v" + i, "checkout_open"));
for (let i = 0; i < 2; i++) eventos.push(ev("v" + i, "form_started"));
for (let i = 0; i < 1; i++) eventos.push(ev("v" + i, "pay_click"));
eventos.push(ev("v0", "landing_view")); // repetido: no debe contar doble
const sol = [{ status: "paid", amount: 15000, created_at: "2026-11-10T13:30:00Z" }, { status: "pending", amount: 15000, created_at: "2026-11-10T14:00:00Z" }];
const a = analizarEmbudo(eventos, sol as any);
t("visitas unicas", a.visitas, 20);
t("pasos del embudo", a.embudo.map((f) => f.visitas), [20, 12, 6, 5, 2, 1, 1]);
t("% que pasa de landing a precios", a.embudo[1].pasanDelAnterior, 60);
t("donde mas se pierde: de landing a precios (8) vs de checkout a formulario (3)", a.mayorCaida?.entre, "Entraron a la página → Vieron los precios");
t("planes elegidos", a.planes, [{ nombre: "basic", cantidad: 4 }, { nombre: "pro", cantidad: 2 }]);
t("mejor hora de llegada", a.mejoresHoras, ["10:00"]);
t("pagos por hora (10h Chile)", a.horas[10].pagos, 1);
t("dispositivo mas usado", a.dispositivos[0], { nombre: "celular", cantidad: 20 });
t("sin datos personales en el resultado", JSON.stringify(a).includes("@"), false);
const vacio = analizarEmbudo([], []);
t("sin eventos: ceros y sin caida", [vacio.visitas, vacio.mayorCaida], [0, null]);
console.log(fails ? `${fails} fallas` : "TODO OK");
process.exit(fails ? 1 : 0);
