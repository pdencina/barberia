// Qué mensajes de clientes pueden llegar a la IA. Todo lo demás se deriva a una persona sin enviarlo a ningún proveedor.
import { normalizar } from "./faq-fija";

const MAX_LARGO = 300;
const OCULTOS = /[\u0000-\u001f\u007f​-‏‪-‮⁠-⁯﻿]/;
const INSTRUCCIONES = /\b(ignora|ignorar|olvida|olvidar|omite|instrucciones|prompt|sistema|actua como|actúa como|finge|revela|secretos|tokens?|contrasena|clave|api|ejecuta|obedece|traduce|jailbreak|rol|roleplay|desarrollador|developer)\b/;
// Temas que una persona debe ver siempre (salud, reclamos, dinero en disputa).
const SENSIBLES = /\b(reclamo|reclamos|queja|quejas|demanda|abogado|salud|alergia|alergias|dolor|medico|medica|embarazo|herida|infeccion|hongos|devolucion|devoluciones|reembolso|estafa|robo)\b/;
// Datos que no deben salir del negocio hacia un proveedor externo.
const DATOS_SENSIBLES = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b|\b(?:\d[ -]?){13,19}\b|@\S+\.\S+/;

/** Devuelve el texto normalizado si puede enviarse a la IA; null si no. */
export function mensajeAdmitidoParaIA(texto: unknown): string | null {
  if (typeof texto !== "string" || !texto.trim() || texto.length > MAX_LARGO || OCULTOS.test(texto)) return null;
  if (DATOS_SENSIBLES.test(texto)) return null; // RUT, tarjetas, correos: no salen del sistema
  const n = normalizar(texto);
  if (INSTRUCCIONES.test(n) || SENSIBLES.test(n)) return null;
  return texto.trim();
}
