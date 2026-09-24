import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Punto 1 (Nico, 2026-09-24): "today" was computed everywhere with
// `new Date().toISOString().split("T")[0]`. toISOString() always returns the date in
// UTC, no matter where the code runs (server or browser) — and Chile is UTC-3/-4, so
// that "today" flips to tomorrow's date ~3-4 hours before real midnight in Chile
// (reported as happening around 21:45). That's what made income, Dashboard stats,
// agenda and closes look like they changed days too early. Use these instead of raw
// Date/toISOString wherever "today" (or an offset from it) needs to reflect Chile's
// actual calendar day.

/**
 * Current calendar date (YYYY-MM-DD) as observed in Chile (America/Santiago), regardless
 * of the server's or browser's own timezone/locale.
 */
export function todayInChile(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

/**
 * Chile's "today" (see todayInChile) shifted by `days` (negative = past, positive =
 * future). Built on a UTC-noon anchor so adding/subtracting days never gets tripped up
 * by DST or local-timezone rollover.
 */
export function chileDateOffset(days: number): string {
  const [y, m, d] = todayInChile().split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().split("T")[0];
}

/**
 * UTC instant boundaries [startUtc, endUtc) for a Chile calendar day (YYYY-MM-DD), for
 * filtering timestamptz columns like `created_at`. Comparing created_at against naive
 * "YYYY-MM-DDT00:00:00"/"T23:59:59" strings (no offset) used Postgres' own session
 * timezone as the boundary, not Chile's midnight, so a transaction made late at night
 * could land in "the wrong day" in these queries even once todayInChile() is used to
 * pick the day itself. Computes Chile's real UTC offset for that date (handles any past
 * DST rule) instead of hardcoding -03:00/-04:00.
 */
export function chileDayBoundsUtc(dateStr: string): { startUtc: string; endUtc: string } {
  const approx = new Date(`${dateStr}T12:00:00Z`);
  const utcWall = new Date(approx.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const clWall = new Date(approx.toLocaleString("en-US", { timeZone: "America/Santiago" })).getTime();
  const offsetMs = clWall - utcWall; // negative for Chile (behind UTC)
  const startUtc = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() };
}
