import { NextRequest, NextResponse } from "next/server";
import { preciosDestino } from "@/lib/precios-link";

// re-booking.cl/precios -> planes de la landing, con el origen "creador de contenido" ya marcado.
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL(preciosDestino(req.nextUrl.searchParams), req.url), 307);
}
