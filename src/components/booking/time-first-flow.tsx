"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// "Vista por horario": el cliente elige servicio(s), luego día y hora (de todo el equipo)
// y al final el profesional disponible en esa hora.
interface Svc { id: string; name: string; description: string | null; price: number; duration: number; category?: string | null }
interface BarberOpt { id: string; name: string; avatar_url: string | null; services: Svc[]; duration: number; price: number }
export interface TimePick { barber: BarberOpt; services: Svc[]; date: string; slot: string; auto?: boolean }

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const pad = (n: number) => String(n).padStart(2, "0");
const ds = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (slot: string) => slot.slice(11, 16);

// Nombre de una sección de servicios para mostrarlo: sin el punto final que a veces queda al escribirlo ("Salón." -> "Salón").
const nombreCategoria = (c: string | null | undefined) => (String(c || "").trim().replace(/[.\s]+$/, "") || "Otros servicios");

// La sección general del negocio (la que usan todos los profesionales) se muestra como «Todos los profesionales»; las demás, con su nombre (Gabriel, Nicolás…).
const etiquetaCategoria = (c: string) => (/^(salon|salón|general|otros servicios)$/i.test(c.trim()) ? "Todos los profesionales" : c);

export default function TimeFirstFlow({ tenantSlug, closedWeekdays, windowDays, onPick, agruparPorCategoria = false, kiosko = false }: { tenantSlug: string; closedWeekdays: number[]; windowDays?: number | null; onPick: (p: TimePick) => void; agruparPorCategoria?: boolean; kiosko?: boolean }) {
  const [phase, setPhase] = useState<"services" | "time" | "pro">("services");
  const [services, setServices] = useState<Svc[]>([]);
  // Con agruparPorCategoria (tótem y su QR) el cliente elige primero la sección (ej. Nicolás, Gabriel, Salón) y luego los servicios de esa sección.
  const [categoria, setCategoria] = useState<string | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ slot: string; barberIds: string[] }[]>([]);
  const [barbers, setBarbers] = useState<Record<string, BarberOpt>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [chosen, setChosen] = useState<{ slot: string; barberIds: string[] } | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < (windowDays ?? 28); i++) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); out.push(d); }
    return out;
  }, [windowDays]);

  useEffect(() => {
    fetch(`/api/public/services?tenant=${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((d) => setServices(Array.isArray(d) ? d.map((s: any) => ({ ...s, price: Number(s.price) })) : []))
      .catch(() => setServices([]))
      .finally(() => setLoadingServices(false));
  }, [tenantSlug]);

  // Primer día abierto como selección inicial.
  useEffect(() => {
    if (date) return;
    const first = days.find((d) => !closedWeekdays.includes(d.getDay()));
    if (first) setDate(ds(first));
  }, [days, closedWeekdays, date]);

  useEffect(() => {
    if (phase !== "time" || !date || selected.length === 0) return;
    let cancelled = false;
    setLoadingSlots(true);
    fetch(`/api/public/slots-by-time?tenant=${encodeURIComponent(tenantSlug)}&date=${date}&serviceIds=${selected.join(",")}${kiosko ? "&kiosko=1" : ""}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setSlots(d.slots || []); setBarbers(d.barbers || {}); } })
      .catch(() => { if (!cancelled) { setSlots([]); setBarbers({}); } })
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => { cancelled = true; };
  }, [phase, date, selected, tenantSlug]);

  const chosenServices = services.filter((s) => selected.includes(s.id));
  const totalBase = chosenServices.reduce((n, s) => n + s.price, 0);
  const totalMin = chosenServices.reduce((n, s) => n + Number(s.duration), 0);

  const groups = [
    { label: "Mañana", items: slots.filter((s) => Number(s.slot.slice(11, 13)) < 12) },
    { label: "Tarde", items: slots.filter((s) => { const h = Number(s.slot.slice(11, 13)); return h >= 12 && h < 18; }) },
    { label: "Noche", items: slots.filter((s) => Number(s.slot.slice(11, 13)) >= 18) },
  ].filter((g) => g.items.length > 0);

  const pickBarber = (b: BarberOpt, slot: string, auto = false) => onPick({ barber: b, services: b.services, date, slot, auto });
  const [autoBusy, setAutoBusy] = useState(false);
  // "Primer profesional disponible": el negocio decide con su regla (Configuracion > Preferencias de reserva).
  const pickAuto = async (slot: string, ids: string[]) => {
    if (autoBusy) return;
    setAutoBusy(true);
    try {
      const r = await fetch(`/api/public/first-available?tenant=${encodeURIComponent(tenantSlug)}&date=${date}&slot=${encodeURIComponent(slot)}&candidates=${ids.join(",")}${kiosko ? "&kiosko=1" : ""}`);
      const d = await r.json();
      const id = d?.barber?.id && ids.includes(d.barber.id) ? d.barber.id : ids[0];
      const b = barbers[id];
      if (b) pickBarber(b, slot, true);
    } catch {
      const b = barbers[ids[0]];
      if (b) pickBarber(b, slot, true);
    } finally { setAutoBusy(false); }
  };

  const chooseSlot = (s: { slot: string; barberIds: string[] }) => {
    const opts = s.barberIds.map((id) => barbers[id]).filter(Boolean);
    if (opts.length === 1) return pickBarber(opts[0], s.slot);
    setChosen(s);
    setPhase("pro");
  };

  const scrollStrip = (dir: number) => strip.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  const monthsInRange = Array.from(new Set(days.map((d) => d.getMonth())));
  const selMonth = date ? Number(date.slice(5, 7)) - 1 : monthsInRange[0];

  // Secciones (categorías) de servicios, en el orden en que aparecen en la lista del negocio.
  const secciones = useMemo(() => {
    const orden: string[] = [];
    const cuenta = new Map<string, { n: number; desde: number }>();
    for (const s of services) {
      const k = nombreCategoria(s.category);
      if (!cuenta.has(k)) { orden.push(k); cuenta.set(k, { n: 0, desde: Infinity }); }
      const c = cuenta.get(k)!; c.n += 1; c.desde = Math.min(c.desde, s.price);
    }
    return orden.map((k) => ({ nombre: k, ...cuenta.get(k)! }));
  }, [services]);
  const usaSecciones = agruparPorCategoria && secciones.length > 1;
  // Vista normal «Por horario»: pestañas arriba (Todos los profesionales, Gabriel, Nicolás…) con los servicios de la sección elegida; no es una pantalla aparte.
  const usaPestanas = !agruparPorCategoria && secciones.length > 1;
  useEffect(() => { if (usaPestanas && categoria === null) setCategoria(secciones[0].nombre); }, [usaPestanas, categoria, secciones]);
  const serviciosVisibles = (usaSecciones || usaPestanas) && categoria ? services.filter((s) => nombreCategoria(s.category) === categoria) : services;
  // Elegir un servicio lleva directo a las horas (se puede sumar otro desde allí).
  const tocarServicio = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    if (!agruparPorCategoria && next.length > 0) setPhase("time"); // el tótem sigue eligiendo varios y pulsa «Continuar»
  };

  // ── Fase 0 (solo con secciones): elegir la sección ──
  if (phase === "services" && usaSecciones && categoria === null && !loadingServices) {
    return (
      <div className="pb-8">
        <h2 className="text-2xl font-bold mb-2">¿Qué estás buscando?</h2>
        <p className="text-brand-gray mb-6">Elige una sección para ver sus servicios</p>
        <div className="space-y-3">
          {secciones.map((c) => (
            <button key={c.nombre} onClick={() => { setSelected([]); setCategoria(c.nombre); }}
              className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:border-brand-blue/40 active:bg-gray-50">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{c.nombre}</p>
                  <p className="mt-0.5 text-xs text-brand-gray">{c.n} {c.n === 1 ? "servicio" : "servicios"} · desde {formatCurrency(c.desde)}</p>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-brand-gray" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Fase 1: servicios ──
  if (phase === "services") {
    return (
      <div className="pb-28">
        {usaSecciones && categoria && (
          <button onClick={() => { setSelected([]); setCategoria(null); }} className="mb-4 flex items-center gap-1 text-sm text-brand-gray hover:text-brand-blue"><ChevronLeft className="h-4 w-4" /> Secciones</button>
        )}
        <h2 className="text-lg font-bold mb-2">{usaSecciones && categoria ? categoria : "¿Qué servicio necesitas?"}</h2>
        {usaPestanas && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Secciones de servicios">
            {secciones.map((c) => {
              const on = categoria === c.nombre;
              return (
                <button key={c.nombre} role="tab" aria-selected={on} onClick={() => setCategoria(c.nombre)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${on ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 text-brand-gray hover:border-brand-blue/50"}`}>
                  {etiquetaCategoria(c.nombre)}
                </button>
              );
            })}
          </div>
        )}
        {loadingServices ? <p className="text-sm text-brand-gray">Cargando…</p> : services.length === 0 ? (
          <p className="text-sm text-brand-gray">Este negocio aún no tiene servicios disponibles.</p>
        ) : (
          <div className="space-y-1.5">
            {serviciosVisibles.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button key={s.id} onClick={() => tocarServicio(s.id)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition ${on ? "border-brand-blue bg-brand-blue/5 ring-2 ring-brand-blue/15" : "border-gray-200 bg-white hover:border-brand-blue/40"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      <p className="flex items-center gap-1 text-[11px] text-brand-gray"><Clock className="h-3 w-3" /> {s.duration} min</p>
                    </div>
                    <p className="flex-shrink-0 text-sm font-bold">{formatCurrency(s.price)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selected.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-100 bg-white/95 p-4 backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
              <div className="text-sm"><p className="font-bold">{formatCurrency(totalBase)}</p><p className="text-xs text-brand-gray">{selected.length} servicio(s) · {totalMin} min</p></div>
              <button onClick={() => setPhase("time")} className="shrink-0 rounded-xl bg-brand-blue px-8 py-3 font-bold text-white hover:brightness-110">{agruparPorCategoria ? "Continuar" : "Ver horas"}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Fase 3: elegir profesional para esa hora ──
  if (phase === "pro" && chosen) {
    return (
      <div>
        <button onClick={() => setPhase("time")} className="mb-4 flex items-center gap-1 text-sm text-brand-gray hover:text-brand-blue">← Volver</button>
        <h2 className="text-2xl font-bold mb-1">Elige tu profesional</h2>
        <p className="text-brand-gray mb-6">Disponibles a las {hhmm(chosen.slot)}</p>
        <div className="space-y-3">
          {chosen.barberIds.length > 1 && (
            <button onClick={() => pickAuto(chosen.slot, chosen.barberIds)} disabled={autoBusy}
              className="w-full rounded-2xl border-2 border-brand-blue bg-brand-blue/10 p-4 text-center transition hover:bg-brand-blue/20 disabled:opacity-60">
              <p className="font-bold text-brand-blue">{autoBusy ? "Asignando…" : "Primer profesional disponible"}</p>
              <p className="text-xs text-brand-gray">Te asignamos a quien esté libre a esa hora</p>
            </button>
          )}
          {chosen.barberIds.map((id) => barbers[id]).filter(Boolean).map((b) => (
            <button key={b.id} onClick={() => pickBarber(b, chosen.slot)}
              className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-brand-blue hover:shadow-md">
              {b.avatar_url ? <img src={b.avatar_url} alt={b.name} className="h-14 w-14 rounded-full object-cover" /> : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 font-bold text-brand-gray">{b.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
              )}
              <div className="min-w-0 flex-1"><p className="font-semibold">{b.name}</p><p className="text-xs text-brand-gray">{b.duration} min</p></div>
              <p className="font-bold">{formatCurrency(b.price)}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Fase 2: día y hora ──
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button onClick={() => setPhase("services")} className="flex items-center gap-1 text-sm text-brand-gray hover:text-brand-blue">← Cambiar servicio</button>
        <button onClick={() => setPhase("services")} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-brand-gray hover:border-brand-blue/50">+ Agregar otro</button>
      </div>
      <h2 className="text-lg font-bold mb-0.5">Elige fecha y hora</h2>
      <p className="mb-3 text-xs text-brand-gray">{chosenServices.map((s) => s.name).join(" + ")} · {totalMin} min · {formatCurrency(totalBase)}</p>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-4">
          {monthsInRange.map((m) => (
            <button key={m} onClick={() => { const d = days.find((x) => x.getMonth() === m && !closedWeekdays.includes(x.getDay())); if (d) setDate(ds(d)); }}
              className={`text-lg font-bold ${m === selMonth ? "text-brand-dark" : "text-gray-300"}`}>{MONTHS[m]}</button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => scrollStrip(-1)} aria-label="Anterior" className="rounded-lg p-1.5 text-brand-gray hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => scrollStrip(1)} aria-label="Siguiente" className="rounded-lg p-1.5 text-brand-gray hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      <div ref={strip} className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
        {days.map((d) => {
          const v = ds(d); const closed = closedWeekdays.includes(d.getDay()); const on = v === date;
          return (
            <button key={v} disabled={closed} onClick={() => setDate(v)}
              className={`flex w-14 flex-shrink-0 flex-col items-center rounded-full px-1 py-2.5 text-sm transition ${on ? "bg-brand-blue text-white shadow" : closed ? "text-gray-300" : "text-brand-dark hover:bg-gray-100"}`}>
              <span className="text-xs">{WD[d.getDay()]}</span>
              <span className="mt-1 text-base font-bold">{pad(d.getDate())}</span>
            </button>
          );
        })}
      </div>

      {loadingSlots ? <p className="text-sm text-brand-gray">Buscando horas…</p> : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-sm text-brand-gray">No hay horas disponibles este día. Prueba con otra fecha.</div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-2 flex items-center gap-3"><p className="text-sm font-semibold">{g.label}</p><div className="h-px flex-1 bg-gray-200" /></div>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {g.items.map((s) => (
                  <button key={s.slot} onClick={() => chooseSlot(s)}
                    className="rounded-xl border border-gray-200 py-3 text-sm font-medium text-brand-dark transition-colors hover:border-brand-blue hover:text-brand-blue">
                    {hhmm(s.slot)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-brand-gray">⚠️ Las horas disponibles podrían agotarse, ¡agenda lo antes posible!</p>
        </div>
      )}
    </div>
  );
}
