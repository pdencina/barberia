import assert from "node:assert/strict";
import { respuestaDeAtraso } from "../src/lib/agente/atraso";

const regla = "Gracias por avisarnos 🙌 Podemos esperarte *máximo 10 minutos*. Pasado ese tiempo, queda sujeto a disponibilidad.";
const datos: any = { personalizadas: [{ claves: ["aviso de atraso"], respuesta: regla }] };
for (const t of ["Voy algo atrasado, pero llego", "voy un poco tarde", "Estoy atrasada", "llegaré 10 minutos tarde", "me atrasé, perdón", "Voy a llegar un poco atrasado", "si llego tarde me esperan?", "llego en 10 minutos tarde"])
  assert.equal(respuestaDeAtraso(t, datos), regla, t);
assert.equal(respuestaDeAtraso("El Uber se demoró", datos), "Entendido, gracias por avisar. Podemos esperarte *máximo 10 minutos*.");
for (const t of ["quiero agendar, salgo tarde del trabajo", "tienen hora más tarde?", "quiero atrasar mi hora", "mañana llego tarde", "una hora en la tarde", "hola"])
  assert.equal(respuestaDeAtraso(t, datos), null, t);
assert.equal(respuestaDeAtraso("voy atrasado", { personalizadas: [] } as any), null); // sin regla del negocio: como siempre
console.log("aviso de atraso: OK");
