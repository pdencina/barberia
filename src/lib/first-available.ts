// "Primer profesional disponible": solo puede quedar alguien que REALMENTE tenga horas libres ese dia.
// Antes se descartaba unicamente a quien tenia el DIA COMPLETO bloqueado; un bloqueo por horas (por ejemplo 10:00-20:00),
// un break o una agenda llena no se miraban, y el sistema asignaba a un profesional que no podia atender.
// La verdad sobre las horas libres la tiene /api/public/availability (bloqueos, breaks, citas, horario, vacaciones...):
// aqui solo se usa su respuesta, sin repetir esa logica.

/**
 * @param getSlots devuelve las horas libres del profesional ese dia, o `null` si no se pudo saber (error de red, respuesta rara).
 * @param slot si el cliente ya eligio una hora ("YYYY-MM-DDTHH:MM:SS"), el profesional debe tener esa hora libre.
 * Quien tiene `null` (no se pudo consultar) se deja en la lista: un fallo tecnico no debe dejar al cliente sin nadie.
 */
export async function barbersWithFreeTime<T extends { id: string }>(
  barbers: T[],
  getSlots: (barberId: string) => Promise<string[] | null>,
  slot?: string | null
): Promise<T[]> {
  const wanted = slot ? slot.slice(0, 16) : null; // compara hasta el minuto
  const checked = await Promise.all(
    barbers.map(async (b) => {
      let slots: string[] | null;
      try { slots = await getSlots(b.id); } catch { slots = null; }
      if (slots === null) return { b, ok: true };
      if (slots.length === 0) return { b, ok: false };
      return { b, ok: wanted ? slots.some((s) => s.slice(0, 16) === wanted) : true };
    })
  );
  return checked.filter((c) => c.ok).map((c) => c.b);
}

/**
 * Horas libres del PRIMER dia (de la lista) que tenga alguna. Sirve cuando el cliente aun no eligio fecha: basta que el profesional
 * tenga horas en alguno de los proximos dias. Devuelve `[]` si ningun dia tiene horas y `null` si algun dia no se pudo consultar
 * (error tecnico: en ese caso no se descarta al profesional).
 */
export async function firstDayWithSlots(dates: string[], fetchDay: (date: string) => Promise<string[] | null>): Promise<string[] | null> {
  for (const d of dates) {
    const slots = await fetchDay(d);
    if (slots === null) return null;
    if (slots.length > 0) return slots;
  }
  return [];
}
