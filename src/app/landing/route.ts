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
    // Plan CTAs (Basic/Starter/Pro) → self-serve subscription flow. The click handler below
    // reads the card's data-checkout (plan, seats, cycle) so the choice pre-fills /suscribirse.
    // Enterprise is not self-serve and keeps the sales WhatsApp.
    .replaceAll('<a href="#" data-ripple=""', '<a href="/suscribirse" data-subscribe="" data-ripple=""')
    .replaceAll('<a href="/suscribirse" data-subscribe="" data-ripple="" style="display: block; text-align: center; font-family: \'Bricolage Grotesque\', Georgia, sans-serif; font-size: 15px; font-weight: 600; margin-top: 18px; padding: 13px 20px; border-radius: 12px; position: relative; overflow: hidden; background: #fff; color: #14403E; border: 1px solid #DFD8CE; transition: transform .16s ease, background .16s ease, border-color .16s ease;" style-hover="border-color:#0A6E6B;transform:translateY(-2px)" style-active="transform:translateY(0)">Elegir Enterprise', '<a href="#" data-ripple="" style="display: block; text-align: center; font-family: \'Bricolage Grotesque\', Georgia, sans-serif; font-size: 15px; font-weight: 600; margin-top: 18px; padding: 13px 20px; border-radius: 12px; position: relative; overflow: hidden; background: #fff; color: #14403E; border: 1px solid #DFD8CE; transition: transform .16s ease, background .16s ease, border-color .16s ease;" style-hover="border-color:#0A6E6B;transform:translateY(-2px)" style-active="transform:translateY(0)">Elegir Enterprise')
    // Every remaining placeholder CTA (Comenzar ahora, Elegir plan, final CTA) → sales WhatsApp.
    .replaceAll('href="#"', waHref);

  // Build /suscribirse?plan=&seats=&cycle= from the plan card at click time.
  const subscribeScript = `<script>
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[data-subscribe]');
  if (!a) return;
  var card = a.closest('[data-plan]');
  try {
    var c = JSON.parse(card.getAttribute('data-checkout') || '{}');
    if (c.plan) {
      a.setAttribute('href', '/suscribirse?plan=' + encodeURIComponent(c.plan) + '&seats=' + (c.seats || 1) + '&cycle=' + (c.cycle || 'mensual'));
    }
  } catch (_) {}
}, true);
</script>`;
  html = html.includes("</body>") ? html.replace("</body>", subscribeScript + "</body>") : html + subscribeScript;

  // Píxel de Meta: solo si NEXT_PUBLIC_META_PIXEL_ID tiene un número. Sin él, la landing queda exactamente igual que antes.
  const pixelId = (process.env.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
  if (/^\d{8,20}$/.test(pixelId)) {
    const pixelScript = `<script>
(function () {
  var ID = '${pixelId}', KEY = 'rb_meta_consent', AK = 'rb_mkt_attr';
  function g(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  // De qué anuncio vino (utm_* / fbclid): se guarda siempre, sin datos personales; /suscribirse lo lee al pagar.
  var q = new URLSearchParams(location.search), a = {}, any = false;
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','fbclid'].forEach(function (k) { var v = q.get(k); if (v) { a[k] = v.slice(0, 200); any = true; } });
  if (any) { a.landing = '/landing'; s(AK, JSON.stringify(a)); }
  function load() {
    if (window.fbq) return;
    var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
    if (!window._fbq) window._fbq = f; f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
    var t = document.createElement('script'); t.async = true; t.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(t);
    fbq('init', ID); fbq('track', 'PageView'); fbq('track', 'ViewContent', { content_name: 'Landing re-booking' });
  }
  // Clics: WhatsApp = Contact; botones de plan = Lead (interés). Solo cuentan si la persona aceptó las cookies.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a'); if (!el || g(KEY) !== 'granted' || !window.fbq) return;
    var h = el.getAttribute('href') || '';
    if (h.indexOf('wa.me') > -1) fbq('track', 'Contact');
    else if (el.hasAttribute('data-subscribe')) fbq('track', 'Lead', { content_name: 'Elegir plan' });
  }, true);
  function banner() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;max-width:440px;margin:0 auto;z-index:99999;background:#fff;border:1px solid #DFD8CE;border-radius:16px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);font:14px system-ui,sans-serif;color:#14403E';
    d.innerHTML = '<p style="margin:0 0 10px">Usamos cookies para medir qué anuncios te trajeron hasta aquí. No guardamos datos de salud. <a href="/privacidad" target="_blank" rel="noopener" style="color:#14403E;text-decoration:underline">Más información</a>.</p><div style="display:flex;gap:8px"><button data-n style="flex:1;height:40px;border-radius:12px;border:1px solid #ccc;background:#fff;font-weight:600;cursor:pointer">Rechazar</button><button data-y style="flex:1;height:40px;border-radius:12px;border:0;background:#0A6E6B;color:#fff;font-weight:600;cursor:pointer">Aceptar</button></div>';
    d.querySelector('[data-n]').onclick = function () { s(KEY, 'denied'); d.remove(); };
    d.querySelector('[data-y]').onclick = function () { s(KEY, 'granted'); d.remove(); load(); };
    document.body.appendChild(d);
  }
  var c = g(KEY);
  if (c === 'granted') load(); else if (c !== 'denied') banner();
})();
</script>`;
    html = html.includes("</body>") ? html.replace("</body>", pixelScript + "</body>") : html + pixelScript;
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
