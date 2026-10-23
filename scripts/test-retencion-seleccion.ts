// Pruebas de Retencion: casillas por cliente, nombre generico en la vista previa y logo del negocio en el correo.
// Ejecutar: RESEND_API_KEY=x npx tsx scripts/test-retencion-seleccion.ts
import { parseExcludeIds, parseIdSet, excludeClients, dedupeBy, isOptedOut, mergeRecipients, loadManualRecipients } from "../src/lib/retention";
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

// (el cierre del proceso va al final, despues de las pruebas con base falsa)
// ---------- clientes agregados a mano ----------
t("ids a agregar: tope de 500", parseIdSet(Array.from({ length: 900 }, (_, i) => "c" + i), 500).size === 500);
t("ids a agregar: ignora basura", parseIdSet([1, "", null, "ok", "ok"], 500).size === 1 && parseIdSet("x", 500).size === 0);
t("pidio no ser contactado -> fuera", isOptedOut({ do_not_contact: true }));
t("rechazo promociones -> fuera", isOptedOut({ marketing_consent: false }));
t("sin marca (o aceptó) -> puede recibir", !isOptedOut({}) && !isOptedOut({ marketing_consent: true, do_not_contact: false }) && !isOptedOut({ marketing_consent: null }));
const base2 = [{ id: "1", name: "Ana" }, { id: "2", name: "Beto" }];
t("unir listas: sin repetir ids (gana el calculado)", mergeRecipients(base2, [{ id: "2", name: "Beto manual" }, { id: "9", name: "Zoe" }]).map((c) => c.id + ":" + c.name).join() === "1:Ana,2:Beto,9:Zoe");

// Base falsa: registra los filtros que usa la consulta, para comprobar que SOLO lee clientes del negocio.
function fakeClients(rowsById: Record<string, any>, opts: { sinMigracion101?: boolean } = {}) {
  const log: Array<{ cols: string; tenant?: string; ids?: string[] }> = [];
  return {
    log,
    from(table: string) {
      if (table !== "clients") throw new Error("tabla inesperada " + table);
      const call: any = { cols: "", tenant: undefined, ids: undefined };
      const b: any = {
        select: (cols: string) => { call.cols = cols; return b; },
        eq: (col: string, v: string) => { if (col === "tenant_id") call.tenant = v; return b; },
        in: (_col: string, ids: string[]) => { call.ids = ids; log.push(call); return b; },
        then: (res: any) => {
          const conConsent = call.cols.includes("marketing_consent");
          if (conConsent && opts.sinMigracion101) return res({ data: null, error: { message: "column does not exist" } });
          const data = (call.ids || []).filter((id: string) => rowsById[id] && rowsById[id].tenant_id === call.tenant).map((id: string) => {
            const r = rowsById[id];
            return conConsent ? { id, name: r.name, email: r.email, phone: r.phone, marketing_consent: r.marketing_consent, do_not_contact: r.do_not_contact } : { id, name: r.name, email: r.email, phone: r.phone };
          });
          return res({ data, error: null });
        },
      };
      return b;
    },
  } as any;
}
const filas = {
  a: { tenant_id: "T1", name: "Ana", email: "ana@x.cl", phone: "+56911111111", marketing_consent: true, do_not_contact: false },
  b: { tenant_id: "T1", name: "Beto", email: "beto@x.cl", phone: null, marketing_consent: false, do_not_contact: false }, // rechazo promociones
  c: { tenant_id: "T1", name: "Caro", email: null, phone: "+56922222222", marketing_consent: null, do_not_contact: true }, // no contactar
  d: { tenant_id: "T2", name: "Otro negocio", email: "o@x.cl", phone: null, marketing_consent: true, do_not_contact: false },
};
(async () => {
  const db = fakeClients(filas);
  const r = await loadManualRecipients(db, "T1", new Set(["a", "b", "c", "d", "no-existe"]));
  t("agregar a mano: entra quien acepta promociones", r.recipients.map((x) => x.id).join() === "a");
  t("agregar a mano: se descartan los 2 que no quieren promociones y se cuentan", r.skippedOptedOut === 2, `omitidos: ${r.skippedOptedOut}`);
  t("agregar a mano: un cliente de OTRO negocio nunca entra", !r.recipients.some((x) => x.id === "d"));
  t("agregar a mano: la consulta se filtra por el negocio", db.log.every((c: any) => c.tenant === "T1"));
  const db2 = fakeClients(filas, { sinMigracion101: true });
  const r2 = await loadManualRecipients(db2, "T1", new Set(["a", "b"]));
  t("sin la migracion 101 sigue funcionando (sin marca de consentimiento)", r2.recipients.length === 2 && r2.skippedOptedOut === 0);
  const db3 = fakeClients(filas);
  await loadManualRecipients(db3, "T1", new Set(Array.from({ length: 230 }, (_, i) => "x" + i)));
  t("muchos ids: se consulta por lotes de 100", db3.log.length === 3 && db3.log.every((c: any) => c.ids.length <= 100), `consultas: ${db3.log.length}`);
  const vacio = await loadManualRecipients(fakeClients(filas), "T1", new Set());
  t("sin ids: nada", vacio.recipients.length === 0 && vacio.skippedOptedOut === 0);
  process.exit(fails ? 1 : 0);
})();

