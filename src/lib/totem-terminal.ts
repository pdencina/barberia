// Cobro con tarjeta en la MÁQUINA del local desde el tótem (Mercado Pago Point o TUU).
// Es una copia acotada de lo que hacen /api/mercadopago y /api/tuu del POS (esas rutas piden sesión del equipo y no se tocaron):
// misma resolución de máquina, mismas llamadas a Mercado Pago/TUU y misma regla de oro aprendida con dinero real:
// un error de red o un estado desconocido NUNCA se toma como "rechazado" ni como "pagado": se sigue esperando.

const TUU_BASE_URL = "https://integrations.payment.haulmer.com";

export type Proveedor = "mercadopago" | "tuu";
export interface Terminal { proveedor: Proveedor; device: string; token?: string; apiKey?: string }
export type EstadoCobro = "approved" | "rejected" | "cancelled" | "pending";

// Máquina del negocio: el proveedor que eligió (tenant_settings.card_payment_provider) y, dentro de él, la máquina de «servicios»,
// luego la «todas» y luego cualquiera activa (mismo orden que el POS). No se usan las máquinas personales de profesionales en arriendo.
export async function resolverTerminal(supabase: any, tenantId: string): Promise<Terminal | null> {
  const { data: st } = await supabase.from("tenant_settings").select("card_payment_provider, tuu_api_key, mp_access_token, mp_device_id").eq("tenant_id", tenantId).maybeSingle();
  const elige = async (tabla: string, col: string, extra: string) => {
    for (const tipo of ["services", "all", null as string | null]) {
      let q: any = supabase.from(tabla).select(`${col}${extra}`).eq("tenant_id", tenantId).eq("active", true);
      if (tipo) q = q.eq("terminal_type", tipo);
      const { data } = await q.limit(1).maybeSingle();
      if (data?.[col]) return data;
    }
    return null;
  };

  if (st?.card_payment_provider === "tuu") {
    const apiKey = st?.tuu_api_key || process.env.TUU_API_KEY || null;
    const t = await elige("tuu_terminals", "device_serial", "");
    return apiKey && t?.device_serial ? { proveedor: "tuu", device: t.device_serial, apiKey } : null;
  }

  // Mercado Pago: un dispositivo solo se cobra con el token de SU cuenta (el de la máquina o, si no tiene, el global del negocio).
  const global = st?.mp_access_token || null;
  const t = await elige("mp_terminals", "device_id", ", access_token");
  if (t?.device_id && (t.access_token || global)) return { proveedor: "mercadopago", device: t.device_id, token: t.access_token || global };
  if (st?.mp_device_id && global) return { proveedor: "mercadopago", device: st.mp_device_id, token: global };
  return null;
}

// Proveedor de tarjetas del negocio ("tuu" o "mercadopago"), sin buscar la máquina.
export async function proveedorTarjeta(supabase: any, tenantId: string): Promise<Proveedor> {
  const { data } = await supabase.from("tenant_settings").select("card_payment_provider").eq("tenant_id", tenantId).maybeSingle();
  return data?.card_payment_provider === "tuu" ? "tuu" : "mercadopago";
}

// Manda el cobro a la máquina. Devuelve el id para consultarlo (orden de Mercado Pago o idempotencyKey de TUU).
export async function iniciarCobro(term: Terminal, o: { amount: number; descripcion: string; referencia: string; tarjeta: "debito" | "credito" }): Promise<{ ok: true; externalId: string } | { ok: false; error: string }> {
  const monto = Math.round(o.amount);
  try {
    if (term.proveedor === "tuu") {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`${TUU_BASE_URL}/RemotePayment/v2/Create`, {
        method: "POST",
        headers: { "X-API-Key": term.apiKey!, "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey, amount: monto, device: term.device,
          paymentMethod: o.tarjeta === "credito" ? 1 : 2, // TUU: 1 = crédito, 2 = débito
          dteType: 99, // servicios: boleta exenta, igual que el POS
          description: o.descripcion.slice(0, 28),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.message || data.error || "No se pudo enviar el cobro a la máquina" };
      return { ok: true, externalId: idempotencyKey };
    }

    const idem = `${o.referencia}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${term.token}`, "Content-Type": "application/json", "X-Idempotency-Key": idem },
      body: JSON.stringify({
        type: "point", external_reference: o.referencia,
        transactions: { payments: [{ amount: String(monto) }] },
        config: { point: { terminal_id: term.device } },
        description: o.descripcion,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.errors?.[0]?.message || data?.error || "");
      return { ok: false, error: /already.*queued|queued/i.test(msg) ? "La máquina está ocupada con otro cobro. Intenta en un momento." : "No se pudo enviar el cobro a la máquina" };
    }
    // «Procesar» es lo que despierta la máquina para que pida la tarjeta.
    await fetch(`https://api.mercadopago.com/v1/orders/${data.id}/process`, { method: "POST", headers: { Authorization: `Bearer ${term.token}`, "Content-Type": "application/json" } });
    return { ok: true, externalId: String(data.id) };
  } catch (e: any) {
    return { ok: false, error: "No se pudo comunicar con la máquina" };
  }
}

// Estado del cobro. Solo «approved» confirma un pago; cualquier error o estado raro devuelve «pending» (se sigue esperando).
export async function consultarCobro(term: Terminal, externalId: string): Promise<EstadoCobro> {
  try {
    if (term.proveedor === "tuu") {
      const res = await fetch(`${TUU_BASE_URL}/RemotePayment/v2/GetPaymentReques/${externalId}`, { headers: { "X-API-Key": term.apiKey! }, cache: "no-store" });
      if (!res.ok) return "pending"; // incluye 429 (límite de consultas de TUU): no es un rechazo
      const data: any = await res.json().catch(() => ({}));
      const raw = data.status ?? data.Status ?? data.state ?? data.paymentStatus ?? data.requestStatus;
      const mapa: Record<string, string> = { "2": "cancelled", canceled: "cancelled", cancelled: "cancelled", "4": "rejected", failed: "rejected", "5": "approved", completed: "approved" };
      return (mapa[String(raw)] as EstadoCobro) || "pending";
    }
    const res = await fetch(`https://api.mercadopago.com/v1/orders/${externalId}`, { headers: { Authorization: `Bearer ${term.token}` }, cache: "no-store" });
    if (!res.ok) return "pending";
    const data: any = await res.json().catch(() => ({}));
    if (data.status === "processed" || data.status === "closed") {
      const p = data.transactions?.payments?.[0]?.status;
      if (p === "approved" || p === "processed") return "approved";
      if (p === "rejected" || p === "cancelled") return "rejected";
    } else if (data.status === "expired" || data.status === "cancelled") return "cancelled";
    return "pending";
  } catch {
    return "pending";
  }
}

// Cancela el cobro en la máquina. Mercado Pago sí permite cancelar la orden; TUU no ofrece cancelación remota (la máquina puede seguir esperando).
export async function cancelarCobro(term: Terminal, externalId: string): Promise<{ remoto: boolean }> {
  if (term.proveedor === "tuu") return { remoto: false };
  try {
    await fetch(`https://api.mercadopago.com/v1/orders/${externalId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${term.token}`, "Content-Type": "application/json" } });
    return { remoto: true };
  } catch {
    return { remoto: false };
  }
}
