export {};
// Prueba el Píxel del navegador con un navegador simulado. Debe correr sin errores en modo estricto.
process.env.NEXT_PUBLIC_META_PIXEL_ID = "955315870712237";
const store: Record<string, string> = {};
const g: any = globalThis;
g.window = g;
g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
const added: any[] = [];
g.document = { cookie: "", head: { appendChild: (e: any) => added.push(e) }, createElement: () => ({}) };
g.location = { search: "?utm_campaign=prueba&fbclid=ABC12345", pathname: "/suscribirse", href: "https://x.cl/suscribirse?a=1" };

(async () => {
  const m = await import("../src/lib/meta-pixel");
  let fails = 0;
  const t = (n: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FALLA", n, JSON.stringify(got), "esperado", JSON.stringify(want)); } else console.log("ok", n); };
  t("ID del Pixel: solo digitos 8-20", [m.validPixelId("955315870712237"), m.validPixelId("abc"), m.validPixelId("123"), m.validPixelId("<script>")], [true, false, false, false]);
  t("sin permiso no carga", m.loadPixel(), false);
  m.setConsent("granted");
  let err = "";
  try { m.loadPixel(); m.track("PageView"); m.track("InitiateCheckout", { value: 100, currency: "CLP" }, "checkout_1"); } catch (e: any) { err = e.message; }
  t("no lanza errores (modo estricto)", err, "");
  t("agrega el script de Meta", added.length, 1);
  t("encola autoConfig apagado + init + 2 eventos", [g.fbq.queue.length, Array.from(g.fbq.queue[0]).slice(0, 3)], [4, ["set", "autoConfig", false]]);
  t("evento con id de deduplicación", Array.from(g.fbq.queue[3]).slice(0, 4), ["trackSingle", "955315870712237", "InitiateCheckout", { value: 100, currency: "CLP" }]);
  const a = m.marketingPayload();
  t("atribución con utm y fbclid", [a.utm_campaign, a.fbclid], ["prueba", "ABC12345"]);
  // Pixel de un negocio: no se cruza con el de re-booking y valida el ID
  t("ID invalido no carga", m.loadPixel("abc"), false);
  m.track("Schedule", undefined, "schedule_9", "123456789012");
  const last = Array.from(g.fbq.queue[g.fbq.queue.length - 1]) as any[];
  t("Schedule va solo al Pixel del negocio", [last[0], last[1], last[2], last[4]], ["trackSingle", "123456789012", "Schedule", { eventID: "schedule_9" }]);
  t("init del Pixel del negocio sin rastreo automatico", g.fbq.queue.some((q: any) => q[0] === "set" && q[2] === false && q[3] === "123456789012"), true);
  m.setConsent("denied");
  t("rechazar: no se guardan cookies de Meta", "fbp" in m.marketingPayload(), false);
  console.log(fails ? `${fails} fallas` : "TODO OK");
  process.exit(fails ? 1 : 0);
})();
