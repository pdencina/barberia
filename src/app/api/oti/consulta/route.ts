import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { chileDayBoundsUtc } from "@/lib/utils";
import { fetchAllRows } from "@/lib/accounting";

export const dynamic = "force-dynamic";

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MEDIOS = ["credit_card", "debit_card", "cash", "transfer"];
const trozos = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Cifras para Oti. SOLO administrador/super admin. El negocio sale de la sesion (nunca del navegador) y cada filtro lleva tenant_id.
export async function POST(req: NextRequest) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio para consultar sus cifras." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { metrica, desde, hasta, barberId, medio, diaSemana, orden } = body as Record<string, any>;
  if (!["dinero", "servicios", "ranking", "promedio_dia", "dias", "consejos"].includes(metrica) || !FECHA.test(desde || "") || !FECHA.test(hasta || "") || desde > hasta)
    return NextResponse.json({ error: "Consulta no valida" }, { status: 400 });
  if (Date.parse(hasta) - Date.parse(desde) > 400 * 86400000) return NextResponse.json({ error: "Periodo demasiado largo" }, { status: 400 });
  if (medio !== undefined && !MEDIOS.includes(medio)) return NextResponse.json({ error: "Medio de pago no valido" }, { status: 400 });

  const supabase = createAdminSupabase();
  if (barberId !== undefined) {
    if (typeof barberId !== "string") return NextResponse.json({ error: "Profesional no valido" }, { status: 400 });
    const { data: p } = await supabase.from("profiles").select("id").eq("id", barberId).eq("tenant_id", tenantId).maybeSingle();
    if (!p) return NextResponse.json({ error: "Ese profesional no es de tu negocio" }, { status: 404 });
  }

  if (diaSemana !== undefined && !(Number.isInteger(diaSemana) && diaSemana >= 1 && diaSemana <= 7)) return NextResponse.json({ error: "Dia no valido" }, { status: 400 });
  if (["promedio_dia", "dias", "consejos"].includes(metrica)) {
    try { return NextResponse.json({ texto: await analisis(supabase, tenantId, metrica, desde, hasta, barberId, medio, diaSemana, orden) }); }
    catch { return NextResponse.json({ error: "No pude calcularlo" }, { status: 500 }); }
  }

  const ini = chileDayBoundsUtc(desde).startUtc;
  const fin = chileDayBoundsUtc(new Date(Date.parse(hasta) + 86400000).toISOString().slice(0, 10)).startUtc;
  let tx: { id: string; total: number | null; barber_id: string | null; payment_method: string | null }[];
  try {
    tx = await fetchAllRows(() => {
      let q = supabase.from("transactions").select("id, total, barber_id, payment_method")
        .eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").gte("created_at", ini).lt("created_at", fin);
      if (barberId) q = q.eq("barber_id", barberId);
      return q;
    });
  } catch { return NextResponse.json({ error: "No pude leer las ventas" }, { status: 500 }); }

  // Monto por venta, segun el medio pedido (las ventas mixtas se reparten con sus pagos).
  let montos = new Map<string, number>(tx.map((t) => [t.id, Number(t.total) || 0]));
  if (medio) {
    montos = new Map();
    const mixtas = tx.filter((t) => t.payment_method === "mixed").map((t) => t.id);
    for (const t of tx) if (t.payment_method === medio) montos.set(t.id, Number(t.total) || 0);
    for (const ids of trozos(mixtas, 150)) {
      const { data } = await supabase.from("transaction_payments").select("transaction_id, amount").in("transaction_id", ids).eq("payment_method", medio);
      for (const r of (data as any[]) || []) montos.set(r.transaction_id, (montos.get(r.transaction_id) || 0) + (Number(r.amount) || 0));
    }
  }
  const dentro = tx.filter((t) => montos.has(t.id));

  if (metrica === "dinero") {
    const total = dentro.reduce((s, t) => s + (montos.get(t.id) || 0), 0);
    return NextResponse.json({ total: clp(total), ventas: dentro.length });
  }

  // Servicios realizados (lineas de tipo servicio de cada venta).
  const porBarbero = new Map<string, { servicios: number; dinero: number }>();
  let servicios = 0;
  const duenoDe = new Map(tx.map((t) => [t.id, t.barber_id]));
  for (const ids of trozos(dentro.map((t) => t.id), 150)) {
    const { data } = await supabase.from("transaction_items").select("transaction_id, quantity, service_id").in("transaction_id", ids).not("service_id", "is", null);
    for (const it of (data as any[]) || []) {
      const q = Number(it.quantity) || 1;
      servicios += q;
      const b = duenoDe.get(it.transaction_id);
      if (b) porBarbero.set(b, { servicios: (porBarbero.get(b)?.servicios || 0) + q, dinero: porBarbero.get(b)?.dinero || 0 });
    }
  }
  if (metrica === "servicios") return NextResponse.json({ servicios, ventas: dentro.length });

  for (const t of dentro) if (t.barber_id) { const c = porBarbero.get(t.barber_id) || { servicios: 0, dinero: 0 }; c.dinero += montos.get(t.id) || 0; porBarbero.set(t.barber_id, c); }
  const ids = Array.from(porBarbero.keys());
  const { data: perfiles } = ids.length ? await supabase.from("profiles").select("id, name").eq("tenant_id", tenantId).in("id", ids) : { data: [] as any[] };
  const nombre = new Map((perfiles as any[]).map((p) => [p.id, p.name as string]));
  const ranking = ids.filter((id) => nombre.has(id)).map((id) => ({ nombre: nombre.get(id)!, servicios: porBarbero.get(id)!.servicios, dinero: clp(porBarbero.get(id)!.dinero) }))
    .sort((a, b) => b.servicios - a.servicios).slice(0, 5);
  return NextResponse.json({ ranking });
}


