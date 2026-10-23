// Pruebas de Retencion: casillas por cliente, nombre generico en la vista previa y logo del negocio en el correo.
// Ejecutar: RESEND_API_KEY=x npx tsx scripts/test-retencion-seleccion.ts
import { parseExcludeIds, excludeClients, dedupeBy } from "../src/lib/retention";
import { buildRetentionWhatsApp, greetingName } from "../src/lib/retention-message";
import { buildRetentionEmail } from "../src/lib/resend";

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

// ---------- ids desmarcados que manda el navegador ----------
t("sin lista -> nadie excluido", parseExcludeIds(undefined).size === 0 && parseExcludeIds(null).size === 0 && parseExcludeIds("abc").size === 0 && parseExcludeIds({}).size === 0);
t("lista normal", parseExcludeIds(["a", "b", "a"]).size === 2);
t("se ignoran valores que no son texto, vacios o gigantes", parseExcludeIds([1, null, {}, "", "x".repeat(65), "ok"]).size === 1);
t("tope de 20.000 ids", parseExcludeIds(Array.from({ length: 30000 }, (_, i) => "id" + i)).size === 20000);

// ---------- quitar a los desmarcados ----------
const lista = [
  { id: "1", name: "Ana", email: "ana@x.cl", phone: "+56911111111" },
  { id: "2", name: "Ana (duplicada)", email: "ana@x.cl", phone: "+56911111111" }, // misma persona, otra ficha
  { id: "3", name: "Beto", email: "beto@x.cl", phone: null as string | null },
  { id: "4", name: "Caro", email: null as string | null, phone: "+56922222222" },
];
const conCorreo = (l: typeof lista) => dedupeBy(l.filter((c) => c.email), (c) => c.email!.trim().toLowerCase());
t("sin desmarcados: la lista queda igual", excludeClients(lista, new Set()).length === 4);
t("desmarcar a Beto: no recibe y el resto igual", excludeClients(lista, new Set(["3"])).map((c) => c.id).join() === "1,2,4");
t("desmarcar un id que no esta en la lista no hace nada", excludeClients(lista, new Set(["999"])).length === 4);
t("desmarcar TODOS: lista vacia", excludeClients(lista, new Set(["1", "2", "3", "4"])).length === 0);
t("correos sin desmarcar: Ana (dos fichas, un correo) + Beto = 2", conCorreo(excludeClients(lista, new Set())).length === 2);
t("desmarcar una ficha de Ana: Ana sigue recibiendo por la otra", conCorreo(excludeClients(lista, new Set(["1"]))).map((c) => c.id).join() === "2,3");
t("desmarcar las dos fichas de Ana: ya no recibe", conCorreo(excludeClients(lista, new Set(["1", "2"]))).map((c) => c.id).join() === "3");
t("desmarcar a Beto: solo queda Ana", conCorreo(excludeClients(lista, new Set(["3"]))).length === 1);

// ---------- nombre generico de la vista previa ----------
t("nombre normal: solo el primero", greetingName("Tomas Munoz Perez") === "Tomas");
t("marcador entre corchetes: se usa completo", greetingName("[nombre del cliente]") === "[nombre del cliente]");
t("sin nombre: vacio", greetingName("") === "" && greetingName(null) === "");
const url = "https://re-booking.cl/b/estudiolevels";
const wa = buildRetentionWhatsApp({ clientName: "[nombre del cliente]", bookingUrl: url });
t("WhatsApp de muestra: 'Hola [nombre del cliente]!'", wa.startsWith("Hola [nombre del cliente]! Te extrañamos"), wa.split("\n")[0]);
const waReal = buildRetentionWhatsApp({ clientName: "Tomas Munoz", bookingUrl: url });
t("WhatsApp real: cada cliente con SU nombre", waReal.startsWith("Hola Tomas! Te extrañamos"));
const mk = (name: string, logo?: string | null) => buildRetentionEmail({ to: "a@b.cl", clientName: name, message: "Hola", couponCode: null, couponDescription: null, discountType: null, discountValue: null, bookingUrl: url, businessLogoUrl: logo });
const eMuestra = mk("[nombre del cliente]");
t("Correo de muestra: saludo y asunto genericos", /Hola \[nombre del cliente\]!/.test(eMuestra.html) && eMuestra.subject.includes("[nombre del cliente]"));
const e1 = mk("Tomas Munoz"), e2 = mk("Bastian Vidal");
t("Correo real: cada cliente recibe el suyo con su propio nombre", /Hola Tomas Munoz!/.test(e1.html) && /Hola Bastian Vidal!/.test(e2.html) && !/Bastian/.test(e1.html) && !/Tomas/.test(e2.html));

// ---------- logo del negocio ----------
const LOGO = "https://abc.supabase.co/storage/v1/object/public/logos/estudio-levels.png";
const conLogo = mk("Tomas", LOGO).html;
t("Correo con logo del negocio: lo muestra", conLogo.includes(`src="${LOGO}"`));
t("Correo con logo del negocio: ya no pone el de re-booking arriba", !conLogo.includes("logo-horizontal.png"));
const sinLogo = mk("Tomas", null).html;
t("Correo sin logo cargado: usa el de re-booking (como los demas correos)", sinLogo.includes("logo-horizontal.png"));
t("Correo sin parametro de logo: igual que antes", mk("Tomas").html.includes("logo-horizontal.png"));
const raro = mk("Tomas", 'https://x.cl/a.png"><script>alert(1)</script>').html;
t("Un logo con comillas o etiquetas no rompe el HTML", !raro.includes("<script>alert(1)") && raro.includes("&quot;"));

process.exit(fails ? 1 : 0);
