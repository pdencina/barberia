"use client";
import { CalendarOff, X } from "lucide-react";
export function BlockedSlot({ start, end, allDay, reason, onRemove }: { start?: string | null; end?: string | null; allDay?: boolean; reason?: string | null; onRemove: () => void }) {
  const description = reason?.trim();
  const usefulReason = description && !/^(bloqueo|bloqueado|sin motivo)$/i.test(description);
  return <div className="flex items-center gap-2 rounded-xl border border-brand-blue/10 bg-brand-blue/5 px-3 py-1.5 text-brand-gray">
    <CalendarOff className="h-3.5 w-3.5 shrink-0 text-brand-blue"/>
    <p className="min-w-0 flex-1 text-[11px]"><span className="font-semibold text-brand-blue">{allDay ? "Día bloqueado" : `Bloqueado ${start?.slice(0,5)}–${end?.slice(0,5)}`}</span>{usefulReason && <span> · {description}</span>}</p>
    <button onClick={onRemove} aria-label="Quitar bloqueo" title="Quitar bloqueo" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-brand-blue hover:bg-brand-blue/10"><X className="h-3.5 w-3.5"/></button>
  </div>;
}
