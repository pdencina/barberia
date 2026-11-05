// Menú de opciones del agente: saludos, números elegidos y consultas largas. Sin red, base ni llaves.
import assert from "node:assert/strict";
import { esSaludo, esSoloSaludo, esVolver, opcionMenu, esConsultaLarga, textoMenu } from "../src/lib/agente/menu";

for (const t of ["Hola", "hola!", "Holaaa", "buenas", "Buenos días", "hola buenas tardes", "Hey", "¡Hola!"]) assert.equal(esSaludo(t), true, t);
for (const t of ["hola quiero reservar con camila mañana", "quiero una hora", "asdf", ""]) assert.equal(esSaludo(t), false, t);

for (const [t, o] of [["1", 1], [" 2 ", 2], ["3.", 3], ["4)", 4], ["opción 2", 2], ["opcion 3", 3], ["la 4", 4], ["el 1", 1], ["numero 2", 2]] as const) assert.equal(opcionMenu(t), o, t);
for (const t of ["5", "0", "12", "1 y 2", "quiero la 4 por favor", "hola", "2 cortes", "a las 3"]) assert.equal(opcionMenu(t), null, t);

assert.equal(esConsultaLarga("quien es el mejor"), false);
assert.equal(esConsultaLarga("hola buenas tardes quisiera saber si hacen peinados"), true);

const datos: any = { negocio: { nombre: "Estudio Levels", direccion: null, telefono: "+56942666172", linkReserva: null }, horario: [], servicios: [], profesionales: [] };
const m = textoMenu(datos, "no_entendi");
assert.ok(m.startsWith("No entendí lo que me escribes. Por favor elige una de estas opciones:\n\n1. Deseo reservar.\n2. Quiero información del curso.\n3. Quiero información de precios, horarios y ubicación.\n4. Otras preguntas."));
assert.ok(m.endsWith("Si tienes dudas, llámanos al +56942666172, con gusto te atenderemos."));
assert.ok(textoMenu(datos, "saludo").startsWith("¡Hola! Soy el asistente de Estudio Levels. ¿En qué te puedo ayudar? Elige una opción:"));
assert.ok(!textoMenu({ ...datos, negocio: { ...datos.negocio, telefono: "Comercial A" } }, "saludo").includes("llámanos"), "teléfono inválido no se muestra");
assert.ok(!textoMenu(null, "saludo").includes("Soy el asistente"), "sin datos, saludo genérico");
for (const t of ["menú", "menu", "Menu!", "quiero abrir el menu", "volver al menú", "volver", "empezar de nuevo", "quiero empezar de nuevo", "salir", "cancelar", "de nuevo", "ver el menú"]) assert.equal(esVolver(t), true, t);
for (const t of ["quiero reservar", "hola", "el menú de precios del curso de barbería por favor", "volvemos mañana a las 4", "juan perez juan@correo.cl 1"]) assert.equal(esVolver(t), false, t);
for (const t of ["hola", "Hola!", "holaaa", "buenas tardes", "hola buenas tardes", "buenos días", "hola como estas", "hey"]) assert.equal(esSoloSaludo(t), true, t);
for (const t of ["hola quiero reservar", "hola quiero hora con camila", "quiero reservar", "hola juan perez juan@correo.cl", ""]) assert.equal(esSoloSaludo(t), false, t);
assert.ok(textoMenu(datos, "volver").startsWith("Volvamos al inicio. Elige una opción:"));
console.log("OK menu: saludos, opciones numéricas, consulta larga y textos del menú.");
