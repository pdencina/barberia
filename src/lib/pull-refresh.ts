// Parámetros propios compartidos por las pantallas; no dependen de un proveedor.
export const PULL_REFRESH = { slop: 12, resistance: 0.5, threshold: 64, maximum: 88 } as const;
const SECTIONS = new Set([
  "", "mi-agenda", "agenda", "calendario", "clientes", "clientes/metricas", "barberos", "barberos/precios",
  "servicios", "precios", "inventario", "proveedores", "sucursales", "vacaciones", "waitlist", "recepcion",
  "reportes", "finanzas", "caja", "comisiones", "arriendo", "honorarios", "remuneraciones", "mi-billetera",
  "mi-billetera/personal", "facturas", "boletas", "pagos", "abonos", "resenas", "ocupacion", "demanda",
  "origen-de-reservas", "fidelidad", "cupones", "retencion", "retencion/campanas", "avisos", "recordatorios",
  "whatsapp", "whatsapp-indicadores", "galeria", "mi-negocio", "mi-negocio/mensajes",
  "superadmin/tenants", "superadmin/audit", "superadmin/sesiones", "superadmin/reuniones",
]);
export function canPullRefresh(path: string): boolean {
  if (path !== "/dashboard" && !path.startsWith("/dashboard/")) return false;
  return SECTIONS.has(path.replace(/^\/dashboard\/?/, "").replace(/\/$/, ""));
}
export class PullRefreshGesture {
  private start: { x: number; y: number } | null = null;
  distance = 0;
  active = false;
  begin(x: number, y: number, eligible: boolean, fingers = 1) {
    this.cancel();
    if (eligible && fingers === 1) this.start = { x, y };
  }
  move(x: number, y: number, atTop: boolean, fingers = 1): number {
    if (!this.start) return 0;
    const dx = Math.abs(x - this.start.x), dy = y - this.start.y;
    if (!atTop || fingers !== 1 || dy < 0 || (dx > PULL_REFRESH.slop && dx > dy)) { this.cancel(); return 0; }
    if (!this.active && dy < PULL_REFRESH.slop) return 0;
    this.active = true;
    this.distance = Math.min(PULL_REFRESH.maximum, Math.max(0, dy - PULL_REFRESH.slop) * PULL_REFRESH.resistance);
    return this.distance;
  }
  release() {
    const trigger = this.active && this.distance >= PULL_REFRESH.threshold;
    this.cancel();
    return trigger;
  }
  cancel() { this.start = null; this.distance = 0; this.active = false; }
}
