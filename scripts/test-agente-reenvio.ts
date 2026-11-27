import assert from "node:assert/strict";
import { esConsultable } from "../src/lib/agente/whatsapp-webhook";

for (const t of ["tienen estacionamiento?", "El Uber se demoró", "me puedo teñir embarazada", "necesito factura para mi empresa"]) assert.ok(esConsultable(t), t);
for (const t of ["hola", "buenas tardes", "asdf", "2", "ok", "👍", "12:30"]) assert.ok(!esConsultable(t), t);
console.log("reenvío al dueño: OK");
