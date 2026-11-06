// «Novedades de la semana» del Dashboard: qué funcionó, qué empeoró y qué conviene mirar. Puro: se prueba sin base de datos.
// Solo se arma un aviso cuando hay algo que decir (si no hay nada, el bloque no aparece), y cada aviso tiene una clave estable
// para que la persona pueda ocultarlo durante la semana (vuelve a salir la semana siguiente si sigue pasando).

export type TipoNovedad = "bien" | "mal" | "alerta";
export interface Novedad { id: string; tipo: TipoNovedad; titulo: string; texto: string; enlace?: { href: string; label: string } }

const clp = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
const pct = (actual: number, previo: number) => (previo > 0 ? Math.round(((actual - previo) / previo) * 100) : null);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// Lunes de la semana de una fecha (YYYY-MM-DD): las novedades se renuevan cada semana.
export function lunesDe(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
}

// ---- 1. Ventas por profesional: quién subió y quién bajó frente a la semana anterior ----
export interface VentaPro { id: string; nombre: string; actual: number; previo: number }
export function novedadesProfesionales(filas: VentaPro[]): Novedad[] {
  const out: Novedad[] = [];
  const cand = filas.filter((f) => f.previo > 0 && f.actual + f.previo >= 100_000).map((f) => ({ ...f, dif: f.actual - f.previo, p: pct(f.actual, f.previo)! }));
  const sube = cand.filter((f) => f.p >= 20 && f.dif >= 80_000).sort((a, b) => b.dif - a.dif)[0];
  const baja = cand.filter((f) => f.p <= -20 && f.dif <= -80_000).sort((a, b) => a.dif - b.dif)[0];
  if (sube) out.push({ id: `pro-sube:${sube.id}`, tipo: "bien", titulo: `${sube.nombre} vendió más`, texto: `Subió ${sube.p}% frente a la semana anterior (+${clp(sube.dif)}). Vale la pena ver qué está haciendo distinto para repetirlo.`, enlace: { href: "/dashboard/reportes", label: "Ver reportes" } });
  if (baja) out.push({ id: `pro-baja:${baja.id}`, tipo: "mal", titulo: `${baja.nombre} vendió menos`, texto: `Bajó ${Math.abs(baja.p)}% frente a la semana anterior (−${clp(baja.dif)}). Revisa su agenda: puede haber horas libres o días sin atender.`, enlace: { href: "/dashboard/calendario", label: "Ver calendario" } });
  return out;
}

// ---- 2. Cambios generales (ventas, clientes nuevos, cancelaciones, reservas por el link) ----
export interface Totales { ventas: number; ventasPrev: number; clientesNuevos: number; clientesNuevosPrev: number; cancelaciones: number; cancelacionesPrev: number; reservasLink: number; reservasLinkPrev: number }
export function novedadesGenerales(t: Totales): Novedad[] {
  const out: Novedad[] = [];
  const pv = pct(t.ventas, t.ventasPrev);
  if (pv !== null && Math.abs(t.ventas - t.ventasPrev) >= 200_000) {
    if (pv >= 15) out.push({ id: "ventas-sube", tipo: "bien", titulo: "Las ventas subieron", texto: `${clp(t.ventas)} esta semana, ${pv}% más que la anterior (+${clp(t.ventas - t.ventasPrev)}).` });
    else if (pv <= -15) out.push({ id: "ventas-baja", tipo: "mal", titulo: "Las ventas bajaron", texto: `${clp(t.ventas)} esta semana, ${Math.abs(pv)}% menos que la anterior (−${clp(t.ventasPrev - t.ventas)}). El mapa de demanda muestra qué horas están más flojas.`, enlace: { href: "/dashboard/demanda", label: "Ver mapa de demanda" } });
  }
  const pc = pct(t.clientesNuevos, t.clientesNuevosPrev);
  if (pc !== null && t.clientesNuevos + t.clientesNuevosPrev >= 8) {
    if (pc >= 30 && t.clientesNuevos - t.clientesNuevosPrev >= 4) out.push({ id: "clientes-suben", tipo: "bien", titulo: "Llegaron más clientes nuevos", texto: `${plural(t.clientesNuevos, "cliente nuevo", "clientes nuevos")} esta semana (${pc}% más que la anterior).` });
    else if (pc <= -30 && t.clientesNuevosPrev - t.clientesNuevos >= 4) out.push({ id: "clientes-bajan", tipo: "mal", titulo: "Llegaron menos clientes nuevos", texto: `${plural(t.clientesNuevos, "cliente nuevo", "clientes nuevos")} esta semana, ${Math.abs(pc)}% menos que la anterior. Comparte tu link de reservas y pide reseñas.`, enlace: { href: "/dashboard/resenas", label: "Ver reseñas" } });
  }
  const pcan = pct(t.cancelaciones, t.cancelacionesPrev);
  if (t.cancelaciones >= 5 && (pcan === null || pcan >= 30) && t.cancelaciones - t.cancelacionesPrev >= 3)
    out.push({ id: "cancelaciones-suben", tipo: "mal", titulo: "Subieron las cancelaciones", texto: `${plural(t.cancelaciones, "cita cancelada o sin asistir", "citas canceladas o sin asistir")} esta semana${pcan !== null ? ` (${pcan}% más que la anterior)` : ""}. Toca el «?» de Cancelaciones para ver quién y por qué.` });
  else if (t.cancelacionesPrev >= 5 && pcan !== null && pcan <= -30 && t.cancelacionesPrev - t.cancelaciones >= 3)
    out.push({ id: "cancelaciones-bajan", tipo: "bien", titulo: "Bajaron las cancelaciones", texto: `${plural(t.cancelaciones, "cita cancelada", "citas canceladas")} esta semana, ${Math.abs(pcan)}% menos que la anterior.` });
  // Reservas por el link: si caen mucho puede haber un problema (link roto, reservas apagadas, otro enlace en redes).
  if (t.reservasLinkPrev >= 10 && t.reservasLink <= t.reservasLinkPrev * 0.5)
    out.push({ id: "link-cae", tipo: "alerta", titulo: "Las reservas por el link cayeron", texto: `Hubo ${t.reservasLink} reservas por el link esta semana contra ${t.reservasLinkPrev} la anterior. Abre tu link de reservas y comprueba que funcione.`, enlace: { href: "/dashboard/configuracion/reservas", label: "Ir a Reservas" } });
  return out;
}

