// Ejecutar: npx tsx scripts/test-vcard.ts
import assert from "node:assert/strict";
import { contactosVcf } from "../src/lib/vcard";
const r = contactosVcf([{ name: "Juan, Pérez;\nX", phone: "9 1234 5678" }, { name: "Repetido", phone: "+56912345678" }, { name: "Sin", phone: null }, { name: "Corto", phone: "123" }], "RET 30-45");
assert.equal(r.total, 1);
assert.ok(r.texto.includes("FN:RET 30-45 Juan\\, Pérez\\; X\r\n") && r.texto.includes("TEL;TYPE=CELL:+56912345678"));
const muchos = contactosVcf(Array.from({ length: 300 }, (_, i) => ({ name: `C${i}`, phone: `9${String(10000000 + i)}` })), "RET");
assert.equal(muchos.total, 300);
assert.ok(muchos.texto.includes("FN:RET C255\r\n") && muchos.texto.includes("FN:RET G2 C256\r\n"));
assert.equal(contactosVcf([], "RET").texto, "");
console.log("OK: contactos para difusión");
