// Envío de correos por tandas: cada tanda se manda de una vez (API de lotes del proveedor). Si la tanda entera es
// rechazada, se intenta uno por uno, despacio. Solo cuenta como enviado lo que el proveedor confirma.
export interface CorreoListo { id: string; payload: { from: string; to: string; subject: string; html: string } }
export interface Mensajero {
  batch: { send: (p: CorreoListo["payload"][]) => Promise<{ error?: any }> };
  emails: { send: (p: CorreoListo["payload"]) => Promise<{ error?: any }> };
}

export const correoValido = (e: unknown) => typeof e === "string" && /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[a-z]{2,}$/i.test(e.trim());
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function enviarTanda(m: Mensajero, correos: CorreoListo[], pausaMs = 600): Promise<{ enviados: Set<string> }> {
  const enviados = new Set<string>();
  const validos = correos.filter((c) => correoValido(c.payload.to));
  if (validos.length === 0) return { enviados };
  const intentar = async () => { try { return (await m.batch.send(validos.map((c) => c.payload))).error || null; } catch (e) { return e; } };
  let error: any = await intentar();
  if (error && /rate|too many/i.test(String(error?.name || "") + String(error?.message || ""))) { await espera(pausaMs * 2); error = await intentar(); }
  if (!error) { for (const c of validos) enviados.add(c.id); return { enviados }; }
  console.error("[envio-lote] la tanda fue rechazada, se envía uno por uno:", error?.message || error);
  // Si el proveedor ya no deja enviar (límite diario o mensual), no tiene sentido insistir.
  if (/daily|monthly|quota/i.test(String(error?.name || "") + String(error?.message || ""))) return { enviados };
  const limite = Date.now() + 40_000; // se responde antes de que el servidor corte la operación
  for (const c of validos) {
    if (Date.now() > limite) break;
    try { const r = await m.emails.send(c.payload); if (!r.error) enviados.add(c.id); else console.error("[envio-lote]", r.error?.message); }
    catch (e) { console.error("[envio-lote]", e); }
    await espera(pausaMs);
  }
  return { enviados };
}
