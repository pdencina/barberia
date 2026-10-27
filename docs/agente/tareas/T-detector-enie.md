# T-detector-enie: arreglar el falso positivo con la letra n con tilde (codigo, espera revision de Claude)

Contexto: `src/lib/agente/respuesta-cliente.ts` normaliza con NFD y quita las marcas combinantes, asi que la letra con tilde pasa a la n normal y un texto que no es una frase valida puede coincidir con una de las listas cerradas. Esta documentado en `docs/agente/HALLAZGO_DETECTOR_ENIE.md` y tiene su prueba negativa en `scripts/test-agente-respuesta-cliente.ts`.

Hacer:
1. Corrige la normalizacion para que esa letra NO se confunda con la n normal, sin romper el resto de tildes (acentos en vocales deben seguir ignorandose).
2. La prueba negativa que hoy documenta el falso positivo debe pasar a ser una prueba normal que exige "desconocido".
3. Agrega unos 10 casos nuevos alrededor de ese cambio (mayusculas, vocal con tilde, palabras con la letra dentro de la frase, frases validas que deben seguir clasificandose igual).
4. No cambies las listas de frases ni el contrato publico de la funcion. No lo conectes a ninguna ruta.

Archivos permitidos: `src/lib/agente/respuesta-cliente.ts`, `scripts/test-agente-respuesta-cliente.ts`, `docs/agente/BITACORA.md`.
