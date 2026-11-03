import { NextResponse } from "next/server";

// Códigos de las funciones de base de datos (migraciones 125 a 127) traducidos para quien usa el panel.
const MESSAGES: Record<string, { status: number; message: string }> = {
  insufficient_stock: { status: 409, message: "No hay stock disponible suficiente." },
  quantity_out_of_range: { status: 400, message: "La cantidad supera el máximo permitido." },
  invalid_quantity: { status: 400, message: "La cantidad no es válida." },
  invalid_type: { status: 400, message: "El tipo de movimiento no es válido." },
  invalid_transfer: { status: 400, message: "Elige dos bodegas distintas para el traspaso." },
  reason_required: { status: 400, message: "Escribe el motivo del ajuste." },
  idempotency_conflict: { status: 409, message: "Ese movimiento ya se registró con otros datos." },
  product_not_found: { status: 404, message: "Producto no encontrado o inactivo." },
  warehouse_not_found: { status: 404, message: "Bodega no encontrada o inactiva." },
  order_not_found: { status: 404, message: "Pedido no encontrado." },
  order_empty: { status: 400, message: "El pedido no tiene productos." },
  order_not_editable: { status: 409, message: "El pedido ya no se puede editar." },
  invalid_status: { status: 409, message: "El pedido no puede pasar a ese estado." },
  count_not_found: { status: 404, message: "Conteo no encontrado." },
  count_not_open: { status: 409, message: "Ese conteo ya no está abierto." },
  count_already_open: { status: 409, message: "Ya hay un conteo abierto en esa bodega." },
  count_conflict: { status: 409, message: "El stock cambió durante el conteo. Vuelve a contar el producto." },
  not_a_member: { status: 403, message: "No autorizado" },
  tenant_not_company: { status: 403, message: "No autorizado" },
};

type DbError = { message?: string; code?: string; details?: string | null };

// Nunca se devuelve el error crudo de la base: solo mensajes conocidos.
export function dbErrorResponse(error: DbError, where: string): NextResponse {
  const known = MESSAGES[error.message || ""];
  if (known) {
    return NextResponse.json({ error: known.message, code: error.message, productId: error.details || undefined }, { status: known.status });
  }
  if (error.code === "23505") return NextResponse.json({ error: "Ya existe un registro con esos datos." }, { status: 409 });
  if (error.code === "23503" || error.code === "22P02" || error.code === "23514") {
    return NextResponse.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
  }
  console.error(`[empresa] ${where}:`, JSON.stringify({ code: error.code, message: error.message }));
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
