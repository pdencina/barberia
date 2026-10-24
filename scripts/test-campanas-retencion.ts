// Pruebas del historial de campanas de Retencion (src/lib/retention-campaigns.ts) con una base simulada.
// Ejecutar: RESEND_API_KEY=x npx tsx scripts/test-campanas-retencion.ts
import { recordCampaign, listCampaigns, getCampaignDetail, recentlyContacted, couponSnapshot, cleanCampaignName, type CampaignInput } from "../src/lib/retention-campaigns";

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

type Call = { table: string; ops: Array<{ m: string; a: any[] }> };
// Base falsa: anota cada consulta (tabla y filtros) y responde lo que decida `answer`.
function fakeDb(answer: (call: Call) => { data?: any; error?: any } | Promise<any>) {
  const calls: Call[] = [];
  return {
    calls,
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const result = () => Promise.resolve(answer(call)).then((r: any) => ({ data: r?.data ?? null, error: r?.error ?? null }));
      const b: any = {};
      for (const m of ["select", "eq", "in", "gte", "order", "limit", "insert"]) b[m] = (...a: any[]) => { call.ops.push({ m, a }); return b; };
      b.single = () => result();
      b.maybeSingle = () => result();
      b.then = (res: any, rej: any) => result().then(res, rej);
      return b;
    },
  } as any;
}
const op = (c: Call, m: string) => c.ops.find((o) => o.m === m);

const base: CampaignInput = {
  tenantId: "T1", name: "Campaña octubre semana 3 / 30-45 días", userId: "u1", userName: "Nicolás Levels", channel: "email",
  message: "🎁 ¡TENEMOS UN REGALO PARA TI!", couponCode: "CEJAS GRATIS", couponDetail: "CEJAS GRATIS · Muestra este cupón",
  rangeMinDays: 25, rangeMaxDays: 45, includeNever: false, plannedTotal: 270, sentCount: 268, failedCount: 2,
  quotaExceeded: false, excludedCount: 3, manualCount: 2,
  recipients: Array.from({ length: 1100 }, (_, i) => ({ clientId: "c" + i, name: "Cliente " + i, contact: `c${i}@x.cl`, status: (i === 0 ? "failed" : "sent") as "sent" | "failed" })),
};

