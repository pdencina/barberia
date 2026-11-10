// Capacidades por rol de empresa. Este mapa decide los permisos en el servidor; en el navegador solo se usa para ocultar botones.
export type CompanyRole = "owner" | "seller" | "warehouse";

export type Capability =
  | "productos.ver" | "productos.editar" | "costos.ver"
  | "stock.ver" | "stock.mover" | "stock.ajustar"
  | "conteos.ver" | "conteos.contar" | "conteos.cerrar" | "conteos.ver_sistema"
  | "clientes.ver" | "clientes.editar"
  | "pedidos.ver_todos" | "pedidos.ver_propios" | "pedidos.ver_bodega"
  | "pedidos.crear" | "pedidos.confirmar" | "pedidos.preparar" | "pedidos.despachar" | "pedidos.entregar" | "pedidos.cancelar"
  // Etapas 1 a 4
  | "usuarios.gestionar" | "importar" | "config.editar"
  | "cartera.ver_todas" | "cartera.asignar" | "gestiones.registrar" | "reporte.ver"
  | "socios.gestionar" | "campanas.gestionar";

const ROLE_CAPABILITIES: Record<CompanyRole, readonly Capability[]> = {
  owner: [
    "productos.ver", "productos.editar", "costos.ver",
    "stock.ver", "stock.mover", "stock.ajustar",
    "conteos.ver", "conteos.contar", "conteos.cerrar", "conteos.ver_sistema",
    "clientes.ver", "clientes.editar",
    "pedidos.ver_todos", "pedidos.crear", "pedidos.confirmar", "pedidos.preparar", "pedidos.despachar", "pedidos.entregar", "pedidos.cancelar",
    "usuarios.gestionar", "importar", "config.editar",
    "cartera.ver_todas", "cartera.asignar", "gestiones.registrar", "reporte.ver",
    "socios.gestionar", "campanas.gestionar",
  ],
  // Ve los clientes de su cartera y los que no tienen vendedor (un cliente que llama para pedir nunca queda bloqueado).
  // Ve sus pedidos y los de los clientes de su cartera (incluidos los que llegan del portal).
  seller: [
    "productos.ver", "stock.ver",
    "clientes.ver", "clientes.editar",
    "pedidos.ver_propios", "pedidos.crear", "pedidos.confirmar", "pedidos.cancelar",
    "gestiones.registrar",
  ],
  // Bodega cuenta, pero el dueño revisa las diferencias y cierra. Los ajustes directos también son del dueño.
  warehouse: [
    "productos.ver", "stock.ver", "stock.mover",
    "conteos.ver", "conteos.contar",
    "pedidos.ver_bodega", "pedidos.preparar", "pedidos.despachar", "pedidos.entregar",
  ],
};

export const BODEGA_ORDER_STATUSES = ["confirmed", "prepared", "dispatched"] as const;

export function capabilitiesFor(role: string | null | undefined): readonly Capability[] {
  return role && Object.prototype.hasOwnProperty.call(ROLE_CAPABILITIES, role) ? ROLE_CAPABILITIES[role as CompanyRole] : [];
}

export function roleCan(role: string | null | undefined, capability: Capability): boolean {
  return capabilitiesFor(role).includes(capability);
}

// Quién puede ver un pedido concreto. Responder 404 en vez de 403 evita confirmar que existe.
// assignedSellerId: vendedor del cliente del pedido (cartera). Un vendedor ve sus pedidos y los de su cartera.
export function canSeeOrder(role: string, userId: string, order: { created_by: string; status: string; assignedSellerId?: string | null }): boolean {
  if (roleCan(role, "pedidos.ver_todos")) return true;
  if (roleCan(role, "pedidos.ver_propios")) return order.created_by === userId || (!!order.assignedSellerId && order.assignedSellerId === userId);
  if (roleCan(role, "pedidos.ver_bodega")) return (BODEGA_ORDER_STATUSES as readonly string[]).includes(order.status);
  return false;
}
