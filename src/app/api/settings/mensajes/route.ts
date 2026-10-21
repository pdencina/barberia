import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { DEFAULT_WHATSAPP_CONFIG, mergeWhatsAppConfig } from "@/lib/whatsapp-confirm";

// Mensajes de WhatsApp del negocio (Mi negocio > Mensajes de WhatsApp).
// GET: cualquier persona con sesion del negocio (el Calendario y Mi Agenda lo usan para armar el mensaje).
// PUT: solo el administrador. Sin la migracion 113 todo sigue con los mensajes de siempre.

export async function GET() {
  const c = await getCurrentUserRoleAndTenant();
  if (!c.userId || !c.tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error } = await createAdminSupabase().from("tenants").select("whatsapp_messages").eq("id", c.tenantId).maybeSingle();
  if (error) return NextResponse.json({ config: DEFAULT_WHATSAPP_CONFIG, migrationMissing: true });
  return NextResponse.json({ config: mergeWhatsAppConfig((data as any)?.whatsapp_messages), migrationMissing: false });
}

export async function PUT(req: NextRequest) {
  const c = await getCurrentUserRoleAndTenant();
  if (!c.userId || (c.role !== "admin" && c.role !== "super_admin") || !c.tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({} as any));
  const cfg = mergeWhatsAppConfig(body?.config);
  const text = (t: string, max: number) => String(t || "").slice(0, max);

  if (!cfg.confirm_text.trim()) return NextResponse.json({ error: "El mensaje de confirmación no puede quedar vacío" }, { status: 400 });
  if (cfg.deposit_mode === "percent" && (cfg.deposit_value < 1 || cfg.deposit_value > 100)) {
    return NextResponse.json({ error: "El porcentaje de abono debe estar entre 1 y 100" }, { status: 400 });
  }
  if (cfg.deposit_mode === "fixed" && (cfg.deposit_value < 1 || cfg.deposit_value > 10_000_000)) {
    return NextResponse.json({ error: "El monto del abono no es válido" }, { status: 400 });
  }
  const clean = {
    ...cfg,
    confirm_text: text(cfg.confirm_text, 700),
    deposit_text: text(cfg.deposit_text, 500),
    transfer_text: text(cfg.transfer_text, 500),
    welcome_text: text(cfg.welcome_text, 500),
    info_text: text(cfg.info_text, 700),
    deposit_value: Math.round(cfg.deposit_value),
  };

  const { error } = await createAdminSupabase().from("tenants").update({ whatsapp_messages: clean }).eq("id", c.tenantId);
  if (error) {
    return NextResponse.json({ error: /does not exist|schema cache/i.test(error.message) ? "Falta aplicar la migración 113 en la base de datos." : error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, config: clean });
}