// ---------------------------------------------------------------------------------------------
// Preguntas con analisis (promedios, dias fuertes/flojos y consejos). Siempre con cifras reales del negocio; nunca inventa.
const DIAS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaChile = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
const horaChile = (iso: string) => Number(new Date(iso).toLocaleString("en-GB", { timeZone: "America/Santiago", hour: "2-digit", hour12: false }).slice(0, 2)) % 24;
const dowDe = (f: string) => { const d = new Date(`${f}T12:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; };
const fcorta = (f: string) => `${DIAS[dowDe(f)]} ${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

export async function analisis(supabase: any, tenantId: string, metrica: string, desde: string, hasta: string, barberId: string | undefined, medio: string | undefined, diaSemana: number | undefined, orden: string | undefined): Promise<string> {
  const ini = chileDayBoundsUtc(desde).startUtc;
  const fin = chileDayBoundsUtc(new Date(Date.parse(hasta) + 86400000).toISOString().slice(0, 10)).startUtc;
  type Tx = { id: string; total: number | null; barber_id: string | null; client_id: string | null; payment_method: string | null; created_at: string };
  const tx: Tx[] = await fetchAllRows(() => {
    let q = supabase.from("transactions").select("id, total, barber_id, client_id, payment_method, created_at")
      .eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").gte("created_at", ini).lt("created_at", fin);
    if (barberId) q = q.eq("barber_id", barberId);
    if (medio) q = q.eq("payment_method", medio);
    return q;
  });
  const conTotal = (t: Tx) => Number(t.total) || 0;
  const serviciosPorTx = new Map<string, number>();
  const ingresoPorServicio = new Map<string, number>();
  for (const ids of trozos(tx.map((t) => t.id), 150)) {
    const { data } = await supabase.from("transaction_items").select("transaction_id, quantity, service_id, unit_price").in("transaction_id", ids).not("service_id", "is", null);
    for (const it of data || []) {
      const q = Number(it.quantity) || 1;
      serviciosPorTx.set(it.transaction_id, (serviciosPorTx.get(it.transaction_id) || 0) + q);
      ingresoPorServicio.set(it.service_id, (ingresoPorServicio.get(it.service_id) || 0) + q * (Number(it.unit_price) || 0));
    }
  }
  const porDia = new Map<string, { dinero: number; ventas: number; servicios: number }>();
  for (const t of tx) {
    const f = fechaChile(t.created_at);
    const c = porDia.get(f) || { dinero: 0, ventas: 0, servicios: 0 };
    c.dinero += conTotal(t); c.ventas += 1; c.servicios += serviciosPorTx.get(t.id) || 0;
    porDia.set(f, c);
  }
  const dias = Array.from(porDia.entries()).map(([fecha, v]) => ({ fecha, ...v, dow: dowDe(fecha) }));

  if (metrica === "promedio_dia") {
    const sel = diaSemana ? dias.filter((d) => d.dow === diaSemana) : dias;
    const nombre = diaSemana ? `un ${DIAS[diaSemana]}` : "un día de atención";
    if (!sel.length) return `No encontré ventas ${diaSemana ? `en ${DIAS[diaSemana]}s ` : ""}entre el ${desde} y el ${hasta}.`;
    const sum = (k: "dinero" | "ventas" | "servicios") => sel.reduce((s, d) => s + d[k], 0);
    const n = sel.length;
    return `Promedio de ${nombre} (${n} ${diaSemana ? (n === 1 || diaSemana <= 5 ? DIAS[diaSemana] : DIAS[diaSemana] + "s") : "días"} con ventas, del ${desde} al ${hasta}):\n• ${(sum("servicios") / n).toFixed(1).replace(".", ",")} servicios\n• ${(sum("ventas") / n).toFixed(1).replace(".", ",")} ventas\n• ${clp(sum("dinero") / n)} vendidos\nSolo cuento días con al menos una venta y ventas cobradas.`;
  }

  if (metrica === "dias") {
    if (dias.length < 2) return "Todavía hay muy pocos días con ventas en ese período para compararlos.";
    const ord = [...dias].sort((a, b) => a.dinero - b.dinero);
    const lento = orden !== "fuerte";
    const top = (lento ? ord : [...ord].reverse()).slice(0, 3);
    const lineas = top.map((d, i) => `${i + 1}. ${fcorta(d.fecha)}: ${clp(d.dinero)} (${d.servicios} servicios, ${d.ventas} ventas)`);
    const prom = dias.reduce((s, d) => s + d.dinero, 0) / dias.length;
    // Dia de la semana mas flojo/fuerte en promedio (solo si hay al menos 2 de ese dia).
    const porDow = new Map<number, { s: number; n: number }>();
    for (const d of dias) { const c = porDow.get(d.dow) || { s: 0, n: 0 }; c.s += d.dinero; c.n += 1; porDow.set(d.dow, c); }
    const dows = Array.from(porDow.entries()).filter(([, c]) => c.n >= 2).map(([k, c]) => ({ k, prom: c.s / c.n, n: c.n })).sort((a, b) => a.prom - b.prom);
    const extra = dows.length >= 2 ? `\nPor día de la semana, en promedio: el más ${lento ? "flojo" : "fuerte"} es el ${DIAS[(lento ? dows[0] : dows[dows.length - 1]).k]} (${clp((lento ? dows[0] : dows[dows.length - 1]).prom)}) y el más ${lento ? "fuerte" : "flojo"} es el ${DIAS[(lento ? dows[dows.length - 1] : dows[0]).k]} (${clp((lento ? dows[dows.length - 1] : dows[0]).prom)}).` : "";
    return `Los días más ${lento ? "lentos" : "fuertes"} (del ${desde} al ${hasta}):\n${lineas.join("\n")}\nPromedio de un día con ventas: ${clp(prom)}.${extra}`;
  }

  // consejos: ultimos 60 dias contra los 60 anteriores, con cifras reales.
  const corte = new Date(Date.parse(hasta) - 59 * 86400000).toISOString().slice(0, 10);
  const prev = tx.filter((t) => fechaChile(t.created_at) < corte), act = tx.filter((t) => fechaChile(t.created_at) >= corte);
  if (act.length < 10) return "Todavía tengo pocas ventas registradas para darte consejos con cifras reales. Cuando haya más historial, te digo dónde está la oportunidad.";
  const sumTot = (a: Tx[]) => a.reduce((s, t) => s + conTotal(t), 0);
  const totAct = sumTot(act), totPrev = sumTot(prev);
  const variacion = pct(totAct, totPrev);
  const ticket = totAct / act.length;
  const opciones: string[] = [];

  // 1) Dia de la semana mas flojo.
  const actDias = dias.filter((d) => d.fecha >= corte);
  const porDow = new Map<number, { s: number; n: number }>();
  for (const d of actDias) { const c = porDow.get(d.dow) || { s: 0, n: 0 }; c.s += d.dinero; c.n += 1; porDow.set(d.dow, c); }
  const dows = Array.from(porDow.entries()).filter(([, c]) => c.n >= 3).map(([k, c]) => ({ k, prom: c.s / c.n })).sort((a, b) => a.prom - b.prom);
  if (dows.length >= 3) {
    const flojo = dows[0], fuerte = dows[dows.length - 1];
    opciones.push(`Llena tus ${DIAS[flojo.k]}s: vendes en promedio ${clp(flojo.prom)} ese día, contra ${clp(fuerte.prom)} los ${DIAS[fuerte.k]}s (${Math.round((1 - flojo.prom / fuerte.prom) * 100)}% menos). Un cupón o promoción solo para ${DIAS[flojo.k]}s, o avisar por WhatsApp, es lo más directo (Cupones, Mapa de demanda).`);
  }

  // 2) Franja horaria mas floja dentro del horario real de atencion.
  const porHora = new Map<number, number>();
  for (const t of act) { const h = horaChile(t.created_at); porHora.set(h, (porHora.get(h) || 0) + 1); }
  const horas = Array.from(porHora.entries()).filter(([, n]) => n >= 3).sort((a, b) => a[0] - b[0]);
  if (horas.length >= 4) {
    const media = horas.reduce((s, [, n]) => s + n, 0) / horas.length;
    const flojas = horas.filter(([, n]) => n < media * 0.6).sort((a, b) => a[1] - b[1]).slice(0, 2);
    if (flojas.length) opciones.push(`Hay horas que se llenan poco: ${flojas.map(([h, n]) => `${hh(h)} (${n} ventas en 60 días, contra ${Math.round(media)} de promedio por hora)`).join(" y ")}. Ofrece un descuento o un servicio extra justo en ese horario.`);
  }

  // 3) Clientes que dejaron de venir.
  const ultima = new Map<string, string>();
  for (const t of tx) if (t.client_id) { const f = fechaChile(t.created_at); if (!ultima.get(t.client_id) || f > ultima.get(t.client_id)!) ultima.set(t.client_id, f); }
  const limite45 = new Date(Date.parse(hasta) - 45 * 86400000).toISOString().slice(0, 10);
  const perdidos = Array.from(ultima.values()).filter((f) => f < limite45).length;
  if (perdidos >= 5) opciones.push(`${perdidos} clientes que compraron en los últimos 4 meses llevan más de 45 días sin volver. Si recuperas a 1 de cada 4 con tu ticket promedio (${clp(ticket)}), son unos ${clp(Math.floor(perdidos / 4) * ticket)}. Se hace en Retención, con un cupón y un correo.`);

  // 4) Servicios que mas aportan.
  if (ingresoPorServicio.size) {
    const ids = Array.from(ingresoPorServicio.keys());
    const { data: sv } = await supabase.from("services").select("id, name").eq("tenant_id", tenantId).in("id", ids);
    const nombre = new Map<string, string>((sv || []).map((x: any) => [x.id, String(x.name).trim()]));
    const totalServ = Array.from(ingresoPorServicio.values()).reduce((a, b) => a + b, 0) || 1;
    const top = Array.from(ingresoPorServicio.entries()).filter(([id]) => nombre.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length) opciones.push(`Tus servicios que más aportan: ${top.map(([id, v]) => `${nombre.get(id)} (${Math.round((v / totalServ) * 100)}% de lo vendido en servicios)`).join(", ")}. Ofrece el combo más rentable (por ejemplo, corte + barba) a quien pide solo corte.`);
  }

  const cab = `Esto es lo que veo en tus ventas de los últimos 60 días: ${clp(totAct)} en ${act.length} ventas, ticket promedio ${clp(ticket)}${variacion !== null ? `, ${variacion >= 0 ? "+" : ""}${variacion}% respecto a los 60 días anteriores (${clp(totPrev)})` : ""}.`;
  if (!opciones.length) return `${cab}\nNo veo una brecha clara en días u horas; sigue cuidando la retención de tus clientes.`;
  return `${cab}\nOpciones concretas para vender más:\n${opciones.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
}
