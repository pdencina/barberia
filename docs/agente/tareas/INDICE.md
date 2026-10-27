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

## Tanda E — seguimiento al 27 de octubre de 2026

Orden autorizado por Nico: E3 → EFAQ1 → E4 → E5; cada tarea en rama `codex/...` independiente y PR hacia `agente/whatsapp`. Todos pendientes de revisión de Claude; Codex no hace merge.

1. **E3 — implementado, PR [#173](https://github.com/pdencina/barberia/pull/173), sin merge.** FAQ con datos comerciales inyectados antes del traspaso para desconocidos sin recordatorio; precio base con `$`; catálogo omite solo servicios inválidos. TypeScript, 118 casos webhook y 261 FAQ pasan.
2. **EFAQ1 — implementado, PR [#174](https://github.com/pdencina/barberia/pull/174), sin merge.** Dirección y horario por sucursal activa, pregunta cuál si falta. TypeScript, 117 datos/sucursales y 261 FAQ pasan. ABIERTO: sin semana completa por `branch_id`, deriva; la consulta debe incluir la sucursal (sin memoria conversacional).
3. **E4 — auditado y corregido, PR [#175](https://github.com/pdencina/barberia/pull/175), sin merge.** Sin `SELECT *` en compatibilidad y revalidación del negocio justo antes de responder. TypeScript, 25 auditoría y 81 datos pasan en su rama. Composición de E3/EFAQ1/E4 probada: 118 webhook, 126 datos/sucursales, 261 FAQ y 25 auditoría. ABIERTO para Claude: conservar `const consultar` de E4 al combinar la declaración del lector con EFAQ1.
4. **E5 — documentación lista, PR [#176](https://github.com/pdencina/barberia/pull/176), sin merge.** Esta actualización y [Qué falta para encender WhatsApp](../QUE-FALTA-PARA-ENCENDER-WHATSAPP.md). Sin activar envíos ni borrados.

Las pruebas son simuladas; no verifican Meta, correo, base ni producción. `permitirEnvio` y `permitirBorrado` siguen en `false`. La apertura de PR no autoriza encender WhatsApp.
