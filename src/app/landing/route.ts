import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Serve the approved static marketing landing (Nico's delivery, with the Oti art) at
// /landing. We READ and RETURN the HTML directly instead of redirecting to
// /landing-nuevo/index.html — a redirect there was being swallowed by the dynamic
// /[slug]/[barber] route (it turned into /booking?tenant=landing-nuevo&prof=index.html).
//
// The delivered HTML uses relative asset paths (assets/... and ./support.js). Served
// from /landing those would resolve wrong, so we rewrite them to absolute
// /landing-nuevo/... paths where the files actually live in /public.
export const dynamic = "force-static";

export function GET() {
  const file = join(process.cwd(), "public", "landing-nuevo", "index.html");
  let html = readFileSync(file, "utf-8");

  // Sales WhatsApp for the plan / "Comenzar ahora" CTAs.
  const waMsg = encodeURIComponent("Hola! Me interesa re-booking para mi negocio.");
  const waHref = `href="https://wa.me/56933713153?text=${waMsg}" target="_blank" rel="noopener noreferrer"`;

  html = html
    .replaceAll('src="assets/', 'src="/landing-nuevo/assets/')
    .replaceAll('href="assets/', 'href="/landing-nuevo/assets/')
    .replaceAll("src='assets/", "src='/landing-nuevo/assets/")
    .replaceAll('src="./support.js"', 'src="/landing-nuevo/support.js"')
    .replaceAll('src="support.js"', 'src="/landing-nuevo/support.js"')
    // Footer links first (specific), so they don't get caught by the generic # rule.
    .replaceAll(
      '<a href="#" style="color: #5F6E6C;" style-hover="color:#0B9490">Iniciar sesión</a>',
      '<a href="/login" style="color: #5F6E6C;" style-hover="color:#0B9490">Iniciar sesión</a>'
    )
    .replaceAll(
      '<a href="#" style="color: #5F6E6C;" style-hover="color:#0B9490">Soporte</a>',
      `<a ${waHref} style="color: #5F6E6C;" style-hover="color:#0B9490">Soporte</a>`
    )
    // Every remaining placeholder CTA (Comenzar ahora, Elegir plan, final CTA) → sales WhatsApp.
    .replaceAll('href="#"', waHref);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
