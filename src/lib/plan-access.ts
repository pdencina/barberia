// Qué parte de re-booking incluye cada plan, aplicado en el SERVIDOR (middleware): ni el menú ni escribir la dirección a mano
// ni llamar a la API directamente abren algo que el plan contratado no incluye. Es lo mismo que prometen el landing y /suscribirse.
// Puro (sin base de datos): se usa en el middleware y se prueba con scripts.
import { liteIncluye } from "@/lib/plan-lite";

export type PlanId = "lite" | "basic" | "starter" | "pro" | "enterprise";
const RANGO: Record<PlanId, number> = { lite: 0, basic: 1, starter: 2, pro: 3, enterprise: 4 };
export const esPlanId = (p: unknown): p is PlanId => typeof p === "string" && p in RANGO;

export interface ReglaPlan {
  min: PlanId;
  nombre: string;
  paginas: string[];   // pantallas del Dashboard
  apis: string[];      // rutas de la API
}

// Starter y superiores: lo que Basic y Lite NO incluyen (landing: mensajes masivos, cupones, Standby, ventas y finanzas, reportes avanzados).
// Pro y superiores: lo que Starter tampoco incluye (caja, terminal de pago, inventario, fidelización, facturas, comisiones y arriendo).
export const REGLAS: ReglaPlan[] = [
  { min: "starter", nombre: "Exportar clientes", paginas: [], apis: ["/api/clients/export"] },
  { min: "basic", nombre: "Importar clientes", paginas: [], apis: ["/api/clients/import"] },
  { min: "starter", nombre: "Mi Agenda (equipo)", paginas: ["/dashboard/mi-agenda"], apis: [] },
  { min: "starter", nombre: "Reseñas", paginas: ["/dashboard/resenas"], apis: [] },
  { min: "starter", nombre: "Cierre mensual", paginas: ["/dashboard/reportes"], apis: [] },
  { min: "starter", nombre: "Métricas de clientes", paginas: ["/dashboard/clientes/metricas"], apis: [] },
  { min: "starter", nombre: "Servicios y precios por profesional", paginas: ["/dashboard/barberos/precios"], apis: [] },
  { min: "pro", nombre: "Sucursales", paginas: ["/dashboard/sucursales"], apis: [] },
  { min: "starter", nombre: "Punto de Venta", paginas: ["/dashboard/pos"], apis: ["/api/pos"] },
  { min: "starter", nombre: "Modo Standby", paginas: ["/dashboard/standby"], apis: [] },
  { min: "starter", nombre: "Ingresos, abonos, boletas y proveedores", paginas: ["/dashboard/finanzas", "/dashboard/abonos", "/dashboard/boletas", "/dashboard/pagos", "/dashboard/proveedores"], apis: ["/api/finanzas", "/api/abonos", "/api/boletas", "/api/proveedores"] },
  { min: "starter", nombre: "Mensajes masivos", paginas: ["/dashboard/whatsapp"], apis: ["/api/whatsapp"] },
  { min: "starter", nombre: "Cupones de descuento", paginas: ["/dashboard/cupones"], apis: ["/api/cupones"] },
  { min: "starter", nombre: "Retención de clientes", paginas: ["/dashboard/retencion"], apis: ["/api/retention"] },
  { min: "starter", nombre: "Reportes avanzados (demanda y ocupación)", paginas: ["/dashboard/demanda", "/dashboard/ocupacion"], apis: ["/api/reportes/demanda", "/api/ocupacion"] },
  { min: "pro", nombre: "Módulo de caja", paginas: ["/dashboard/caja"], apis: ["/api/caja"] },
  { min: "pro", nombre: "Integración con sistemas de pago (POS)", paginas: ["/dashboard/terminal-pos"], apis: ["/api/tuu"] },
  { min: "pro", nombre: "Inventario y solicitud de insumos", paginas: ["/dashboard/inventario", "/dashboard/solicitud"], apis: ["/api/inventario", "/api/solicitudes-insumos"] },
  { min: "pro", nombre: "Sistema de fidelización", paginas: ["/dashboard/fidelidad"], apis: ["/api/loyalty"] },
  { min: "pro", nombre: "Facturas", paginas: ["/dashboard/facturas"], apis: ["/api/invoices"] },
  { min: "pro", nombre: "Comisiones y arriendo de estación", paginas: ["/dashboard/comisiones", "/dashboard/arriendo"], apis: ["/api/arriendo"] },
];

const coincide = (ruta: string, prefijo: string) => ruta === prefijo || ruta.startsWith(prefijo + "/");

/** Regla del plan que impide abrir esa pantalla o llamar a esa API; null si el plan la incluye. */
export function reglaQueBloquea(plan: string | null | undefined, pathname: string, tipo: "pagina" | "api"): ReglaPlan | null {
  if (!esPlanId(plan)) return null;                       // plan desconocido: no se bloquea por error
  for (const r of REGLAS) {
    if (RANGO[plan] >= RANGO[r.min]) continue;
    if ((tipo === "pagina" ? r.paginas : r.apis).some((p) => coincide(pathname, p))) return r;
  }
  return null;
}

/** Plan Lite: solo se abren las pantallas que incluye (el resto va a la agenda). Siempre se puede ver el plan y facturación. */
export function liteBloqueaPagina(plan: string | null | undefined, pathname: string): boolean {
  if (plan !== "lite") return false;
  if (!pathname.startsWith("/dashboard")) return false;
  return !liteIncluye(pathname) && pathname !== "/dashboard/onboarding";
}

/** Plan mínimo para un tipo de usuario del equipo: los accesos por profesional (recepción, administradores extra) son de Starter. */
export const PLAN_MIN_ACCESOS_EQUIPO: PlanId = "starter";
export const planIncluye = (plan: string | null | undefined, minimo: PlanId): boolean => !esPlanId(plan) || RANGO[plan] >= RANGO[minimo];

// Capacidades de la interfaz por plan (lo que se muestra o no dentro de una pantalla). Una sola tabla, para no mostrar algo y luego quitarlo.
// Basic = 1 profesional que no vende desde la app (landing); Starter suma ventas, mensajes masivos, fichas y reportes avanzados; Pro suma caja, inventario, fidelización, comisiones y arriendo.
export type Capacidad =
  | "ventas" | "dashboardPersonalizar" | "reportesAvanzados" | "inventario" | "miAgenda" | "resenas" | "cierreMensual"
  | "sucursales" | "boletaSii" | "honorarios" | "publicidad" | "agenteWhatsapp" | "cobrosOnline" | "reglaReserva"
  | "caja" | "standby" | "libroProfesional" | "fichasCliente" | "serviciosAvanzados" | "informeDiario" | "equipoAccesos" | "avisosCaja";
export const CAPACIDADES: Record<Capacidad, PlanId> = {
  ventas: "starter", dashboardPersonalizar: "starter", reportesAvanzados: "starter", miAgenda: "starter", resenas: "starter", cierreMensual: "starter",
  boletaSii: "starter", cobrosOnline: "starter", reglaReserva: "starter", standby: "starter", fichasCliente: "starter", serviciosAvanzados: "starter",
  informeDiario: "starter", equipoAccesos: "starter",
  inventario: "pro", sucursales: "pro", honorarios: "pro", publicidad: "pro", agenteWhatsapp: "pro", caja: "pro", libroProfesional: "pro", avisosCaja: "pro",
};
export const planPermite = (plan: string | null | undefined, cap: Capacidad): boolean => planIncluye(plan, CAPACIDADES[cap]);
