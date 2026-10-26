# Niveles de autonomia de Codex en `agente/whatsapp`

Reglas completas: `AGENTS.md`, secciones 12 (Nivel 2) y 13 (Nivel 3).

**Nivel vigente:** 2 (Codex abre PRs; Claude revisa cada uno).
**Nivel 3:** NO ACTIVO. Se activa solo cuando Nico escriba aqui "Nivel 3 activo" con la fecha.

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
