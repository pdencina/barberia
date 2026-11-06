// Menú como lista de WhatsApp (botones) y saludos con errores de tipeo. Sin red.
// Ejecutar: npx tsx scripts/test-agente-lista.ts
import assert from "node:assert/strict";
import { esSaludo, esSoloSaludo, textoMenu, esTextoMenu, listaDeMenu, opcionMenu } from "../src/lib/agente/menu";
import { enviarLista } from "../src/lib/agente/whatsapp-meta";

(async () => {
  for (const t of ["hola", "holla", "holaa", "ola", "hoola", "hola!", "holi", "holla!!"]) { assert.ok(esSaludo(t), t); assert.ok(esSoloSaludo(t), t); }
  assert.ok(!esSoloSaludo("hola quiero reservar"));
  const datos: any = { negocio: { nombre: "Estudio Levels", telefono: "+56 9 4266 6172", linkReserva: "https://x.cl/b/y" } };
  const txt = textoMenu(datos, "saludo");
  assert.ok(esTextoMenu(txt)); assert.ok(!esTextoMenu("Hola, ¿en qué te ayudo?"));
  const l = listaDeMenu(txt);
  assert.ok(!/1\. Deseo/.test(l.cuerpo) && l.cuerpo.includes("en el botón") && l.cuerpo.includes("+56 9 4266 6172"), l.cuerpo);
  assert.equal(l.filas.length, 4); assert.ok(l.boton.length <= 20 && l.filas.every(f => f.title.length <= 24));
  assert.deepEqual(l.filas.map(f => opcionMenu(f.id)), [1, 2, 3, 4], "cada fila vuelve como su número");
  for (const t of ["no_entendi", "volver"] as const) assert.ok(listaDeMenu(textoMenu(datos, t)).cuerpo.length > 10);

  const llamadas: any[] = [];
  const deps = (st = 200) => ({ token: "t", version: "v20.0", phone_number_id: "123", fetch: async (u: string, o: any) => { llamadas.push({ u, o }); return { status: st, json: async () => ({ messages: [{ id: "wamid.1" }] }) }; } });
  assert.equal((await enviarLista({ para: "56912345678", ...l }, deps())).estado, "aceptado");
  const m = JSON.parse(llamadas[0].o.body); assert.equal(m.type, "interactive"); assert.equal(m.interactive.type, "list");
  assert.equal(m.interactive.action.button, "Ver opciones"); assert.equal(m.interactive.action.sections[0].rows.length, 4); assert.equal(m.interactive.action.sections[0].rows[0].id, "1");
  assert.equal((await enviarLista({ para: "56912345678", ...l, boton: "x".repeat(21) }, deps())).estado, "fallido");
  assert.equal((await enviarLista({ para: "56912345678", ...l, filas: [] }, deps())).estado, "fallido");
  assert.notEqual((await enviarLista({ para: "56912345678", ...l }, deps(400))).estado, "aceptado");
  console.log("OK menú en lista (botones) y saludos con tipeo (sin red).");
})();
