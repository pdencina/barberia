// «Viendo como»: cuando el super admin entra a un negocio (Empresas › Entrar), cada llamada a la API manda el id de ese negocio en un
// encabezado. El servidor solo lo respeta si quien llama es super admin (getCallerForView). Así las pantallas que leen «el negocio de la
// sesión» muestran los datos del negocio que se está revisando en vez de responder «No autorizado».
let instalado = false;
export function instalarVerComo() {
  if (instalado || typeof window === "undefined") return;
  instalado = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : (input as Request).url;
      if (url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`)) {
        const raw = localStorage.getItem("tenant_override");
        const id = raw ? JSON.parse(raw)?.tenantId : null;
        if (id) {
          const h = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          if (!h.has("x-tenant-id")) h.set("x-tenant-id", String(id));
          return original(input, { ...init, headers: h });
        }
      }
    } catch { /* ante cualquier problema, la llamada sale como siempre */ }
    return original(input, init);
  };
}
