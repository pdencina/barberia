// Teléfono de contacto del NEGOCIO para los correos al cliente (tenants.phone). Nunca un número fijo: cada correo
// lleva el del negocio de la cita; si el negocio no tiene, el correo simplemente no lleva esa línea.

// «+56942666172», «942666172» o «56 9 4266 6172» -> «9 4266 6172». Otros formatos se dejan como están (sin espacios de sobra).
export function formatoTelefono(raw: string | null | undefined): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  let d = t.replace(/\D/g, "");
  if (d.length < 7) return null;
  if (d.length === 11 && d.startsWith("56")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("9")) return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
  return t.replace(/\s+/g, " ");
}

// Línea HTML «¿...? Escríbenos al <b>número</b>»; vacía si el negocio no tiene teléfono.
export function lineaContactoHtml(pregunta: string, phone: string | null | undefined): string {
  const f = formatoTelefono(phone);
  if (!f) return "";
  const seguro = f.replace(/[<>&"]/g, "");
  return `<p style="text-align:center;font-size:13px;color:#6B7280;margin:14px 0 0;">${pregunta} Escríbenos al <strong style="color:#111827;">${seguro}</strong></p>`;
}

export async function telefonoDeNegocio(supabase: any, tenantId: string | null | undefined): Promise<string | null> {
  if (!tenantId) return null;
  const { data } = await supabase.from("tenants").select("phone").eq("id", tenantId).maybeSingle();
  return (data as any)?.phone || null;
}

// Para el recordatorio por WhatsApp/correo, que solo conoce el id de la cita.
export async function telefonoDeCita(supabase: any, appointmentId: string): Promise<string | null> {
  const { data } = await supabase.from("appointments").select("tenant_id").eq("id", appointmentId).maybeSingle();
  return telefonoDeNegocio(supabase, (data as any)?.tenant_id);
}
