// Procesa lo que devolvieron los lotes de la IA (sin llave): valida con las MISMAS reglas del producto y arma el mapa mensaje→respuesta.
// Uso: npx tsx scripts/procesar-lotes-ia.ts <carpeta> clasificar|guiar
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fragmentar, leerElegidos, leerGuiada, MAX_RESPUESTA_IA } from "../src/lib/agente/ia-respuesta";
import { conLlamadaAReservar } from "../src/lib/agente/cta";
const [carpeta, fase] = process.argv.slice(2);
const contexto = readFileSync("docs/agente/contexto-levels.txt", "utf8"), frag = fragmentar(contexto);
const archivos = readdirSync(carpeta).filter((f) => new RegExp(`^res-${fase}-\\d+\\.json$`).test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
const mapaPath = `${carpeta}/ia-mapa.json`, mapa: Record<string, string> = existsSync(mapaPath) ? JSON.parse(readFileSync(mapaPath, "utf8")) : {};
const nulos: string[] = []; let ok = 0, malos = 0;
for (const a of archivos) for (const r of JSON.parse(readFileSync(`${carpeta}/${a}`, "utf8")) as Array<{ mensaje: string; salida: string }>) {
  if (fase === "clasificar") {
    const ids = leerElegidos(r.salida, frag.length);
    if (!ids) { nulos.push(r.mensaje); continue; }
    const resp = Array.from(new Set(ids.map((n) => frag[n - 1].respuesta))).join("\n\n");
    if (resp && resp.length <= MAX_RESPUESTA_IA) { mapa[r.mensaje] = resp; ok++; } else { nulos.push(r.mensaje); malos++; }
  } else {
    const t = leerGuiada(r.salida, contexto);
    if (t) { mapa[r.mensaje] = t; ok++; } else malos++;
  }
}
writeFileSync(mapaPath, JSON.stringify(mapa, null, 1));
if (fase === "clasificar") writeFileSync(`${carpeta}/nulos.json`, JSON.stringify(nulos, null, 1));
console.log(`${fase}: ${archivos.length} lotes; respondidos ${ok}; ${fase === "clasificar" ? `sin línea (van a la etapa guiada) ${nulos.length}` : `descartados por la validación ${malos}`}`);
