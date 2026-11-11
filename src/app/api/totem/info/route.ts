import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, limpiarSecciones } from "@/lib/totem";
import { proveedorTarjeta } from "@/lib/totem-terminal";

// GET ?codigo=: datos publicos para pintar el totem (nombre, logo, productos a la venta y textos informativos).
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const t = await negocioDelTotem(supabase, new URL(req.url).searchParams.get("codigo"));
  if (!t) return NextResponse.json({ error: "Totem no disponible" }, { status: 404 });

  const { data: prods } = await supabase
    .from("products").select("id, name, price, category, stock, product_type")
    .eq("tenant_id", t.id).eq("active", true).gt("stock", 0).order("name").limit(60);

  // Solo lo que se vende al cliente (no insumos/arriendo): si el negocio no distingue tipos, se muestran los activos con stock.
  const productos = (prods || [])
    .filter((p: any) => !p.product_type || p.product_type === "retail" || p.product_type === "sale" || p.product_type === "venta")
    .map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), category: p.category || null }));

  return NextResponse.json({
    negocio: { name: t.name, logo_url: t.logo_url || null },
    // Dirección de reserva online del negocio (para el QR y para reservar en la propia pantalla).
    reserva: t.slug ? `https://www.re-booking.cl/${t.slug}` : null,
    reservaPantalla: t.slug ? `/booking?tenant=${encodeURIComponent(t.slug)}&kiosko=1` : null,
    productos,
    pagoQr: !!t.kiosk_pay_qr_enabled,
    pagoTerminal: !!t.kiosk_terminal_enabled,
    tarjetaElige: !!t.kiosk_terminal_enabled && (await proveedorTarjeta(supabase, t.id)) === "tuu", // TUU pide débito o crédito al cobrar
    info: limpiarSecciones(t.kiosk_info),
  });
}
