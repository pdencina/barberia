// Menú como lista de WhatsApp (botones) y saludos con errores de tipeo. Sin red.
// Ejecutar: npx tsx scripts/test-agente-lista.ts
import assert from "node:assert/strict";
import { textoDeBoton, pideInfoCursoGeneral, textoCurso, esTextoCurso, listaDeCurso, esSaludo, esSoloSaludo, textoMenu, esTextoMenu, listaDeMenu, opcionMenu } from "../src/lib/agente/menu";
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
  assert.deepEqual(l.filas.map(f => opcionMenu(textoDeBoton("interactive", f.id) ?? "")), [1, 2, 3, 4], "cada fila vuelve como su número");
  assert.equal(textoDeBoton("text", "m1"), null, "un texto escrito no es un botón"); assert.equal(textoDeBoton("interactive", "otro"), null); assert.equal(textoDeBoton("interactive", "__proto__"), null);
  for (const t of ["no_entendi", "volver"] as const) assert.ok(listaDeMenu(textoMenu(datos, t)).cuerpo.length > 10);

  const llamadas: any[] = [];
  const deps = (st = 200) => ({ token: "t", version: "v20.0", phone_number_id: "123", fetch: async (u: string, o: any) => { llamadas.push({ u, o }); return { status: st, json: async () => ({ messages: [{ id: "wamid.1" }] }) }; } });
  assert.equal((await enviarLista({ para: "56912345678", ...l }, deps())).estado, "aceptado");
  const m = JSON.parse(llamadas[0].o.body); assert.equal(m.type, "interactive"); assert.equal(m.interactive.type, "list");
  assert.equal(m.interactive.action.button, "Ver opciones"); assert.equal(m.interactive.action.sections[0].rows.length, 4); assert.equal(m.interactive.action.sections[0].rows[0].id, "m1");
  assert.equal((await enviarLista({ para: "56912345678", ...l, boton: "x".repeat(21) }, deps())).estado, "fallido");
  assert.equal((await enviarLista({ para: "56912345678", ...l, filas: [] }, deps())).estado, "fallido");
  assert.notEqual((await enviarLista({ para: "56912345678", ...l }, deps(400))).estado, "aceptado");
  // Submenú del curso
  for (const t of ["información del curso", "Quiero saber del curso", "Del curso", "info curso", "quiero información sobre el curso"]) assert.ok(pideInfoCursoGeneral(t), t);
  for (const t of ["cuánto cuesta el curso", "me envías la malla del curso", "cuando parte el curso", "desde que edad es el curso", "hola", "quiero reservar un corte"]) assert.ok(!pideInfoCursoGeneral(t), t);
  assert.ok(esTextoCurso(textoCurso())); assert.ok(!esTextoCurso("Hola"));
  const lc = listaDeCurso(); assert.equal(lc.filas.length, 6); assert.ok(lc.filas.every(f => f.title.length <= 24));
  assert.deepEqual(lc.filas.map(f => f.id), ["c_malla", "c_valor", "c_fechas", "c_video", "c_otras", "c_menu"]);
  assert.match(textoDeBoton("interactive", "c_malla")!, /malla/); assert.equal(textoDeBoton("interactive", "c_otras"), "4"); assert.equal(textoDeBoton("interactive", "c_menu"), "menú");
  llamadas.length = 0; assert.equal((await enviarLista({ para: "56912345678", ...lc }, deps())).estado, "aceptado"); assert.equal(JSON.parse(llamadas[0].o.body).interactive.action.sections[0].rows.length, 6);
  console.log("OK menú en lista (botones) y saludos con tipeo (sin red).");
})();
