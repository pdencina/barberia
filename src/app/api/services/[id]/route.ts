import { limpiarDuracionPublica, MENSAJE_MIGRACION_187 } from "@/lib/duracion-publica";
import { errorDuracion } from "@/lib/servicios-internos";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { authorizeServiceAccess } from "@/lib/service-access";

// Solo estos campos se pueden editar desde aqui (antes se aplicaba todo el cuerpo, incluido tenant_id).
const EDITABLE = ["name", "description", "price", "duration", "category", "active", "sort_order"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorizeServiceAccess(params.id);
  if (!auth.ok) return auth.response;

  const supabase = createAdminSupabase();
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) if (body && body[k] !== undefined) update[k] = body[k];
  // Duración que ve el cliente (null = la misma de la agenda).
  if (body && body.public_duration !== undefined) {
    const publica = limpiarDuracionPublica(body.public_duration);
    if (publica === undefined) return NextResponse.json({ error: "La duración que ve el cliente debe ser entre 5 y 600 minutos" }, { status: 400 });
    update.public_duration = publica;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No hay campos validos para actualizar" }, { status: 400 });
  }
  // Visibilidad (público o interno) y duración: 0 minutos solo para internos.
  if (body && body.internal_only !== undefined) update.internal_only = body.internal_only === true;
  if (update.duration !== undefined || update.internal_only !== undefined) {
    // Si solo llega uno de los dos, el otro se toma de lo que ya tiene el servicio (la columna puede no existir aún: sin ella, es público).
    let actual: any = {};
    if (update.duration === undefined || update.internal_only === undefined) {
      let r: any = await supabase.from("services").select("duration, internal_only").eq("id", params.id).maybeSingle();
      if (r.error) r = await supabase.from("services").select("duration").eq("id", params.id).maybeSingle();
      actual = r.data || {};
    }
    const interno = update.internal_only !== undefined ? update.internal_only === true : actual.internal_only === true;
    const dur = update.duration !== undefined ? update.duration : actual.duration;
    const errDur = errorDuracion(dur, interno);
    if (errDur) return NextResponse.json({ error: errDur }, { status: 400 });
    if (update.duration !== undefined) update.duration = Number(update.duration);
  }

  // If price is being changed, log it
  if (update.price !== undefined && Number(auth.service.price) !== Number(update.price)) {
    await supabase.from("price_history").insert({
      entity_type: "service",
      entity_id: params.id,
      entity_name: auth.service.name,
      old_price: Number(auth.service.price),
      new_price: Number(update.price),
    });
  }

  let { data, error } = await supabase
    .from("services")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  // Sin la migración 187: si venía vacía se guarda lo demás; si traía un valor, se avisa.
  if (error && /public_duration/.test(error.message)) {
    if (update.public_duration !== null) return NextResponse.json({ error: MENSAJE_MIGRACION_187 }, { status: 409 });
    delete update.public_duration;
    ({ data, error } = await supabase.from("services").update(update).eq("id", params.id).select().single());
  }

  if (error && /internal_only/.test(error.message)) return NextResponse.json({ error: "Falta aplicar la migración 141 para usar servicios internos." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorizeServiceAccess(params.id);
  if (!auth.ok) return auth.response;

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("services")
    .update({ active: false })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
