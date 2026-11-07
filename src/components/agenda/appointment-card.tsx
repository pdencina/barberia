"use client";
import type { ReactNode } from "react";
import { CalendarDays, UserPlus } from "lucide-react";
const labels: Record<string, string> = { scheduled: "Agendada", confirmed: "Confirmada", in_progress: "En atención", completed: "Completada" };
export function AppointmentCard({ id, start, end, name, phone, services, status, isNew, current, children }: {
  id: string; start: string; end: string; name: string; phone?: string | null; services: string;
  status: string; isNew?: boolean | null; current?: boolean; children: ReactNode;
}) {
  return <article id={`agenda-${id}`} className={`scroll-mt-20 lg:scroll-mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-brand-white ${current ? "border-brand-blue/40 ring-2 ring-brand-blue/10" : "border-brand-blue/10"}`}>
    <div className={`flex items-center justify-between gap-2 px-3 py-2 ${current ? "bg-brand-blue text-white" : "bg-brand-blue/5 text-brand-blue"}`}>
      <div className="flex items-baseline gap-1.5"><span className="text-base font-extrabold tracking-tight">{start}</span><span className={`text-[11px] ${current ? "text-white/75" : "text-brand-gray"}`}>— {end}</span>{current && <span className="ml-1 text-[9px] font-bold uppercase tracking-wide">Ahora / próxima</span>}</div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${current ? "bg-white/20 text-white" : status === "completed" ? "bg-brand-blue/10 text-brand-blue" : "bg-white text-brand-gray dark:bg-brand-white"}`}>{labels[status] || status}</span>
    </div>
    <div className="p-3 pt-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h2 className="text-sm font-bold text-brand-dark">{name}</h2>{isNew === true && <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/10 px-2 py-0.5 text-[9px] font-bold text-brand-blue"><UserPlus className="h-3 w-3"/>Cliente nuevo</span>}</div>
      {phone && <a href={`tel:${phone}`} className="text-[11px] text-brand-gray hover:text-brand-blue">{phone}</a>}
      <p className="mt-1 flex items-center gap-1 text-xs text-brand-gray"><CalendarDays className="h-3 w-3 shrink-0"/>{services}</p>
      {children}
    </div>
  </article>;
}
