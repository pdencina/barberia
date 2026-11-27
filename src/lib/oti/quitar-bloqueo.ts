// «Elimina todos los bloqueos de Nicolás Levels», «borra mis bloqueos», «desbloquea mi agenda». Regla simple, sin IA: nunca adivina entre dos personas.
import type { MiembroEquipo } from "./bloqueo";
import { norm } from "./texto";

export type PedidoQuitar =
  | { ok: true; profesional: MiembroEquipo }
  | { ok: false; falta: "profesional" | "ambiguo"; candidatos?: MiembroEquipo[] };

const PIDE = /\b(elimin\w*|borr\w*|quit\w*|sac[ao]\w*|limpi\w*|anul\w*)\b[^.]*\bbloqueos?\b|\bdesbloque(a|ar|ame|en)\b[^.]*\b(agenda|horario|horas|dias|calendario|todo)\b|\bdesbloqueame\b/;
const PREGUNTA = /^(como|donde|cual|cuales|que|por que|quien)\b/;

export function entenderQuitarBloqueo(texto: string, equipo: MiembroEquipo[], yoId?: string | null): PedidoQuitar | null {
  const t = norm(texto);
  if (!PIDE.test(t) || PREGUNTA.test(t)) return null;
  const yo = equipo.find((m) => m.id === yoId) ?? null;
  // Nombre completo: si calzan «Nicolas» y «Nicolas Levels», gana el más largo.
  const completos = equipo.filter((m) => norm(m.name) && ` ${t} `.includes(` ${norm(m.name)} `)).sort((a, b) => norm(b.name).length - norm(a.name).length);
  if (completos.length) {
    const mejores = completos.filter((m) => norm(m.name).length === norm(completos[0].name).length);
    return mejores.length > 1 ? { ok: false, falta: "ambiguo", candidatos: mejores } : { ok: true, profesional: mejores[0] };
  }
  if (yo && /\b(mis|mi|desbloqueame|eliminame mis)\b/.test(t)) return { ok: true, profesional: yo };
  const porNombre = equipo.filter((m) => { const p = norm(m.name).split(" ")[0]; return p.length >= 3 && new RegExp(`\\b${p}\\b`).test(t); });
  if (porNombre.length > 1) return { ok: false, falta: "ambiguo", candidatos: porNombre };
  if (porNombre.length === 1) return { ok: true, profesional: porNombre[0] };
  // Sin nombrar a nadie: los de quien escribe, si atiende. «de <otro nombre>» que no calza no se adivina.
  if (yo && !/\bde (?!(la|las|los|el|mi|mis|aqui|hoy|ahora|este|esta|todos)\b)[a-z]{3,}/.test(t)) return { ok: true, profesional: yo };
  return { ok: false, falta: "profesional" };
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export interface DiaHorario { day_of_week: number; is_working: boolean | null; start_time: string | null; end_time: string | null }

/** «lunes a viernes 06:00–10:00», «sábado 06:00–09:00», «domingo libre». */
export function resumenHorario(filas: DiaHorario[]): string[] {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const horas = (d: number) => {
    const f = filas.find((x) => x.day_of_week === d);
    return f && f.is_working ? `${String(f.start_time).slice(0, 5)}–${String(f.end_time).slice(0, 5)}` : "libre";
  };
  const out: Array<{ desde: number; hasta: number; h: string }> = [];
  for (const d of orden) {
    const h = horas(d), u = out[out.length - 1];
    if (u && u.h === h) u.hasta = d; else out.push({ desde: d, hasta: d, h });
  }
  return out.map((g) => `${g.desde === g.hasta ? DIAS[g.desde] : `${DIAS[g.desde]} a ${DIAS[g.hasta]}`} ${g.h}`);
}
