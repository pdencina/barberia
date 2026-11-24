// Opción Manicure: aparte de la barbería, solo entrega enlaces y no se cruza con reservas, disponibilidad ni IA. Sin red ni base.
// Ejecutar: npx tsx scripts/test-agente-manicure.ts
import assert from "node:assert/strict";
import { respuestaManicure, textoManicure, esTextoManicure, esRespuestaManicure, listaDeManicure, LINK_MANICURE_RESERVA, LINK_MANICURE_TRABAJOS, TEXTO_BOTON_MANICURE } from "../src/lib/agente/manicure";
import { textoDeBoton, textoMenu, listaDeMenu } from "../src/lib/agente/menu";

// Menú: Manicure es de las últimas y la primera fila dice Barbería.
const l = listaDeMenu(textoMenu({ negocio: { nombre: "Estudio Levels", telefono: null, linkReserva: "https://x.cl" } } as any, "saludo"));
assert.deepEqual(l.filas.map((f) => f.title), ["Reservar hora | Barbería", "Información del curso", "Precios y horarios", "Otras preguntas", "Manicure"]);
assert.ok(l.filas.every((f) => f.title.length <= 24));

// Submenú: tres filas con sus botones y títulos válidos.
const sub = listaDeManicure();
assert.deepEqual(sub.filas.map((f) => f.id), ["k_reservar", "k_trabajos", "k_menu"]); assert.ok(sub.filas.every((f) => f.title.length <= 24 && ((f as { description?: string }).description ?? "").length <= 72));
assert.ok(esTextoManicure(textoManicure()) && !esTextoManicure("Hola"));

// Cada botón vuelve como su texto y ese texto produce la respuesta correcta.
for (const [id, txt] of Object.entries(TEXTO_BOTON_MANICURE)) assert.equal(textoDeBoton("interactive", id), txt, id);
assert.equal(respuestaManicure(textoDeBoton("interactive", "m5")!), textoManicure());
assert.equal(respuestaManicure(textoDeBoton("interactive", "k_reservar")!), `Para reservar tu hora de manicure y ver los precios entra aquí:\n${LINK_MANICURE_RESERVA}`);
assert.equal(respuestaManicure(textoDeBoton("interactive", "k_trabajos")!), `Aquí puedes conocer los trabajos de manicure:\n${LINK_MANICURE_TRABAJOS}`);
assert.equal(respuestaManicure(textoDeBoton("interactive", "k_menu")!), null, "'Volver al menú' no es manicure: lo atiende el menú");

// Escrito a mano.
for (const t of ["manicure", "Manicure?", "quiero manicure", "hacen uñas", "hacen pedicure", "tienen esmaltado semipermanente"]) assert.equal(respuestaManicure(t), textoManicure(), t);
for (const t of ["cuanto cuesta una manicure", "quiero hora para manicure", "precio manicure", "quiero reservar manicure"]) assert.ok(respuestaManicure(t)!.includes(LINK_MANICURE_RESERVA) && !respuestaManicure(t)!.includes(LINK_MANICURE_TRABAJOS), t);
for (const t of ["quiero conocer los trabajos de manicure", "tienen fotos de uñas", "ver trabajos de manicure"]) assert.ok(respuestaManicure(t)!.includes(LINK_MANICURE_TRABAJOS) && !respuestaManicure(t)!.includes(LINK_MANICURE_RESERVA), t);

// NO se cruza con la barbería: lo de arriba no activa manicure.
for (const t of ["hola", "quiero reservar una hora", "tienen hora hoy", "reservar hora barbería", "cuanto cuesta un corte", "información del curso", "a que hora abren", "unas gracias", "tienen unas horas para hoy", "1", "2", "3", "4", "5", "quiero hora con felipe meza"]) assert.equal(respuestaManicure(t), null, t);

assert.ok(esRespuestaManicure(respuestaManicure("precio manicure")!) && esRespuestaManicure(respuestaManicure("trabajos de manicure")!) && !esRespuestaManicure("Atendemos de lunes a viernes"));
console.log("OK manicure: menú, submenú, botones, enlaces y sin cruce con la barbería.");
