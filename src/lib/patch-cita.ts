// Cambia el estado de una cita. Si se intenta «Completar» sin ningún cobro registrado, el servidor avisa (409) y aquí se le pregunta a la persona,
// para que no queden citas «completadas» sin plata. Devuelve la respuesta final, o null si la persona prefirió no completarla.
export async function patchCita(id: string, body: Record<string, any>): Promise<Response | null> {
  const enviar = (extra: Record<string, any> = {}) => fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...extra }) });
  const res = await enviar();
  if (res.status !== 409) return res;
  const j = await res.clone().json().catch(() => ({}));
  if (j?.code !== "sin_cobro") return res;
  const seguir = typeof window !== "undefined" && window.confirm(`${j.error}\n\nAceptar = completarla igual (sin cobro).\nCancelar = no completarla (cóbrala desde Punto de Venta o el botón «Cobrar»).`);
  return seguir ? enviar({ sinCobro: true }) : null;
}
