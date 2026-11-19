// Compra de PRODUCTOS en el tótem: arma el carrito con los precios y el stock del SERVIDOR (nunca los del navegador) e identifica a quién se le
// registra la venta: el profesional de la cita de hoy del cliente (por su código) o, si no tiene cita, el que el cliente elige en la lista.
import { normalizarCodigo, soloDiaDelTotem } from "@/lib/totem";
import { isCosmeticCategory } from "@/lib/product-commission";

// Regla de Nico: bebidas, consumibles y cualquier producto que no sea cosmético NUNCA son plata del profesional. Solo los cosméticos pueden
// cobrarse en la máquina o cuenta del profesional que los vendió (arriendo); si en la compra hay algo que no es cosmético, el cobro va
// a la máquina/cuenta del NEGOCIO. La comisión del cosmético la calcula el libro, como en el POS.
export interface ItemCompra { product_id: string; name: string; price: number; quantity: number; cosmetico: boolean }

// Profesional cuya máquina/cuenta recibe el cobro de una compra de productos: el vendedor solo si TODO es cosmético; si no, el negocio (null).
export function barberDeCobroProductos(items: Array<{ cosmetico?: boolean }> | null | undefined, vendedorId: string): string | null {
  const lista = Array.isArray(items) ? items : [];
  return lista.length > 0 && lista.every((i) => i.cosmetico === true) ? vendedorId : null;
}
export type CompraArmada =
  | { ok: true; vendedor: { id: string; name: string }; clienteId: string | null; items: ItemCompra[]; total: number }
  | { ok: false; error: string; pedirProfesional?: boolean; status: number };

// Carrito validado contra la base: productos del negocio, activos, a la venta, con stock y precio del servidor (nunca el del navegador).
// soloCosmeticos: para ofrecer productos junto al pago de un servicio (se cobran en la máquina del profesional, así que solo cosméticos).
export async function armarItemsProductos(
  supabase: any, tenantId: string, productos: unknown, soloCosmeticos = false,
): Promise<{ ok: true; items: ItemCompra[]; total: number } | { ok: false; error: string; status: number }> {
  const pedidos: Array<{ id: string; cantidad: number }> = (Array.isArray(productos) ? productos : []).slice(0, 10).map((p: any) => ({
    id: String(p?.id || ""), cantidad: Math.max(1, Math.min(10, Math.floor(Number(p?.cantidad) || 1))),
  })).filter((p) => /^[0-9a-f-]{36}$/i.test(p.id));
  if (pedidos.length === 0) return { ok: false, error: "Elige al menos un producto", status: 400 };

  const { data: prods } = await supabase.from("products").select("id, name, price, stock, product_type, active, category").eq("tenant_id", tenantId).eq("active", true).in("id", pedidos.map((p) => p.id));
  const mapa = new Map<string, any>((prods || []).filter((p: any) => !p.product_type || ["sale", "retail", "venta"].includes(p.product_type)).map((p: any) => [p.id, p]));
  const items: ItemCompra[] = [];
  for (const p of pedidos) {
    const prod = mapa.get(p.id);
    if (!prod) return { ok: false, error: "Un producto ya no está disponible. Vuelve a elegir.", status: 400 };
    if (soloCosmeticos && !isCosmeticCategory(prod.category)) return { ok: false, error: "Ese producto no se puede agregar al pago del servicio.", status: 400 };
    if (Number(prod.stock) < p.cantidad) return { ok: false, error: `Quedan pocas unidades de ${prod.name}. Elige menos o avisa a quien te atiende.`, status: 400 };
    const price = Math.round(Number(prod.price) || 0);
    if (price <= 0) return { ok: false, error: "Un producto no tiene precio. Avisa a quien te atiende.", status: 400 };
    items.push({ product_id: prod.id, name: prod.name, price, quantity: p.cantidad, cosmetico: isCosmeticCategory(prod.category) });
  }
  return { ok: true, items, total: items.reduce((s, i) => s + i.price * i.quantity, 0) };
}

export async function armarCompraProductos(
  supabase: any,
  tenantId: string,
  o: { productos: unknown; code?: unknown; barberId?: unknown },
): Promise<CompraArmada> {
  const carrito = await armarItemsProductos(supabase, tenantId, o.productos);
  if (!carrito.ok) return carrito;
  const { items, total } = carrito;

  // Quién vende: 1) el profesional de la cita de hoy del cliente (por su código); 2) el que el cliente elige.
  const code = normalizarCodigo(o.code);
  if (code.length === 5) {
    const { data: a } = await soloDiaDelTotem(supabase.from("appointments").select("barber_id, client_id, barber:profiles!barber_id(id, name, active)").eq("tenant_id", tenantId).eq("checkin_code", code).in("status", ["scheduled", "confirmed", "in_progress", "completed"])).order("date").limit(1).maybeSingle();
    if (a?.barber?.id && a.barber.active !== false) return { ok: true, vendedor: { id: a.barber.id, name: a.barber.name }, clienteId: a.client_id || null, items, total };
    return { ok: false, error: "No encontramos una cita tuya para hoy. Elige quién te atendió.", pedirProfesional: true, status: 404 };
  }
  const barberId = String(o.barberId || "");
  if (/^[0-9a-f-]{36}$/i.test(barberId)) {
    const { data: b } = await supabase.from("profiles").select("id, name, active, role").eq("id", barberId).eq("tenant_id", tenantId).maybeSingle();
    if (b && b.active !== false && b.role === "barber") return { ok: true, vendedor: { id: b.id, name: b.name }, clienteId: null, items, total };
  }
  return { ok: false, error: "Escribe tu código o elige quién te atendió.", pedirProfesional: true, status: 400 };
}
