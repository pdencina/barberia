import { randomBytes } from "node:crypto";
import { ALFABETO } from "./referidos";

// Solo servidor (usa node:crypto): no importar desde componentes del navegador.
export function nuevoCodigo(): string {
  const b = randomBytes(6);
  return Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("");
}