// ---- 3. Cancelaciones hechas desde una cuenta del equipo ----
export interface CancelPorCuenta { id: string; nombre: string; n: number }
export function novedadesCancelacionesCuenta(filas: CancelPorCuenta[], umbral = 5): Novedad[] {
  return filas.filter((f) => f.n >= umbral).sort((a, b) => b.n - a.n).slice(0, 2).map((f) => ({
    id: `cancela-cuenta:${f.id}`, tipo: "alerta" as const, titulo: `${f.nombre} canceló muchas citas`,
    texto: `Desde su sesión se cancelaron ${f.n} citas esta semana. Conviene revisar el motivo: ¿faltó un horario, hubo permisos o se hizo sin querer?`,
    enlace: { href: "/dashboard/calendario", label: "Ver calendario" },
  }));
}

// ---- 4. Campaña de Retención: quiénes volvieron ----
export interface Campana { nombre: string; enviadaHace: number; cupon: string | null; destinatarios: number; volvieron: number; porLink: number; usaronCupon: number; cuponEnOtraVia: number }
export function novedadCampana(c: Campana | null): Novedad[] {
  if (!c || c.destinatarios === 0 || c.enviadaHace < 3) return [];
  const otra = Math.max(c.volvieron - c.porLink, 0);
  if (c.volvieron === 0) {
    if (c.enviadaHace < 7) return [];
    return [{ id: `campana:${c.nombre}`, tipo: "mal", titulo: "La última campaña no trajo a nadie de vuelta", texto: `«${c.nombre}» llegó a ${c.destinatarios} clientes hace ${c.enviadaHace} días y nadie ha vuelto a agendar. Prueba otro mensaje o un cupón más atractivo.`, enlace: { href: "/dashboard/retencion", label: "Ver Retención" } }];
  }
  const partes = [`${plural(c.porLink, "agendó", "agendaron")} desde el link de reservas`];
  if (otra > 0) partes.push(`${otra} por otra vía${c.cuponEnOtraVia > 0 ? `, y ${plural(c.cuponEnOtraVia, "de ellos mostró", "de ellos mostraron")} el cupón${c.cupon ? ` «${c.cupon}»` : ""}` : ""}`);
  const tasa = Math.round((c.volvieron / c.destinatarios) * 100);
  return [{
    id: `campana:${c.nombre}`, tipo: "bien", titulo: "La campaña de Retención funcionó",
    texto: `«${c.nombre}»: de ${c.destinatarios} clientes, ${plural(c.volvieron, "volvió", "volvieron")} (${tasa}%). ${partes.join("; ")}.`,
    enlace: { href: "/dashboard/retencion", label: "Ver Retención" },
  }];
}

// ---- 5. Alertas operativas ----
export function novedadesAlertas(o: { abonosPorDevolver: number }): Novedad[] {
  const out: Novedad[] = [];
  if (o.abonosPorDevolver > 0) out.push({ id: "abonos-por-devolver", tipo: "alerta", titulo: "Hay abonos por devolver", texto: `${plural(o.abonosPorDevolver, "abono pagado quedó", "abonos pagados quedaron")} con el horario ocupado y espera${o.abonosPorDevolver === 1 ? "" : "n"} una devolución.`, enlace: { href: "/dashboard/abonos", label: "Ver abonos" } });
  return out;
}

const ORDEN: Record<TipoNovedad, number> = { alerta: 0, mal: 1, bien: 2 };
export function ordenarNovedades(n: Novedad[]): Novedad[] {
  return [...n].sort((a, b) => ORDEN[a.tipo] - ORDEN[b.tipo]);
}
