// Prepara los lotes para probar la IA SIN llave: arma el prompt del clasificador y/o el guiado con el contexto real y reparte los mensajes en lotes.
// Uso: npx tsx scripts/preparar-lotes-ia.ts <carpeta> clasificar|guiar [tamanoLote]
import { readFileSync, writeFileSync } from "node:fs";
import { fragmentar, sistemaPrompt, sistemaGuiado } from "../src/lib/agente/ia-respuesta";
const [carpeta, fase, tam = "16"] = process.argv.slice(2);
const contexto = readFileSync("docs/agente/contexto-levels.txt", "utf8");
const pend: string[] = JSON.parse(readFileSync(`${carpeta}/${fase === "clasificar" ? "pend.json" : "nulos.json"}`, "utf8"));
const sistema = fase === "clasificar" ? sistemaPrompt(fragmentar(contexto), "Estudio Levels") : sistemaGuiado(contexto, "Estudio Levels");
writeFileSync(`${carpeta}/sistema-${fase}.txt`, sistema);
const n = Number(tam); let k = 0;
for (let i = 0; i < pend.length; i += n) { writeFileSync(`${carpeta}/lote-${fase}-${++k}.json`, JSON.stringify(pend.slice(i, i + n), null, 1)); }
console.log(`${pend.length} mensajes en ${k} lotes; prompt de ${sistema.length} caracteres`);
