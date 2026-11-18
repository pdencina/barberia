// Archivos que el agente envía cuando el cliente los pide (malla del curso, folletos). Solo negocios autorizados aquí.
// Provisorio: cuando exista una pantalla para subir archivos por negocio, esta lista pasa a la base de datos.
export interface ArchivoCatalogo { clave: string; ruta: string; nombre: string; mime: string; caption: string; pide: RegExp }

export const NEGOCIOS_CON_ARCHIVOS: readonly RegExp[] = [/levels-pruebas-/i, /\/(?:b\/)?estudiolevels\/?$/i]; // se compara con el enlace de reservas del negocio
export const CATALOGO_ARCHIVOS: readonly ArchivoCatalogo[] = [
  { clave: "malla-curso", ruta: "src/lib/agente/archivos/levels/malla-curso.pdf", nombre: "Malla curso barbería.pdf", mime: "application/pdf",
    caption: "Aquí tienes la malla del curso de barbería.",
    pide: /\b(malla|temario|brochure|folleto|flyer)\b|(contenidos?|programa|plan de estudios?)\s+(del|de)\s+(el\s+)?curso/i },
];

export function negocioConArchivos(linkReserva: string | null | undefined): boolean {
  return typeof linkReserva === "string" && NEGOCIOS_CON_ARCHIVOS.some((r) => r.test(linkReserva));
}
export function archivosPedidos(texto: unknown, linkReserva: string | null | undefined): ArchivoCatalogo[] {
  if (typeof texto !== "string" || !negocioConArchivos(linkReserva)) return [];
  return CATALOGO_ARCHIVOS.filter((a) => a.pide.test(texto));
}

// Enlaces que se responden tal cual (sin IA): el video de presentación del curso. Confirmado por Nico el 18 nov. 2026
// (youtube: "Información curso de barbería Estudio Levels", canal @estudiolevels).
export const ENLACES_CATALOGO: ReadonlyArray<{ clave: string; pide: RegExp; texto: string }> = [
  { clave: "video-curso", pide: /\b(videos?|presentacion|presentación)\b/i, texto: "Mira el video de presentación del curso de barbería aquí:\nhttps://youtu.be/Cv4-g-LBzXo" },
];
export function enlacesPedidos(texto: unknown, linkReserva: string | null | undefined): string[] {
  if (typeof texto !== "string" || !negocioConArchivos(linkReserva) || /videollamada|video ?llamada/i.test(texto)) return [];
  return ENLACES_CATALOGO.filter((e) => e.pide.test(texto)).map((e) => e.texto);
}
