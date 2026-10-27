# Cola de tareas de la Fase 2 (recordatorios por WhatsApp)
Decisiones de Nico: `docs/agente/ESPECIFICACION.md` seccion 12 (27 oct.). Reglas fijas: `AGENTS.md` seccion 14. Todas son CODIGO o SQL: no se mergean solas, esperan a Claude. Un PR por tarea, rama `codex/...` desde `agente/whatsapp` actualizada.

| Orden | Tarea | Depende de |
|---|---|---|
| A (en paralelo) | `T-sql-recordatorios.md` | nada |
| A (en paralelo) | `T-wa-cliente-meta.md` | nada |
| A (en paralelo) | `T-acciones-cita.md` | nada |
| B (cuando Claude mergee A) | `T-wa-webhook.md` | las tres de A |
| B (cuando Claude mergee A) | `T-wa-recordatorios.md` | las tres de A |

Regla de la cola: haz las de A en ese orden o en paralelo; al terminar A, DETENTE y espera a Claude. No empieces B hasta que Claude diga que A esta mergeado (B usa las piezas de A).

## Despues de la tanda C
`TANDA-D.md` (solo documentacion): empiezala unicamente cuando la tanda C este completa. Cuando termines la D, detente y espera a Nico o a Claude.

## Tanda E (respuestas fijas a preguntas frecuentes)
`TANDA-E.md`: E1 y E2 en paralelo; E3 solo cuando Claude lo pida. Es codigo: nada se mergea solo.
