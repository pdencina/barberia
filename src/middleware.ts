import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Check for subdomain (e.g., estudiolevels.re-booking.cl)
  const mainDomains = ["re-booking.cl", "www.re-booking.cl", "localhost:3000", "localhost"];
  const isMainDomain = mainDomains.some((d) => hostname === d || hostname.endsWith("vercel.app"));

  if (!isMainDomain) {
    // Extract subdomain: "estudiolevels" from "estudiolevels.re-booking.cl"
    const subdomain = hostname.split(".")[0];

    if (subdomain && subdomain !== "www") {
      // Rewrite to booking page with tenant slug
      if (pathname === "/" || pathname === "/booking") {
        const url = request.nextUrl.clone();
        url.pathname = "/booking";
        url.searchParams.set("tenant", subdomain);
        return NextResponse.rewrite(url);
      }
    }
  }

  // Normal auth middleware for dashboard/login
  if (pathname.startsWith("/dashboard") || pathname === "/login") {
    return await updateSession(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|oti|logo|manifest|icon|api).*)"],
};
