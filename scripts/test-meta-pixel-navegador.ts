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
  t("sin permiso no carga", m.loadPixel(), false);
  m.setConsent("granted");
  let err = "";
  try { m.loadPixel(); m.track("PageView"); m.track("InitiateCheckout", { value: 100, currency: "CLP" }, "checkout_1"); } catch (e: any) { err = e.message; }
  t("no lanza errores (modo estricto)", err, "");
  t("agrega el script de Meta", added.length, 1);
  t("encola init + 2 eventos", g.fbq.queue.length, 3);
  t("evento con id de deduplicación", Array.from(g.fbq.queue[2]).slice(0, 4), ["track", "InitiateCheckout", { value: 100, currency: "CLP" }, { eventID: "checkout_1" }]);
  const a = m.marketingPayload();
  t("atribución con utm y fbclid", [a.utm_campaign, a.fbclid], ["prueba", "ABC12345"]);
  m.setConsent("denied");
  t("rechazar: no se guardan cookies de Meta", "fbp" in m.marketingPayload(), false);
  console.log(fails ? `${fails} fallas` : "TODO OK");
  process.exit(fails ? 1 : 0);
})();
