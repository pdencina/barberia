"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, CalendarOff, Bell } from "lucide-react";

interface Props {
  name: string; date: string; onDateChange: (date: string) => void; onChangeDay: (delta: number) => void;
  barbers: Array<{ id: string; name: string }>; selectedBarber: string; onBarberChange: (id: string) => void;
  canSelectProfessional: boolean; onBlock: () => void; notifications: ReactNode;
}
export function AgendaHeader(p: Props) {
  const today = p.date === new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <header className="space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0"><h1 className="text-base sm:text-lg font-extrabold leading-tight tracking-tight text-brand-dark">Hola{p.name ? `, ${p.name.split(" ")[0]}` : ""}<span className="text-brand-blue">.</span></h1><p className="text-[10px] sm:text-xs leading-tight text-brand-gray">{today ? "Esta es tu proyección de hoy." : "Tu proyección para este día."}</p></div>
      <div className="flex shrink-0 items-center gap-1">
        <details className="relative"><summary aria-label="Notificaciones" title="Notificaciones" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-brand-blue hover:bg-brand-blue/5 [&::-webkit-details-marker]:hidden"><Bell className="h-4 w-4" /></summary><div className="absolute right-0 top-9 z-20 w-60 rounded-xl border bg-white p-3 shadow-lg dark:bg-brand-white">{p.notifications}</div></details>
        <button aria-label="Bloquear día" title="Bloquear día" onClick={p.onBlock} className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-blue hover:bg-brand-blue/5"><CalendarOff className="h-4 w-4" /></button>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {p.canSelectProfessional && p.barbers.length > 1 && <select aria-label="Profesional" value={p.selectedBarber} onChange={e => p.onBarberChange(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-brand-blue/10 bg-white px-2 text-[11px] font-semibold text-brand-dark dark:bg-brand-white">{p.barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
      <div className="flex h-8 items-center gap-1 rounded-lg bg-brand-blue/5">
        <button aria-label="Día anterior" onClick={() => p.onChangeDay(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-blue hover:bg-brand-blue/10"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <div className="relative flex items-center justify-center gap-1"><CalendarDays className="h-3 w-3 text-brand-blue"/><span className="whitespace-nowrap text-[11px] font-semibold capitalize text-brand-dark">{new Date(p.date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}</span><input type="date" aria-label="Elegir fecha" value={p.date} onChange={e => { if (e.target.value) p.onDateChange(e.target.value); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/></div>
        <button aria-label="Día siguiente" onClick={() => p.onChangeDay(1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-blue hover:bg-brand-blue/10"><ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  </header>;
}
