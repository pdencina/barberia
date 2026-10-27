# Niveles de autonomia de Codex en `agente/whatsapp`

Reglas completas: `AGENTS.md`, secciones 12 (Nivel 2) y 13 (Nivel 3).

**Nivel vigente:** 3 (activo desde el 26 oct. 2026; ver el final de este archivo).
**Nivel 3:** ACTIVO (autorizado por Nico el 26 oct. 2026). Reglas: AGENTS.md seccion 13.

## Contador de PRs seguidos sin hallazgos de Claude (se anota despues de cada revision)
| PR | Tema | Hallazgos de Claude | Contador |
|---|---|---|---|
| #88 | Especificacion (primera version) | 5 observaciones | 0 |
| #91 | Correcciones a la especificacion | Observaciones menores | 0 |
| #95 | Informe diario por correo | 3 detalles | 0 |
| #96 | Ajustes del informe diario | Ninguno | 1 de 3 |
| #98 | Propuesta del envio automatico del informe | Ninguno contra Codex (detecto una contradiccion en AGENTS.md, error de Claude, ya corregida) | 2 de 3 |
| #100 | Propuesta de recordatorios (Fase 2) | Ninguno | 3 de 3 |
| #101 | Base de conocimiento por negocio | Ninguno | 4 |
| #102 | Detector de respuestas del cliente (codigo puro, 117 casos) | Ninguno (nota: "cancelar" en Chile tambien significa pagar; usar solo como respuesta a un recordatorio abierto) | 5 |
| #103 | Pruebas del informe diario (63 comprobaciones) | Ninguno | 6 |

**Requisito del Nivel 3 cumplido** (3 o mas PRs seguidos sin hallazgos, verificado por Claude el 26 oct. 2026). Sigue NO ACTIVO hasta que Nico escriba abajo "Nivel 3 activo" con la fecha.

## Activacion
Nivel 3 activo, 26 oct. 2026, autorizado por Nico en el chat con Claude. Alcance: Codex puede mergear a `agente/whatsapp` solo PRs de documentacion (sin SQL) y/o `scripts/test-agente-*.ts`, con `pruebas` y `limites-de-carpeta` en verde. Todo lo demas sigue con revision de Claude. Un hallazgo en algo mergeado solo suspende el nivel (contador a 0) hasta que Nico lo reactive.

## Auditoria de Claude, 26 oct. 2026 (noche): primera sesion con Nivel 3
**Mergeado por Codex solo (T1 a T7, PRs #107 a #115):** verificado por Claude. Solo tocaron `docs/agente/` y `scripts/test-agente-respuesta-cliente.ts`; ningun SQL, ningun cambio en AGENTS.md ni NIVELES.md, sin llaves ni secretos en el texto. Las pruebas ampliadas del detector (217 casos) pasan en la Mac de Claude. El nivel sigue activo.
**Pendientes de Claude (codigo, no se mergean solos):**
| PR | Tema | Resultado de Claude |
|---|---|---|
| #116 | Verificacion de firma HMAC del webhook (funcion pura, 111 casos) | Sin hallazgos. Comparacion en tiempo constante, no lee entorno ni red. Es contrato generico: el formato exacto de Meta sigue INFERENCIA. |
| #117 | Limite de uso y deteccion de bucles (funcion pura, 80 casos) | Sin hallazgos. Nota: un solo registro corrupto del historial devuelve "datos_invalidos" para todos (falla cerrado, aceptable). Valores concretos siguen en la pregunta 12. |
| #118 | Claves de deduplicacion (funcion pura, 3.452 comprobaciones) | Sin hallazgos. Tupla JSON versionada, sin colisiones observadas, sin datos personales en claro. |
**Hallazgo documentado (#113):** el detector trata "n con tilde" como "n" y puede dar falso positivo. Arreglo de una linea propuesto por Codex; pendiente de decidir en un PR de codigo con revision de Claude.
