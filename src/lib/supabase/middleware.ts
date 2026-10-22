import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasFreshSessionToken } from "@/lib/supabase/token-fresh";

export async function updateSession(request: NextRequest) {
  // Navegar dentro del panel con la sesion vigente (le quedan mas de 5 min): no se le pregunta a Supabase en cada clic
  // (costaba ~0,3-0,4 s por pestana). Si el token vence pronto o la cookie no se entiende, sigue la validacion completa de
  // abajo, que ademas lo refresca. /login queda SIEMPRE con la validacion completa para no crear un bucle de redirecciones si
  // la sesion fue revocada. Esto solo afecta a la carcasa de /dashboard: los datos salen de /api (que valida por su cuenta) y el
  // layout vuelve a validar en cada carga completa. Para volver al comportamiento anterior basta borrar este bloque.
  if (request.nextUrl.pathname.startsWith("/dashboard") && hasFreshSessionToken(request.cookies)) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // IMPORTANT: use getUser() here, NOT getSession().
  // getUser() validates the token against Supabase Auth and refreshes it when needed.
  // getSession() only reads the local cookie and cannot refresh — in a PWA / on token
  // refresh it can intermittently report "no session" for a logged-in user, causing the
  // middleware to bounce /dashboard -> /login -> /dashboard (ERR_TOO_MANY_REDIRECTS).
  // Calling getUser() also refreshes the auth cookie on the response, keeping sessions alive.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthed = !!user;

  // Redirect to login if not authenticated and trying to access dashboard
  if (!isAuthed && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if authenticated and on login page
  if (isAuthed && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
