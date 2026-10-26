# Bitacora del agente de WhatsApp

Resumen corto para la auditoria semanal de Nico y Claude (AGENTS.md, seccion 12, punto 10).
Una entrada por semana: que se hizo, que quedo abierto, que decisiones se necesitan de Nico.

## Semana del 26 oct. 2026
- Hecho: especificacion completada (PR #88 y #91), borrador SQL, reglas del Nivel 2, revision automatica de PRs y regla de proteccion de la rama.
- Abierto: 14 preguntas de la seccion 11 de la especificacion; fuentes de la ley 21.719 por verificar.
- Decisiones que necesita Nico: fase 1 (preguntas 1, 9 y 14 de la seccion 11).
- Hecho: fase 1 implementada en borrador de código con informe diario manual por correo, aislado por negocio y apagado por defecto.
- Probado: día vacío, varios profesionales, medianoche, más de 1.000 filas, interruptor apagado y migración faltante con datos simulados.
- Abierto: destinatarios, hora, automatización y cuota del correo interno (preguntas 15 a 18).
- **HECHO — seguimiento del PR #95:** total excluye canceladas y no asistió; conserva completadas. Pendientes incluye agendadas, confirmadas y en atención. Canceladas y ausencias tienen contadores separados y siguen visibles con su estado. `src/lib/agente/informe-diario.ts:4-5`, `src/lib/agente/informe-diario.ts:117-120` y `src/lib/agente/informe-diario-email.ts:37-42`, `src/lib/agente/informe-diario-email.ts:59`.
- **HECHO:** validación de fecha por días del mes y regla bisiesta, sin construir fechas ni convertir zonas horarias. `src/lib/agente/informe-diario.ts:50-57`. Pruebas simuladas añadidas para estados, aislamiento y calendario. `scripts/test-agente-informe.ts:88-117`.
- **HECHO / abierto:** se conserva `EMAIL_FROM` y el fallback actual; existen dos dominios distintos en `src/lib/resend.ts:168` y `src/lib/resend.ts:272`, sin remitente común en `src/lib/resend-client.ts:14-21`. Nico decide la unificación en la pregunta 19; recomendación: verificar el dominio autorizado antes de centralizarlo en otra tarea.
- **HECHO — verificación local del seguimiento:** `npx tsc --noEmit` y las 33 comprobaciones de `npx tsx scripts/test-agente-informe.ts` pasaron. No se ejecutó SQL ni se envió correo real; falta la revisión de Claude del PR nuevo.
