// Archivos del agente (malla del curso) y cierre del curso sin "agendar". Sin red: fetch simulado.
// Ejecutar: npx tsx scripts/test-agente-archivos.ts
import assert from "node:assert/strict";
import { archivosPedidos } from "../src/lib/agente/archivos";
import { enviarArchivo } from "../src/lib/agente/whatsapp-meta";
import { conLlamadaAReservar } from "../src/lib/agente/cta";

const LEVELS = "https://www.re-booking.cl/b/estudiolevels", PRUEBAS = "https://www.re-booking.cl/b/levels-pruebas-0xrf", OTRO = "https://www.re-booking.cl/b/otra-barberia";
(async () => {
  assert.equal(archivosPedidos("me envías la malla del curso?", PRUEBAS).length, 1);
  assert.equal(archivosPedidos("cual es el temario", LEVELS).length, 1);
  assert.equal(archivosPedidos("quiero ver el programa del curso", LEVELS).length, 1);
  assert.equal(archivosPedidos("cuanto cuesta el curso", LEVELS).length, 0);
  assert.equal(archivosPedidos("me envías la malla del curso?", OTRO).length, 0, "otros negocios no envían archivos");
  assert.equal(archivosPedidos("malla", null).length, 0);
  assert.equal(archivosPedidos(5, LEVELS).length, 0);

  const llamadas: any[] = [];
  const deps = (st: number[] = [200, 200]) => ({ token: "t", version: "v20.0", phone_number_id: "123", fetch: async (url: string, o: any) => { llamadas.push({ url, o }); const s = st[llamadas.length - 1] ?? 200; return { status: s, json: async () => (url.endsWith("/media") ? { id: "MEDIA1" } : { messages: [{ id: "wamid.X" }] }) }; } });
  const arch = { nombre: "Malla.pdf", mime: "application/pdf", bytes: new Uint8Array([1, 2, 3]), caption: "Aquí va" };
  const r = await enviarArchivo({ para: "56912345678", archivo: arch }, deps());
  assert.equal(r.estado, "aceptado"); assert.equal(llamadas.length, 2);
  assert.ok(llamadas[0].url.endsWith("/123/media")); assert.ok(llamadas[0].o.body instanceof FormData);
  const msg = JSON.parse(llamadas[1].o.body); assert.equal(msg.type, "document"); assert.deepEqual(msg.document, { id: "MEDIA1", filename: "Malla.pdf", caption: "Aquí va" }); assert.equal(msg.to, "56912345678");
  llamadas.length = 0;
  assert.equal((await enviarArchivo({ para: "56912345678", archivo: { ...arch, mime: "image/png", nombre: "a.png" } }, deps())).estado, "aceptado");
  assert.equal(JSON.parse(llamadas[1].o.body).type, "image");
  llamadas.length = 0;
  assert.equal((await enviarArchivo({ para: "56912345678", archivo: arch }, deps([500]))).estado, "fallido"); assert.equal(llamadas.length, 1, "si la subida falla no envía");
  assert.equal((await enviarArchivo({ para: "56912345678", archivo: { ...arch, mime: "application/x-sh" } }, deps())).estado, "fallido");
  assert.equal((await enviarArchivo({ para: "56912345678", archivo: { ...arch, bytes: new Uint8Array(6 * 1024 * 1024) } }, deps())).estado, "fallido");
  assert.equal((await enviarArchivo({ para: "abc", archivo: arch }, deps())).estado, "fallido");

  // Cierre acorde: del curso → volver al menú, nunca "¿Quieres agendar?"
  const c = conLlamadaAReservar("El curso tiene 11 clases.", LEVELS);
  assert.ok(c.endsWith("Escribe *menú* para volver al inicio.") && !c.includes("agendar") && !c.includes("http"));
  assert.ok(!conLlamadaAReservar("Aceptamos tarjetas.", LEVELS, "cuanto cuesta el curso").includes("agendar"));
  assert.ok(conLlamadaAReservar("El corte cuesta $17.000.", LEVELS).includes("¿Quieres agendar? Reserva aquí:"));
  assert.equal(conLlamadaAReservar("Curso. Escribe menú.", LEVELS), "Curso. Escribe menú.");
  console.log("OK archivos del agente y cierre del curso (sin red).");
})();
