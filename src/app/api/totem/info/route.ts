import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, limpiarSecciones } from "@/lib/totem";
import { isCosmeticCategory } from "@/lib/product-commission";
import { enlaceWhatsapp, enlaceWeb } from "@/lib/totem-contacto";
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
    .map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), category: p.category || null, cosmetico: isCosmeticCategory(p.category) }));

  // Profesionales para «¿Quién te atendió?» al comprar productos sin cita (solo nombre; nada más sale al público).
  const { data: pros } = await supabase.from("profiles").select("id, name").eq("tenant_id", t.id).eq("role", "barber").neq("active", false).order("name").limit(40);
  const profesionales = (pros || []).map((p: any) => ({ id: p.id, name: p.name }));

  // QR de contacto: lo configurado en el tótem; si falta, el teléfono y el sitio web del negocio. Sin la migración 173 simplemente no hay QR.
  let whatsapp: string | null = null;
  let web: string | null = null;
  const { data: ct, error: ctError } = await supabase.from("tenants").select("kiosk_whatsapp, kiosk_web, phone, website").eq("id", t.id).maybeSingle();
  if (!ctError && ct) { whatsapp = enlaceWhatsapp((ct as any).kiosk_whatsapp || (ct as any).phone); web = enlaceWeb((ct as any).kiosk_web || (ct as any).website); }

  // Cuántos tótems (módulos) tiene el local; sin la migración 175 es 1.
  const { data: mod, error: modError } = await supabase.from("tenants").select("kiosk_modules").eq("id", t.id).maybeSingle();
  const modulos = !modError && (mod as any)?.kiosk_modules ? Math.min(9, Math.max(1, Number((mod as any).kiosk_modules))) : 1;

  return NextResponse.json({
    modulos,
    whatsapp, web,
    profesionales,
    negocio: { name: t.name, logo_url: t.logo_url || null },
    // Dirección de reserva online del negocio (para el QR y para reservar en la propia pantalla).
    // ?vista=ambas: parte con el PRIMER PROFESIONAL DISPONIBLE y deja elegir un profesional (en la pantalla y en el celular).
    reserva: t.slug ? `https://www.re-booking.cl/${t.slug}?vista=ambas` : null,
    reservaPantalla: t.slug ? `/booking?tenant=${encodeURIComponent(t.slug)}&kiosko=1&vista=ambas` : null,
    productos,
    pagoQr: !!t.kiosk_pay_qr_enabled,
    pagoTerminal: !!t.kiosk_terminal_enabled,
    tarjetaElige: !!t.kiosk_terminal_enabled && (await proveedorTarjeta(supabase, t.id)) === "tuu", // TUU pide débito o crédito al cobrar
    info: limpiarSecciones(t.kiosk_info),
  });
}
