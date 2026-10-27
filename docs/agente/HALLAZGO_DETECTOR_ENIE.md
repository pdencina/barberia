BORRADOR — NO EJECUTAR

# T5 — falso positivo al convertir ñ en n

**HECHO:** el detector normaliza NFD y elimina marcas combinadas (`src/lib/agente/respuesta-cliente.ts:28-30`); acepta entonces las frases de las listas (`:40-42`). La entrada sintética `coñfirmo` devolvió `confirmar` y `cañcelo` devolvió `cancelar` en ejecución local del 2026-10-26. No se ejecutó ninguna acción de cita.

**INFERENCIA — defecto de abstención:** son palabras ajenas a las frases explícitas de la lista; la normalización crea una orden que no estaba escrita correctamente. El contrato conservador exige abstenerse ante duda. La prueba negativa siguiente falla con la lógica actual. El detector fue revisado/mergeado por Claude en PR #102; no es un defecto de una lógica modificada en los PRs de documentación/pruebas de este lote. No se corrige `src/` en T5.

## Reproducción negativa, fuera de los scripts verdes

**HECHO — primera aserción ejecutada localmente:** código 1, `actual: confirmar`, `expected: desconocido`. Este bloque es evidencia documental; no se añade una prueba fallida al conjunto que permite mergear documentación.

```ts
import assert from "node:assert/strict";
import { clasificarRespuestaCliente } from "./src/lib/agente/respuesta-cliente";

assert.equal(clasificarRespuestaCliente("coñfirmo"), "desconocido");
assert.equal(clasificarRespuestaCliente("cañcelo"), "desconocido");
```

**HECHO:** la salida local previa comprobó ambas clasificaciones; la primera aserción detiene el bloque al fallar. No presentar que la segunda aserción se ejecutó en esa misma corrida. Ningún texto de un cliente real se usó o registró.

## Propuesta para decisión y revisión

**INFERENCIA — opciones D1:** preservar ñ/Ñ antes de quitar acentos de vocales y rechazar palabra no reconocida (mejor distinción del español, exige ampliar regresión); o quitar solo acentos agudos/de vocales de forma explícita (más estricto, requiere decidir otras marcas admitidas). Recomendar preservar ñ como letra distinta; mantener normalización de vocales para mayúsculas/tildes válidas. No corregir silenciosamente escritura ni sustituir letras para obtener una acción.

**INFERENCIA — aceptación de una corrección posterior:** las dos pruebas anteriores deben pasar como desconocido; mantener confirmaciones/bajas válidas con acentos, espacios y mayúsculas; agregar ñ precompuesta y n+tilde combinada, confusables e intenciones negadas. Claude revisa el cambio `src/` y Nico autoriza la política. Mientras tanto no conectar el detector a acciones; confirmar/cancelar requieren recordatorio abierto, identidad y autorización, no solo categoría (`docs/agente/RECORDATORIOS_PROPUESTA.md:39-44`).

**DESCONOCIDO:** uso real en producción; no se inspeccionó. La búsqueda local del símbolo en `src/` encontró solo su definición y no una ruta que lo invoque. Resolver D1 antes de integrar acciones; publicar este hallazgo no lo arregla.
