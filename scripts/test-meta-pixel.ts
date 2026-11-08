import { hashEmail, hashPhone, sanitizeMarketing, buildCapiPayload, sendCapiEvent } from "../src/lib/meta-capi";
import { resumenCampanas } from "../src/lib/campanas";
let fails = 0;
const t = (n: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FALLA", n, JSON.stringify(got), "esperado", JSON.stringify(want)); } else console.log("ok", n); };

// sha256("test@example.com") conocido
t("hash de correo (minúsculas, sin espacios)", hashEmail("  Test@Example.com "), "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
t("correo inválido -> null", hashEmail("hola"), null);
t("teléfono 9 dígitos == con 56", hashPhone("9 3371 3153"), hashPhone("+56 9 3371 3153"));
t("teléfono basura -> null", hashPhone("123"), null);
const m = sanitizeMarketing({ utm_campaign: "Agenda Oct", fbclid: "XYZ12345", fbp: "fb.1.1700000000000.1234567890", fbc: "malo", evil: 1, source_url: "https://www.re-booking.cl/suscribirse" }) as any;
t("campaña limpia", m.utm_campaign, "agenda-oct");
t("fbp válido se guarda", m.fbp, "fb.1.1700000000000.1234567890");
t("fbc inválido se descarta", m.fbc, undefined);
t("sin nada -> null", sanitizeMarketing({}), null);
const p: any = buildCapiPayload({ eventName: "Purchase", eventId: "purchase_1", email: "a@b.cl", phone: "933713153", attribution: m, value: 15458.4, contentName: "basic" }, 1700000000);
const ev = p.data[0];
t("evento y dedupe", [ev.event_name, ev.event_id, ev.action_source], ["Purchase", "purchase_1", "website"]);
t("valor en CLP entero", [ev.custom_data.value, ev.custom_data.currency], [15458, "CLP"]);
t("correo NO va en claro", JSON.stringify(p).includes("a@b.cl"), false);
t("teléfono NO va en claro", JSON.stringify(p).includes("933713153"), false);
t("correo hasheado de 64 caracteres", ev.user_data.em[0].length, 64);
t("fbc se arma desde fbclid", ev.user_data.fbc.endsWith(".XYZ12345"), true);
(async () => {
  delete process.env.META_CAPI_ACCESS_TOKEN; delete process.env.META_PIXEL_ID; delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  let called = 0; const fakeFetch = (async () => { called++; return { ok: true, status: 200 }; }) as any;
  t("apagado sin variables: no envía", [(await sendCapiEvent({ eventName: "Purchase", eventId: "x" }, fakeFetch)).sent, called], [false, 0]);
  process.env.META_PIXEL_ID = "123456789012345"; process.env.META_CAPI_ACCESS_TOKEN = "token-falso";
  t("encendido: envía", [(await sendCapiEvent({ eventName: "Purchase", eventId: "x" }, fakeFetch)).sent, called], [true, 1]);
  const bad = (async () => { throw new Error("red caída"); }) as any;
  t("si Meta falla, no lanza", (await sendCapiEvent({ eventName: "Purchase", eventId: "x" }, bad)).sent, false);
  const r = resumenCampanas([
    { status: "paid", amount: 15458, ad_attribution: { utm_source: "meta", utm_campaign: "oct" } },
    { status: "pending", amount: 15458, ad_attribution: { utm_source: "meta", utm_campaign: "oct" } },
    { status: "paid", amount: 30000 },
  ]);
  t("campaña oct: 2 empezaron, 1 pagó, 50%", [r.find((x) => x.campaign === "oct")!.iniciados, r.find((x) => x.campaign === "oct")!.pagados, r.find((x) => x.campaign === "oct")!.conversion], [2, 1, 50]);
  t("directo suma aparte y va primero por ingresos", [r[0].campaign, r[0].ingresos], ["(directo / sin etiqueta)", 30000]);
  console.log(fails ? `${fails} fallas` : "TODO OK");
  process.exit(fails ? 1 : 0);
})();
