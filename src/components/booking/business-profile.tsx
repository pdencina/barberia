"use client";

import { useEffect, useState } from "react";
import { Clock, Globe, MapPin, MessageCircle, Navigation, Phone, Star } from "lucide-react";

export interface BusinessHour { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }
export interface BusinessInfo {
  id?: string;
  meta_pixel_id?: string | null;
  name: string;
  logo_url?: string | null;
  banner_url?: string | null;
  description?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  google_maps_url?: string | null;
  google_rating?: number | null;
  google_reviews_count?: number | null;
  booking_window_days?: number | null;
  booking_view_mode?: "time" | "professional" | "both";
  booking_show_profile_direct?: boolean;
  hours?: BusinessHour[];
}

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const hhmm = (t?: string | null) => (t || "").slice(0, 5);

// "Abierto ahora" según la hora de Chile (los negocios son de Chile).
function openNow(hours: BusinessHour[] | undefined): boolean | null {
  if (!hours || hours.length === 0) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value || "");
    const now = `${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`;
    const today = hours.find((h) => h.day_of_week === wd);
    if (!today || today.is_closed || !today.open_time || !today.close_time) return false;
    return now >= hhmm(today.open_time) && now < hhmm(today.close_time);
  } catch { return null; }
}

export default function BusinessProfile({ info }: { info: BusinessInfo }) {
  const [showHours, setShowHours] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => { setOpen(openNow(info.hours)); }, [info.hours]);

  const mapsLink = info.google_maps_url || (info.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${info.name} ${info.address}`)}` : null);
  const wa = info.phone ? info.phone.replace(/\D/g, "") : "";
  const website = info.website ? (/^https?:\/\//i.test(info.website) ? info.website : `https://${info.website}`) : null;
  const hasRating = typeof info.google_rating === "number" && info.google_rating > 0;
  const long = (info.description || "").length > 220;
  const hasDetails = !!(info.address || website || wa || (info.hours && info.hours.length));

  // Compacto: banner bajo, logo chico, descripción en 2 líneas y los datos de contacto como una fila de botones pequeños (el horario se abre debajo).
  const chip = "inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-dark transition hover:border-brand-blue/50";
  return (
    <div className="mb-4 space-y-3">
      {info.banner_url && (
        <div className="overflow-hidden rounded-2xl bg-gray-100">
          <img src={info.banner_url} alt={info.name} className="h-24 w-full object-cover sm:h-32" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white p-1 sm:h-16 sm:w-16 ${info.banner_url ? "relative z-10 -mt-8 ml-1 ring-2 ring-brand-light" : ""}`}>
          {info.logo_url ? <img src={info.logo_url} alt={info.name} className="max-h-full max-w-full object-contain" /> : (
            <span className="text-base font-bold text-brand-blue">{info.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight sm:text-xl">{info.name}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {open !== null && (
              <span className="flex items-center gap-1.5 text-brand-gray">
                <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-gray-400"}`} />
                {open ? "Abierto ahora" : "Cerrado ahora"}
              </span>
            )}
            {hasRating && (
              <a href={info.google_maps_url || undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-semibold">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {info.google_rating!.toFixed(1)}
                {info.google_reviews_count ? <span className="font-normal text-brand-gray">({info.google_reviews_count})</span> : null}
              </a>
            )}
          </div>
          {info.address && <p className="mt-0.5 truncate text-xs text-brand-gray">{info.address}</p>}
        </div>
      </div>

      {info.description && (
        <div>
          <p className={`whitespace-pre-line text-xs leading-relaxed text-brand-gray sm:text-sm ${!readMore && long ? "line-clamp-2" : ""}`}>{info.description}</p>
          {long && <button onClick={() => setReadMore((v) => !v)} className="mt-0.5 text-xs font-semibold underline">{readMore ? "Leer menos" : "Leer más"}</button>}
        </div>
      )}

      {hasDetails && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {info.address && mapsLink && (
              <a href={mapsLink} target="_blank" rel="noopener noreferrer" className={chip}><Navigation className="h-3.5 w-3.5" /> Cómo llegar</a>
            )}
            {info.hours && info.hours.length > 0 && (
              <button type="button" onClick={() => setShowHours((v) => !v)} className={chip} aria-expanded={showHours}><Clock className="h-3.5 w-3.5" /> {showHours ? "Ocultar horario" : "Horario"}</button>
            )}
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className={chip}><Globe className="h-3.5 w-3.5" /> Sitio web</a>
            )}
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={chip}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
            )}
            {!wa && info.phone && <span className={chip}><Phone className="h-3.5 w-3.5" /> {info.phone}</span>}
          </div>
          {showHours && info.hours && (
            <ul className="space-y-0.5 rounded-xl border border-gray-100 bg-white p-3 text-xs text-brand-gray">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const h = info.hours!.find((x) => x.day_of_week === d);
                return (
                  <li key={d} className="flex justify-between gap-4">
                    <span>{DAYS[d]}</span>
                    <span className="tabular-nums">{!h || h.is_closed ? "Cerrado" : `${hhmm(h.open_time)} – ${hhmm(h.close_time)}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
