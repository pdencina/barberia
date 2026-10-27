// npx tsx scripts/test-agente-clave-deduplicacion.ts — entradas sintéticas, sin red/base/llaves.
import assert from "node:assert/strict";
import { crearClaveEnvio as envio, crearClaveEventoEntrante as entrada, type DatosClaveEnvio, type DatosClaveEvento } from "../src/lib/agente/clave-deduplicacion";

let casos = 0;
function check(nombre: string, condicion: boolean) { casos++; assert.ok(condicion, nombre); }
const base: DatosClaveEnvio = Object.freeze({ tenantId: "tenant-sintetico-a", fechaInformada: "2026-10-26", finalidad: "informe-diario", canal: "email" });
const evento: DatosClaveEvento = Object.freeze({ tenantId: base.tenantId, referenciaProveedor: "proveedor:referencia-sintetica" });
const key = envio(base);
const eventKey = entrada(evento);
check("estable envío", key === envio({ ...base }));
check("estable evento", eventKey === entrada({ ...evento }));
check("orden de propiedades no importa", key === envio({ canal: "email", finalidad: base.finalidad, fechaInformada: base.fechaInformada, tenantId: base.tenantId }));
check("formato envío solo prefijo y hash", /^agente-envio-v1:[a-f0-9]{64}$/.test(key));
check("formato evento solo prefijo y hash", /^agente-entrada-v1:[a-f0-9]{64}$/.test(eventKey));
check("entrada/salida separadas", eventKey !== key);
check("cambia negocio envío", key !== envio({ ...base, tenantId: "tenant-sintetico-b" }));
check("cambia negocio evento", eventKey !== entrada({ ...evento, tenantId: "tenant-sintetico-b" }));
check("cambia fecha", key !== envio({ ...base, fechaInformada: "2026-10-27" }));
check("cambia finalidad", key !== envio({ ...base, finalidad: "recordatorio" }));
check("cambia canal", key !== envio({ ...base, canal: "whatsapp" }));
check("cambia referencia", eventKey !== entrada({ ...evento, referenciaProveedor: "otra-ref" }));
check("referencia distingue mayúsculas", entrada({ ...evento, referenciaProveedor: "ABC" }) !== entrada({ ...evento, referenciaProveedor: "abc" }));
check("tuplas evitan ambigüedad por dos puntos", entrada({ tenantId: "a:b", referenciaProveedor: "c" }) !== entrada({ tenantId: "a", referenciaProveedor: "b:c" }));
check("tuplas evitan ambigüedad por barra", entrada({ tenantId: "a|b", referenciaProveedor: "c" }) !== entrada({ tenantId: "a", referenciaProveedor: "b|c" }));
check("Unicode estable", entrada({ ...evento, referenciaProveedor: "referencia-ñ-🧪" }) === entrada({ ...evento, referenciaProveedor: "referencia-ñ-🧪" }));
check("Unicode exacto sin mezclar bytes", entrada({ ...evento, referenciaProveedor: "é" }) !== entrada({ ...evento, referenciaProveedor: "e\u0301" }));
check("año nuevo separa envío", envio({ ...base, fechaInformada: "2026-12-31" }) !== envio({ ...base, fechaInformada: "2027-01-01" }));
check("bisiesto real aceptado", !!envio({ ...base, fechaInformada: "2028-02-29" }));
const privadoSintetico = "ref-prueba@example.invalid-11.111.111-1";
const privada = entrada({ ...evento, referenciaProveedor: privadoSintetico });
check("no refleja referencia original", !privada.includes(privadoSintetico) && !privada.includes(evento.tenantId) && !privada.includes("@"));

function rechaza(nombre: string, callback: () => unknown) {
  casos++;
  assert.throws(callback, (e: unknown) => e instanceof Error && e.message === "Parámetros de deduplicación inválidos", nombre);
}
for (const fechaInformada of ["2026-02-31", "2026-04-31", "2026-02-29", "1900-02-29", "0000-01-01", "2026-13-01", "2026-00-01", "2026-01-00", "2026-1-01", "2026-01-01\n", "", "ayer"]) {
  rechaza("fecha inválida sin eco", () => envio({ ...base, fechaInformada }));
}
for (const v of [null, undefined, {}, { ...base, canal: "sms" }, { ...base, canal: "EMAIL" }, { ...base, tenantId: "" }, { ...base, finalidad: " " }, { ...base, tenantId: " espacio" }, { ...base, finalidad: "nota\nprivada" }]) {
  rechaza("envío inválido sin eco", () => envio(v as DatosClaveEnvio));
}
for (const v of [null, undefined, {}, { ...evento, referenciaProveedor: "" }, { ...evento, tenantId: "" }, { ...evento, referenciaProveedor: "\u0000dato" }, { ...evento, referenciaProveedor: " ref" }, { ...evento, referenciaProveedor: {} }]) {
  rechaza("evento inválido sin eco", () => entrada(v as DatosClaveEvento));
}

// Muestra finita de aislamiento/no colisiones; no demuestra imposibilidad matemática de colisión SHA256.
const envios = new Set<string>();
const eventos = new Set<string>();
for (let i = 0; i < 200; i++) {
  const tenantId = `tenant-sintetico-${i}`;
  for (const canal of ["email", "whatsapp"] as const) for (const finalidad of ["informe", "recordatorio"]) for (const fechaInformada of ["2026-10-26", "2026-10-27"]) {
    const k = envio({ tenantId, canal, finalidad, fechaInformada });
    check("muestra envío nuevo no colisiona", !envios.has(k)); envios.add(k);
    check("muestra reintento estable", k === envio({ tenantId, canal, finalidad, fechaInformada }));
  }
  const k = entrada({ tenantId, referenciaProveedor: "misma-ref" });
  check("muestra misma referencia distinto negocio no colisiona", !eventos.has(k)); eventos.add(k);
}
check("cantidad de claves de envío", envios.size === 1600);
check("cantidad de claves de evento", eventos.size === 200);
check("datos congelados intactos", Object.isFrozen(base) && Object.isFrozen(evento));
console.log(`OK: ${casos} comprobaciones, 1600 claves de envío y 200 de evento sin colisiones observadas; sin entradas privadas en salida.`);
