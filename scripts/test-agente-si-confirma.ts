// "Si" a secas tras la confirmación de la hora: se reconoce; negaciones, preguntas y otros textos, no.
import assert from "node:assert/strict";
import { esSiDeConfirmacion } from "../src/lib/agente/respuesta-cliente";
for (const t of ["Si", "sí", "Siii", "Si!", "Sí, gracias", "si voy", "sipo", "dale", "ok", "Confirmado", "claro que no".slice(0, 5), "sí 👍", "👍", "👍🏽", "ahí estaré", "si confirmo bro", "ya po"]) assert.equal(esSiDeConfirmacion(t), true, t);
for (const t of ["no", "si no puedo", "sí, pero más tarde", "si quiero cambiar la hora", "¿si?", "a las 5 si", "1", "hola", "claro que no", "cancelar", "gracias", "sinceramente no", "👎"]) assert.equal(esSiDeConfirmacion(t), false, t);
console.log("OK si-confirma");
