// Archivo de contactos (.vcf) para armar una Lista de difusión en el teléfono: cada contacto lleva una etiqueta para buscarlo.
import { formatPhoneCL } from "./phone";

/** Máximo de contactos que admite una lista de difusión de WhatsApp. */
export const MAX_POR_DIFUSION = 256;
const limpio = (t: string) => t.replace(/[\r\n]+/g, " ").replace(/([\;,])/g, "\\$1").trim();

export function contactosVcf(clientes: { name: string; phone: string | null }[], etiqueta: string): { total: number; texto: string } {
  const vistos = new Set<string>();
  const tarjetas: string[] = [];
  for (const c of clientes) {
    const tel = c.phone ? formatPhoneCL(c.phone) : "";
    if (tel.replace(/\D/g, "").length < 11 || vistos.has(tel)) continue;
    vistos.add(tel);
    const grupo = Math.floor(tarjetas.length / MAX_POR_DIFUSION);
    const nombre = limpio(`${etiqueta}${grupo ? ` G${grupo + 1}` : ""} ${c.name || "Cliente"}`);
    tarjetas.push(["BEGIN:VCARD", "VERSION:3.0", `N:;${nombre};;;`, `FN:${nombre}`, `TEL;TYPE=CELL:${tel}`, "END:VCARD"].join("\r\n"));
  }
  return { total: tarjetas.length, texto: tarjetas.length ? tarjetas.join("\r\n") + "\r\n" : "" };
}
