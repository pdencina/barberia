import assert from "node:assert/strict";
import { avisoDeAtencion } from "../src/lib/agente/aviso-atencion";

const img = avisoDeAtencion("t", { telefono: "+56 9 1111 2752", pregunta: "imagen", imagen: true });
assert.equal(img.kind, "whatsapp_attention");
assert.deepEqual(img.roles, ["admin"]);
assert.equal(img.url, "/dashboard/whatsapp-chats");
assert.match(img.body!, /terminado en 2752 envió una imagen/);
const q = avisoDeAtencion("t", { telefono: "56911112752", pregunta: "¿tienen estacionamiento?" });
assert.match(q.body!, /estacionamiento/);
assert.doesNotMatch(q.pushBody!, /estacionamiento/); // pantalla bloqueada sin el texto del cliente
assert.match(avisoDeAtencion("t").body!, /^Un cliente espera respuesta/);
console.log("aviso de atención: OK");
