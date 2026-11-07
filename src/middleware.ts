import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { liteBloqueaPagina, reglaQueBloquea } from "@/lib/plan-access";

// Rutas de API que un negocio suspendido SI puede usar: para pagar/reactivar, iniciar sesion,
// ver planes y los flujos publicos o de servidor a servidor (webhooks, cron, reservas de clientes).
const SUSPENDED_ALLOWED_API = [
  "/api/billing",
  "/api/checkout",
  "/api/plans",
  "/api/auth",
  "/api/cron",
  "/api/webhooks",
  "/api/mercadopago",
  "/api/public",
  "/api/booking",
  "/api/portal",
  "/api/cancel",
];

// Cache corta (por instancia) para no consultar la base en cada llamada.
const statusCache = new Map<string, { suspended: boolean; plan: string | null; staff: boolean; at: number }>();
const CACHE_MS = 15_000;

// Estado del negocio de quien llama: suspendido (nunca el super admin) y su plan, para bloquear en el servidor lo que el plan no incluye.
// Se usa getSession() (lee la cookie, sin red) porque solo sirve para DENEGAR: cada ruta de API
// sigue validando la sesion por su cuenta, asi que un token falso no gana nada aqui.
async function staffInfo(request: NextRequest): Promise<{ suspended: boolean; plan: string | null; staff: boolean }> {
  const ninguno = { suspended: false, plan: null as string | null, staff: false };
  // remove debe "borrar" de verdad (aqui, solo en memoria). Si la cookie es invalida (p. ej. JSON sin expires_at), auth-js la
  // borra, avisa SIGNED_OUT y realtime vuelve a llamar getSession(): si la cookie sigue ahi, el ciclo no termina nunca y deja
  // el proceso al 100% de CPU sin atender ninguna otra peticion.
  const removed = new Set<string>();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
    {
      cookies: {
        get: (name: string) => (removed.has(name) ? undefined : request.cookies.get(name)?.value),
        set() {},
        remove: (name: string) => {
          removed.add(name);
        },
      },
    }
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return ninguno;

  const cached = statusCache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_MS) return { suspended: cached.suspended, plan: cached.plan, staff: cached.staff };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return ninguno;

  try {
    const res = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=role,tenant:tenants(status,plan)`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    const esStaff = !!row && row.role !== "super_admin" && !!row.tenant;   // el super admin nunca se bloquea por plan
    const suspended = esStaff && row.tenant?.status === "suspended";
    const plan = esStaff ? ((row.tenant?.plan as string) ?? null) : null;
    statusCache.set(userId, { suspended, plan, staff: esStaff, at: Date.now() });
    return { suspended, plan, staff: esStaff };
  } catch {
    return ninguno; // ante un fallo de la consulta no se bloquea a nadie por error
  }
}

// Paginas publicas que la app movil no muestra (presentacion, registro de negocios, planes).
const APP_HIDDEN_PAGES = ["/", "/landing", "/signup", "/registro", "/suscribirse"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // App movil (Capacitor): arranca en el login. En la web de siempre no cambia nada.
  if (
    (request.headers.get("user-agent") || "").includes("RebookingApp") &&
    APP_HIDDEN_PAGES.includes(pathname)
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Bloqueo en el servidor: un negocio suspendido no puede usar la API (salvo lo necesario para pagar).
  if (pathname.startsWith("/api/")) {
    if (SUSPENDED_ALLOWED_API.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next();
    }
    const info = await staffInfo(request);
    if (info.suspended) {
      return NextResponse.json(
        { error: "Tu cuenta está suspendida por falta de pago. Regulariza tu suscripción para seguir usando re-booking.", code: "tenant_suspended" },
        { status: 402 }
      );
    }
    // Lo que el plan contratado no incluye tampoco se abre llamando a la API directamente.
    const regla = info.staff ? reglaQueBloquea(info.plan, pathname, "api") : null;
    if (regla) {
      return NextResponse.json(
        { error: `«${regla.nombre}» no está incluido en tu plan. Mejora tu plan para usarlo.`, code: "plan_required", plan_minimo: regla.min },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // Pantallas del Dashboard: lo que el plan no incluye no se abre ni escribiendo la dirección a mano.
  if (pathname.startsWith("/dashboard")) {
    const info = await staffInfo(request);
    if (info.staff) {
      if (liteBloqueaPagina(info.plan, pathname)) return NextResponse.redirect(new URL("/dashboard/calendario", request.url));
      if (reglaQueBloquea(info.plan, pathname, "pagina")) {
        const destino = new URL("/dashboard/configuracion/facturacion", request.url);
        destino.searchParams.set("mejorar", pathname);
        return NextResponse.redirect(destino);
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
  matcher: ["/", "/landing", "/signup", "/registro", "/suscribirse", "/dashboard/:path*", "/login", "/api/:path*"],
};
