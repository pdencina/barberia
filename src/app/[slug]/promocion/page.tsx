"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { horasDePromo } from "@/lib/promo-link";
import { PromoCabecera } from "@/components/promo/promo-cabecera";

// re-booking.cl/<negocio>/promocion — reserva con los criterios de la promoción ya puestos: solo sus profesionales, días y horas.

interface Pro { id: string; nombre: string; foto: string | null }
interface Servicio { id: string; name: string; price: number; duration: number }
interface Datos {
  negocio: { id: string; nombre: string; slug: string; logo: string | null };
  promo: null | { codigo: string; descripcion: string | null; tipo: string; valor: number; titulo: string | null; imagen: string | null; horaDesde: string | null; horaHasta: string | null; dias: string[]; detalles: Array<{ etiqueta: string; valor: string }>; profesionales: Pro[] };
  motivo?: string;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fechaCorta = (d: string) => {
  const f = new Date(`${d}T12:00:00Z`);
  const p = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", ...o }).format(f).replace(".", "");
  return { dia: p({ weekday: "short" }), num: p({ day: "numeric" }), mes: p({ month: "short" }), largo: p({ weekday: "long", day: "numeric", month: "long" }) };
};

export default function PromocionPage() {
  const params = useParams();
  const slug = String(params.slug || "");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [servicios, setServicios] = useState<Record<string, Servicio[]>>({});
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [dia, setDia] = useState("");
  const [horas, setHoras] = useState<Record<string, string[]>>({});
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [turno, setTurno] = useState<{ pro: Pro; slot: string } | null>(null);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [celular, setCelular] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<{ total: number; descuento: number } | null>(null);
  const [recarga, setRecarga] = useState(0);

  const normal = `/${encodeURIComponent(slug)}?normal=1`;

  useEffect(() => {
    const cupon = new URLSearchParams(window.location.search).get("cupon") || "";
    fetch(`/api/public/promo?negocio=${encodeURIComponent(slug)}${cupon ? `&cupon=${encodeURIComponent(cupon)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setDatos(d);
        if (d.promo) {
          setDia(d.promo.dias[0]);
          // Si el negocio pide abono para reservar, se usa la reserva normal (que cobra el abono).
          fetch(`/api/settings/deposit?tenantId=${d.negocio.id}`).then((r) => r.json()).then((a) => { if (a?.deposit_enabled && a?.deposit_ready !== false) window.location.replace(`/${slug}?normal=1&cupon=${encodeURIComponent(d.promo.codigo)}`); }).catch(() => {});
          for (const p of d.promo.profesionales as Pro[]) {
            fetch(`/api/public/barber-services?barberId=${p.id}`).then((r) => r.json()).then((s) => { if (Array.isArray(s)) setServicios((x) => ({ ...x, [p.id]: s })); }).catch(() => {});
          }
        }
      })
      .catch(() => setError("No pudimos cargar la promoción. Revisa tu conexión."));
  }, [slug]);

  const promo = datos?.promo || null;
  // Lista de servicios: la unión de los que hacen los profesionales de la promoción (con el menor precio como referencia).
  const catalogo = useMemo(() => {
    const m = new Map<string, Servicio>();
    for (const l of Object.values(servicios)) for (const s of l) { const y = m.get(s.id); if (!y || s.price < y.price) m.set(s.id, s); }
    return Array.from(m.values());
  }, [servicios]);
  const conDescuento = (n: number) => (!promo || promo.valor <= 0 ? n : promo.tipo === "percentage" ? n - Math.round((n * promo.valor) / 100) : Math.max(0, n - promo.valor));
  // Lo que cobra cada profesional por lo elegido (null = no hace alguno de esos servicios).
  const deProfesional = (id: string) => {
    const l = elegidos.map((x) => servicios[id]?.find((s) => s.id === x));
    return l.every(Boolean) && l.length ? { total: l.reduce((n, s) => n + s!.price, 0), minutos: l.reduce((n, s) => n + s!.duration, 0) } : null;
  };

  const clave = `${dia}|${elegidos.join(",")}|${Object.keys(servicios).length}|${recarga}`;
  useEffect(() => {
    if (!promo || !dia || !elegidos.length) { setHoras({}); return; }
    let vigente = true;
    setCargandoHoras(true); setTurno(null);
    Promise.all(promo.profesionales.map(async (p) => {
      const x = deProfesional(p.id);
      if (!x) return [p.id, []] as const;
      const d = await fetch(`/api/public/availability?barberId=${p.id}&date=${dia}&duration=${Math.max(5, x.minutos)}`).then((r) => r.json()).catch(() => ({}));
      return [p.id, horasDePromo(d.slots || [], promo.horaDesde, promo.horaHasta)] as const;
    })).then((l) => { if (vigente) { setHoras(Object.fromEntries(l)); setCargandoHoras(false); } });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const precio = turno ? deProfesional(turno.pro.id)?.total || 0 : 0;
  const completo = nombre.trim() && /^\S+@\S+\.\S+$/.test(correo.trim()) && celular.replace(/\D/g, "").length >= 8;

  const reservar = async () => {
    if (!promo || !turno || !completo) return;
    setEnviando(true); setError("");
    try {
      const res = await fetch("/api/public/book", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: elegidos, barberId: turno.pro.id, date: dia, startTime: turno.slot, clientName: nombre.trim(), clientEmail: correo.trim(), clientPhone: celular.trim(), marketingConsent: acepta, couponCode: promo.codigo }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No pudimos confirmar. Intenta de nuevo."); if (res.status === 409) setRecarga((k) => k + 1); return; }
      setListo({ total: precio, descuento: d.promo?.discount || 0 });
      window.scrollTo({ top: 0 });
    } catch { setError("Se cortó la conexión. Intenta de nuevo."); }
    finally { setEnviando(false); }
  };

  const titulo = "text-[11px] font-light italic uppercase tracking-[0.32em] text-white/60";
  const campo = "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:border-white focus:outline-none";
  const chip = (on: boolean) => `rounded-xl border px-3 py-2 text-sm font-bold transition ${on ? "border-white bg-white text-black" : "border-white/20 bg-white/5 text-white hover:border-white/60"}`;

  return (
    <main className="min-h-screen bg-black text-white" style={{ fontFamily: "Montserrat, -apple-system, Roboto, sans-serif", colorScheme: "dark" }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,500;0,700;0,800;1,300;1,800&display=swap" rel="stylesheet" />
      <div className="mx-auto min-h-screen max-w-xl px-4 pb-16 pt-6" style={{ backgroundImage: "url('/correo/fondo-oscuro.png')", backgroundSize: "100% auto", backgroundRepeat: "repeat-y" }}>
        {datos?.negocio.logo && <img src={datos.negocio.logo} alt={datos.negocio.nombre} className="mx-auto mb-5 h-14 w-auto max-w-[220px] object-contain" />}
        {!datos && !error && <p className="py-20 text-center text-sm text-white/60">Cargando promoción…</p>}
        {!datos && error && <p className="py-20 text-center text-sm text-white/70">{error}</p>}

        {datos && !promo && (
          <div className="py-16 text-center">
            <p className="text-lg font-extrabold uppercase">{datos.motivo}</p>
            <a href={normal} className="mt-6 inline-block rounded-full bg-white px-8 py-3 text-sm font-extrabold uppercase italic text-black">Reservar sin promoción</a>
          </div>
        )}

        {promo && listo && turno && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black"><Check className="h-7 w-7" strokeWidth={3} /></span>
            <h1 className="text-2xl font-extrabold uppercase">¡Reserva confirmada!</h1>
            <p className="mt-3 font-light text-white/80"><b className="font-bold text-white">{fechaCorta(dia).largo}</b> a las <b className="font-bold text-white">{turno.slot.slice(11, 16)}</b><br />con <b className="font-bold text-white">{turno.pro.nombre}</b></p>
            {listo.descuento > 0 && <p className="mt-4 text-white/60 line-through">{pesos(listo.total)}</p>}
            <p className="text-3xl font-extrabold">{pesos(listo.total - listo.descuento)}</p>
            <p className={`mt-1 ${titulo}`}>Pagas en el local · cupón {promo.codigo}</p>
            {promo.detalles.filter((x) => x.etiqueta.startsWith("Pago")).map((x) => <p key={x.etiqueta} className="mt-3 text-sm font-bold">{x.etiqueta}: {x.valor}</p>)}
            <p className="mt-4 text-sm font-light text-white/60">Te enviamos los datos a {correo}.</p>
          </div>
        )}

        {promo && !listo && (
          <div className="space-y-7">
            <PromoCabecera imagen={promo.imagen} titulo={promo.titulo || (promo.tipo === "percentage" && promo.valor ? `${promo.valor}% de descuento` : "Promoción")} descripcion={promo.descripcion} detalles={promo.detalles} codigo={promo.codigo} />

            <section>
              <h2 className={`mb-2 ${titulo}`}>1 · Elige tu servicio</h2>
              {!catalogo.length && <p className="text-sm text-white/50">Cargando servicios…</p>}
              <div className="space-y-2">
                {catalogo.map((s) => {
                  const on = elegidos.includes(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => setElegidos((l) => (on ? l.filter((x) => x !== s.id) : [...l, s.id]))}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${on ? "border-white bg-white text-black" : "border-white/15 bg-white/5"}`}>
                      <span className="min-w-0"><span className="block text-sm font-bold">{s.name}</span><span className={`text-xs font-light ${on ? "text-black/60" : "text-white/55"}`}>{s.duration} min</span></span>
                      <span className="flex-shrink-0 text-right"><span className={`block text-xs line-through ${on ? "text-black/45" : "text-white/40"}`}>{conDescuento(s.price) < s.price ? pesos(s.price) : ""}</span><span className="text-base font-extrabold">{pesos(conDescuento(s.price))}</span></span>
                    </button>
                  );
                })}
              </div>
            </section>

            {elegidos.length > 0 && (
              <section>
                <h2 className={`mb-2 ${titulo}`}>2 · Elige día y hora</h2>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {promo.dias.map((d) => { const f = fechaCorta(d); return (
                    <button key={d} type="button" aria-pressed={dia === d} onClick={() => setDia(d)} className={`${chip(dia === d)} min-w-[4.5rem] flex-shrink-0 text-center`}>
                      <span className="block text-[10px] font-light uppercase">{f.dia}</span><span className="block text-xl leading-tight">{f.num}</span><span className="block text-[10px] font-light uppercase">{f.mes}</span>
                    </button>); })}
                </div>
                <div className="mt-3 space-y-3">
                  {cargandoHoras && <p className="text-sm text-white/50">Buscando horas…</p>}
                  {!cargandoHoras && promo.profesionales.every((p) => !(horas[p.id] || []).length) && <p className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70">No quedan horas de la promoción ese día. Prueba otro.</p>}
                  {!cargandoHoras && promo.profesionales.filter((p) => (horas[p.id] || []).length > 0).map((p) => (
                    <div key={p.id} className="rounded-2xl border border-white/15 bg-white/5 p-3">
                      <div className="mb-2 flex items-center gap-2.5">
                        {p.foto ? <img src={p.foto} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 font-bold">{p.nombre.charAt(0)}</span>}
                        <span className="text-sm font-bold">{p.nombre}</span>
                        <span className="ml-auto text-sm font-extrabold">{pesos(conDescuento(deProfesional(p.id)?.total || 0))}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {(horas[p.id] || []).map((h) => <button key={h} type="button" onClick={() => { setTurno({ pro: p, slot: h }); setError(""); setTimeout(() => document.getElementById("tus-datos")?.scrollIntoView({ behavior: "smooth" }), 50); }} className={chip(turno?.slot === h && turno?.pro.id === p.id)}>{h.slice(11, 16)}</button>)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {turno && (
              <section id="tus-datos" className="space-y-3">
                <h2 className={titulo}>3 · Tus datos</h2>
                <p className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-light"><b className="font-bold">{fechaCorta(dia).largo}, {turno.slot.slice(11, 16)}</b> con <b className="font-bold">{turno.pro.nombre}</b> · <b className="font-extrabold">{pesos(conDescuento(precio))}</b></p>
                <input className={campo} placeholder="Nombre y apellido" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                <input className={campo} type="email" placeholder="Correo" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
                <input className={campo} type="tel" placeholder="Celular (WhatsApp)" autoComplete="tel" value={celular} onChange={(e) => setCelular(e.target.value)} />
                <label className="flex items-start gap-2 text-xs font-light text-white/65"><input type="checkbox" className="mt-0.5" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} /> Quiero recibir promociones y novedades (opcional).</label>
                <p className="text-xs font-light text-white/45">Usamos tus datos para gestionar tu cita. <a href="/privacidad/clientes" target="_blank" rel="noopener noreferrer" className="underline">Aviso de privacidad</a></p>
                {error && <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>}
                <button type="button" onClick={reservar} disabled={!completo || enviando} className="w-full rounded-full bg-white py-4 text-base font-extrabold uppercase italic text-black disabled:opacity-40">{enviando ? "Confirmando…" : "Confirmar reserva"}</button>
              </section>
            )}

            <p className="text-center"><a href={normal} className="inline-flex items-center gap-1 text-xs font-light text-white/50 underline"><ChevronLeft className="h-3 w-3" /> Reservar sin promoción</a></p>
          </div>
        )}
      </div>
    </main>
  );
}
