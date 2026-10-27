// npx tsx scripts/test-agente-webhook-firma.ts — solo secretos sintéticos/vectores públicos.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verificarFirmaWebhook as verificar } from "../src/lib/agente/webhook-firma";

let casos = 0;
function check(nombre: string, actual: boolean, esperado: boolean) {
  casos++;
  assert.equal(actual, esperado, nombre); // No imprimir cuerpo, secreto ni firma.
}
const secreto = "secreto-sintetico-de-prueba";
const cuerpo = '{"message":"prueba"}';
const firmar = (data: string | Uint8Array, key: string | Uint8Array = secreto) =>
  `sha256=${createHmac("sha256", key).update(data).digest("hex")}`;
const firma = firmar(cuerpo);

// HECHO: vectores RFC 4231 §4.2 y §4.3, consulta 2026-10-26.
// https://www.rfc-editor.org/rfc/rfc4231#section-4.2
check("vector público RFC1", verificar("sha256=b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7", "Hi There", Buffer.alloc(20, 0x0b)), true);
check("vector público RFC2", verificar("sha256=5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843", "what do ya want for nothing?", "Jefe"), true);
check("válida", verificar(firma, cuerpo, secreto), true);
check("hex mayúscula", verificar(`sha256=${firma.slice(7).toUpperCase()}`, cuerpo, secreto), true);
check("hex mixta", verificar(`sha256=${firma.slice(7).split("").map((c, i) => i % 2 ? c.toUpperCase() : c).join("")}`, cuerpo, secreto), true);
check("prefijo mayúscula rechazado", verificar(firma.replace("sha256", "SHA256"), cuerpo, secreto), false);
for (const [nombre, valor] of [
  ["vacía", ""], ["sin prefijo", firma.slice(7)], ["prefijo mal", firma.replace("sha256", "sha-256")],
  ["igual ausente", firma.replace("=", "")], ["espacio previo", ` ${firma}`], ["espacio final", `${firma} `],
  ["salto final", `${firma}\n`], ["retorno final", `${firma}\r`], ["hex corto", firma.slice(0, -1)],
  ["hex largo", `${firma}0`], ["no hexadecimal", `sha256=${"g".repeat(64)}`],
  ["doble cabecera", `${firma},${firma}`], ["nulo", null], ["undefined", undefined], ["objeto", {}],
] as const) check(`cabecera ${nombre}`, verificar(valor, cuerpo, secreto), false);
check("secreto incorrecto", verificar(firma, cuerpo, "otro-secreto-sintetico"), false);
for (const key of ["", " ", null, undefined, Buffer.alloc(0), 1, {}]) check("secreto inválido", verificar(firma, cuerpo, key), false);
for (const data of [null, undefined, 1, {}, [1, 2]]) check("cuerpo inválido", verificar(firma, data, secreto), false);
check("cuerpo alterado", verificar(firma, `${cuerpo} `, secreto), false);
check("JSON reserializado no equivale a crudo", verificar(firma, '{ "message": "prueba" }', secreto), false);
check("cuerpo vacío con firma propia válida", verificar(firmar(""), "", secreto), true);
check("firma de otro cuerpo no valida vacío", verificar(firma, "", secreto), false);

const unicode = "Texto de prueba: ñ, é, 🧪\n";
check("Unicode string UTF8", verificar(firmar(unicode), unicode, secreto), true);
check("Unicode bytes UTF8", verificar(firmar(unicode), Buffer.from(unicode, "utf8"), secreto), true);
check("Unicode no normalizado", verificar(firmar("é"), "e\u0301", secreto), false);
const binario = Buffer.from([0, 255, 128, 10, 13]);
const copia = Buffer.from(binario);
check("bytes no UTF8", verificar(firmar(binario), binario, secreto), true);
assert.deepEqual(binario, copia, "No mutar cuerpo");
const vista = new Uint8Array([99, 0, 255, 128, 10, 13, 88]).subarray(1, 6);
check("vista con offset", verificar(firmar(binario), vista, secreto), true);
const grande = Buffer.alloc(2 * 1024 * 1024, 97);
const firmaGrande = firmar(grande);
check("2 MiB válidos", verificar(firmaGrande, grande, secreto), true);
for (const index of [0, Math.floor(grande.length / 2), grande.length - 1]) {
  const alterado = Buffer.from(grande);
  alterado[index] ^= 1;
  check("2 MiB un byte modificado", verificar(firmaGrande, alterado, secreto), false);
}
for (let i = 7; i < firma.length; i++) {
  const alterada = firma.slice(0, i) + (firma[i] === "0" ? "1" : "0") + firma.slice(i + 1);
  check(`un dígito alterado ${i - 7}`, verificar(alterada, cuerpo, secreto), false);
}
console.log(`OK: ${casos} casos HMAC genéricos; sin entorno/red/base ni salida de secretos/cuerpos.`);