(async () => {
  // ---------- registrar ----------
  let db = fakeDb((c) => (c.table === "retention_campaigns" ? { data: { id: "camp-1" } } : {}));
  let id = await recordCampaign(db, base);
  const camp = db.calls.find((c: Call) => c.table === "retention_campaigns")!;
  const row = op(camp, "insert")!.a[0];
  t("registrar: devuelve el id de la campana", id === "camp-1");
  t("registrar: guarda negocio, canal, quien, mensaje y cupon", row.tenant_id === "T1" && row.channel === "email" && row.created_by === "u1" && row.created_by_name === "Nicolás Levels" && row.message === base.message && row.coupon_code === "CEJAS GRATIS" && row.coupon_detail === base.couponDetail);
  t("registrar: guarda el nombre de la campana", row.name === "Campaña octubre semana 3 / 30-45 días");
  t("registrar: guarda rango, totales y marcas", row.range_min_days === 25 && row.range_max_days === 45 && row.planned_total === 270 && row.sent_count === 268 && row.failed_count === 2 && row.excluded_count === 3 && row.manual_count === 2 && row.quota_exceeded === false);
  t("registrar: queda marcada como hecha desde la app", row.source === "app");
  const recCalls = db.calls.filter((c: Call) => c.table === "retention_campaign_recipients");
  t("registrar: 1.100 destinatarios en 3 lotes (500+500+100)", recCalls.length === 3 && op(recCalls[0], "insert")!.a[0].length === 500 && op(recCalls[2], "insert")!.a[0].length === 100, `lotes: ${recCalls.length}`);
  const r0 = op(recCalls[0], "insert")!.a[0][0];
  t("registrar: cada destinatario lleva campana, negocio, cliente, contacto y estado", r0.campaign_id === "camp-1" && r0.tenant_id === "T1" && r0.client_id === "c0" && r0.contact === "c0@x.cl" && r0.status === "failed");

  // ---------- si falta la migracion o falla: nunca rompe ----------
  db = fakeDb(() => ({ error: { message: 'relation "retention_campaigns" does not exist' } }));
  id = await recordCampaign(db, base);
  t("falta la migracion: devuelve null, no lanza error y no intenta guardar destinatarios", id === null && db.calls.every((c: Call) => c.table === "retention_campaigns"));
  db = fakeDb((c) => (c.table === "retention_campaigns" ? { data: { id: "camp-2" } } : { error: { message: "falla" } }));
  id = await recordCampaign(db, { ...base, recipients: base.recipients.slice(0, 10) });
  t("si falla guardar los destinatarios, la campana igual queda registrada", id === "camp-2");
  const roto: any = { from() { throw new Error("se cayo la base"); } };
  t("si la base lanza una excepcion, no se propaga", (await recordCampaign(roto, base)) === null);

  // ---------- nombre de la campana ----------
  t("nombre: se conserva tal cual (con tildes, barras y numeros)", cleanCampaignName("Campaña octubre semana 3 / 30-45 días") === "Campaña octubre semana 3 / 30-45 días");
  t("nombre: se quitan espacios y saltos de linea de mas", cleanCampaignName("  Campaña\n\n  octubre   ") === "Campaña octubre");
  t("nombre: vacio, solo espacios o algo que no es texto -> sin nombre", cleanCampaignName("   ") === null && cleanCampaignName("") === null && cleanCampaignName(null) === null && cleanCampaignName(42) === null && cleanCampaignName(undefined) === null);
  t("nombre: tope de 120 caracteres", cleanCampaignName("x".repeat(300))!.length === 120);
  db = fakeDb((c) => (c.table === "retention_campaigns" ? { data: { id: "camp-3" } } : {}));
  await recordCampaign(db, { ...base, name: "   ", recipients: [] });
  t("registrar: un nombre en blanco se guarda como sin nombre", op(db.calls[0], "insert")!.a[0].name === null);

  // ---------- cupon tal como estaba ----------
  t("cupon con monto", couponSnapshot({ code: "VUELVE10", description: "x", discount_type: "percentage", discount_value: 10 }) === "VUELVE10 · 10% de descuento");
  t("cupon sin monto: usa su descripcion", couponSnapshot({ code: "CEJAS GRATIS", description: "Muestra este cupón", discount_type: "fixed_amount", discount_value: 0 }) === "CEJAS GRATIS · Muestra este cupón");
  t("cupon sin monto y sin descripcion: solo el codigo", couponSnapshot({ code: "HOLA", description: "", discount_value: 0 }) === "HOLA");
  t("sin cupon: null", couponSnapshot(null) === null);

  // ---------- listar ----------
  const fila = { id: "k1", name: "Campaña de prueba", channel: "email", created_at: "2026-10-23T16:34:00Z", created_by_name: "Nico", message: "Hola", coupon_code: "X", coupon_detail: "X · y", range_min_days: 25, range_max_days: 45, include_never: false, planned_total: "270", sent_count: 270, failed_count: 0, quota_exceeded: false, excluded_count: 0, manual_count: 0, source: "app" };
  db = fakeDb(() => ({ data: [fila] }));
  let l = await listCampaigns(db, "T1");
  const lc = db.calls[0];
  t("listar: filtra por el negocio y ordena de la mas nueva a la mas antigua", op(lc, "eq")!.a[0] === "tenant_id" && op(lc, "eq")!.a[1] === "T1" && op(lc, "order")!.a[1].ascending === false);
  t("listar: convierte los campos (numeric como texto -> numero)", l.campaigns[0].plannedTotal === 270 && l.campaigns[0].sentCount === 270 && l.campaigns[0].createdByName === "Nico" && l.migrationMissing === false);
  t("listar: trae el nombre de cada campana", l.campaigns[0].name === "Campaña de prueba");
  db = fakeDb(() => ({ error: { message: 'relation "public.retention_campaigns" does not exist' } }));
  l = await listCampaigns(db, "T1");
  t("listar sin migracion: lista vacia y avisa que falta aplicarla", l.campaigns.length === 0 && l.migrationMissing === true);
  db = fakeDb(() => ({ error: { message: "timeout" } }));
  t("listar con otro error: lista vacia sin decir que falta la migracion", (await listCampaigns(db, "T1")).migrationMissing === false);

  // ---------- detalle ----------
  db = fakeDb((c) => (c.table === "retention_campaigns" ? { data: fila } : { data: [{ id: "r1", client_id: "c1", name: "Ana", contact: "a@x.cl", status: "sent" }] }));
  const d = await getCampaignDetail(db, "T1", "k1");
  t("detalle: busca por negocio Y por id (nunca una campana de otro negocio)", db.calls[0].ops.filter((o: any) => o.m === "eq").map((o: any) => o.a.join("=")).sort().join() === "id=k1,tenant_id=T1");
  t("detalle: trae los destinatarios", d?.recipients.length === 1 && d.recipients[0].name === "Ana" && d.recipients[0].status === "sent");
  t("detalle: campana que no existe -> null", (await getCampaignDetail(fakeDb(() => ({ data: null })), "T1", "nada")) === null);

  // ---------- "ya recibio una campana hace poco" ----------
  const ahora = Date.now();
  const hace = (dias: number) => new Date(ahora - dias * 86400000).toISOString();
  db = fakeDb(() => ({
    data: [
      { client_id: "a", created_at: hace(2), campaign_id: "k2", campaign: { coupon_code: "CEJAS GRATIS" } },
      { client_id: "a", created_at: hace(20), campaign_id: "k1", campaign: { coupon_code: "OTRO" } }, // mas antigua del mismo cliente
      { client_id: "b", created_at: hace(5), campaign_id: "k2", campaign: [{ coupon_code: null }] }, // el embed puede venir como lista
      { client_id: null, created_at: hace(1), campaign_id: "k2", campaign: null },
    ],
  }));
  const rc = await recentlyContacted(db, "T1", ["a", "b", "c"]);
  t("recientes: de cada cliente queda el envio mas reciente y su cupon", rc.get("a")?.couponCode === "CEJAS GRATIS" && rc.get("a")?.campaignId === "k2" && rc.size === 2);
  t("recientes: acepta el embed como lista", rc.get("b")?.couponCode === null && rc.has("b"));
  t("recientes: quien no recibio nada no aparece", !rc.has("c"));
  const q = db.calls[0];
  t("recientes: filtra por negocio, solo enviados exitosos y por fecha", q.ops.some((o: any) => o.m === "eq" && o.a[0] === "tenant_id" && o.a[1] === "T1") && q.ops.some((o: any) => o.m === "eq" && o.a[0] === "status" && o.a[1] === "sent") && q.ops.some((o: any) => o.m === "gte" && o.a[0] === "created_at"));
  const desde = new Date(op(q, "gte")!.a[1]).getTime();
  t("recientes: la ventana es de 30 dias", Math.abs((ahora - desde) / 86400000 - 30) < 0.01);
  db = fakeDb(() => ({ data: [] }));
  await recentlyContacted(db, "T1", Array.from({ length: 250 }, (_, i) => "c" + i));
  t("recientes: 250 clientes se consultan por lotes de 100", db.calls.length === 3 && db.calls.every((c: Call) => op(c, "in")!.a[1].length <= 100), `consultas: ${db.calls.length}`);
  db = fakeDb(() => ({ data: [] }));
  t("recientes: sin clientes no consulta nada", (await recentlyContacted(db, "T1", [])).size === 0 && db.calls.length === 0);
  db = fakeDb(() => ({ error: { message: "does not exist" } }));
  t("recientes sin migracion: vacio, sin romper el envio", (await recentlyContacted(db, "T1", ["a"])).size === 0);

  process.exit(fails ? 1 : 0);
})();
