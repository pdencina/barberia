# Bitacora del agente de WhatsApp

## 26 oct. 2026 — informe por administrador (A/B/C)

**HECHO — decisiones de Nico registradas:** #15 suscripción individual opcional y cuatro frecuencias, #18 sin consumo del cupo del negocio, #19 remitente exclusivamente desde `EMAIL_FROM`. Registro en sección 12 y hoja de pendientes actualizados.

**HECHO — tarea A, PR #120:** mergeado por Codex a `agente/whatsapp` tras `pruebas` y `limites-de-carpeta` verdes (head 43830e7). Rediseño documental en `INFORME_POR_ADMINISTRADOR.md`; TypeScript y 63 comprobaciones existentes pasan. **INFERENCIA:** calendario civil Santiago, aislamiento por perfil, opt-out, deduplicación por administrador y opciones de automatización. Sin implementación ni activación. Pendientes #16, #21–24 e IA1–IA6; discrepancia del helper cron documentada, no corregida.

**HECHO — tarea B, PR #121:** abierto, SIN MERGE, espera a Claude. Solo `docs/agente/sql/003_preferencias_informe_borrador.sql`, primera línea BORRADOR — NO EJECUTAR; no ejecutado. **INFERENCIA:** tabla aditiva por perfil/tenant, restricciones, RLS sin acceso del navegador y validación de asociación; no registro de entregas. **DESCONOCIDO:** comportamiento PostgreSQL/RLS/trigger y re-ejecución real, no probados contra una base.

**HECHO — tarea C, PR #122:** `scripts/test-agente-informe-frecuencia.ts` pasa 56 casos, también con `TZ=UTC`; `npx tsc --noEmit` pasa. **INFERENCIA:** especificación ejecutable con función simulada local, no implementación en `src/`. Cubre cada 3 días, siete días semanales, personalizados, medianoche, mes/año/bisiesto, retroceso/adelanto del reloj de Santiago, opt-out, separación por admin/tenant y tres alternativas explícitas de cambio de frecuencia. No decide IA2 ni hora/día informado. **DESCONOCIDO:** integración real, persistencia atómica, cron, entrega y recuperación; no probados. Sin SQL ni correo real. Registrado para merge autónomo autorizado por Nico exclusivamente tras ambos checks verdes; resultado final verificable en PR #122.

## Cierre del lote Nivel 3 — T1 a T10

**HECHO — entregas verificadas en GitHub, 26 oct. 2026:**

| Tarea | PR | Estado y alcance |
|---|---|---|
| T1 | #108 | Mergeado por Codex tras ambos checks verdes; decisiones para Nico. |
| T2 | #109 | Mergeado por Codex tras ambos checks verdes; amenazas y controles reales. |
| T3 | #110 | Mergeado por Codex tras ambos checks verdes; cinco borradores de textos, sin aprobación Meta. |
| T4 | #111 | Mergeado por Codex tras ambos checks verdes; guía operativa con controles pendientes. |
| T5 | #112 | Mergeado por Codex tras ambos checks verdes; 100 trampas nuevas, 217 casos pasan. |
| Hallazgo T5 | #113 | Mergeado por Codex tras ambos checks verdes; prueba negativa de ñ→n, D1 pendiente de Claude, lógica no corregida. |
| T6 | #114 | Mergeado por Codex tras ambos checks verdes; 40 casos ficticios, 15 trampas; EV1 propuesto. |
| T7 | #115 | Mergeado por Codex tras ambos checks verdes; bocetos del panel, PN1 pendiente. |
| T8 | #116 | Abierto SIN MERGE, espera Claude; HMAC genérico, TypeScript y 111 casos pasan. Meta DESCONOCIDO por 429. |
| T9 | #117 | Abierto SIN MERGE, espera Claude; ventanas/bucles parametrizados, TypeScript y 80 casos pasan. |
| T10 | #118 | Abierto SIN MERGE, espera Claude; claves puras, TypeScript y 3.452 comprobaciones pasan. |

**INFERENCIA — tres decisiones primero para habilitar Fase 1 manual:** correos destinatarios aprobados (#15), tratamiento del cupo interno (#18) y dominio remitente confirmado por Pablo/Nico (#19). Automático requiere además hora/días/modalidad, día informado, recuperación e infraestructura (#16–17, #21–24). No se ejecutó SQL ni se envió correo para probarlas.

**HECHO — límites del lote:** ningún cambio en AGENTS.md, NIVELES.md, vercel.json, package.json, supabase/, .github/ o .env; ningún cron/ruta nueva ni envío real. T8–T10 son funciones sin conexión, en ramas independientes desde la base actualizada; no se mergean autónomamente. Se termina la lista y se detiene el trabajo. **DESCONOCIDO:** integración real, entrega y datos desplegados; no probados. El hallazgo D1 debe revisarse antes de conectar el detector a acciones.

## Código por administrador — piezas 1 a 3, revisión obligatoria de Claude

| Pieza | PR | HECHO — validación y límites |
|---|---|---|
| 1: calendario | #123 | Abierto SIN MERGE. TypeScript, 56 casos reutilizados, 44 de decisión real y 11 del texto horario pasan. Fuente en PR #123: `src/lib/agente/calendario-informe.ts:1`. #16/#21 decididas por Nico: mismo día, 21:00 de Santiago por defecto modificable por admin; política centralizada. Sin red/base/envíos; reserva persistente y recuperación no probadas. |
| 2: registro SQL | #124 | Abierto SIN MERGE. TypeScript y 63 comprobaciones existentes pasan; PGlite efímero, 20 comprobaciones del SQL local pasan. Fuente: `docs/agente/sql/004_registro_envios_informe_borrador.sql:1` en ese PR. No Supabase ni concurrencia multisession; retención DESCONOCIDO (#10). |

**HECHO — pieza 3, PR #125 abierto SIN MERGE:** ruta en `src/app/api/agente/informe-preferencias/route.ts:1`, manejador inyectable en `src/lib/agente/informe-preferencias.ts:1`, contrato en `docs/agente/API_INFORME_PREFERENCIAS.md:1`. TypeScript y 95 casos con guard/base simulados pasan: 401/403, propio perfil/tenant, super_admin con negocio concreto, whitelist, fechas/horas/días, activación completa, defecto apagado, migración ausente 503, origen cruzado y conflictos de revisión/creación. **DESCONOCIDO:** autenticación Next real, Supabase, RLS de la instalación y pantalla; no probados. Sin envío ni SQL externo; espera Claude.

**INFERENCIA — límites del lote:** IA2, IA3, #10 y #22 siguen pendientes; #16/#21 respondidas por Nico el 26 oct. 2026 y registradas en la pieza 1 (#123). La pieza 4 NO se empieza y no hay merge autónomo en este lote. No se tocó vercel.json, dashboard, package.json, supabase/, .github/, AGENTS.md, NIVELES.md ni .env. **DESCONOCIDO:** `src/lib/cron-auth.ts` sigue no encontrado en base d746b49; falta resolver antes de pieza 4.

## Registro Nivel 3 — lote T1 a T10

- PR #108 — T1: mergeado por Codex a `agente/whatsapp` con ambos checks verdes; hoja de decisiones y regla #20 actualizada.
- PR #109 — T2: mergeado por Codex con ambos checks verdes; amenazas, controles existentes y faltantes, sin cambios de código.
- PR #110 — T3: mergeado por Codex con ambos checks verdes; cinco borradores de textos, longitudes y condiciones, sin aprobación Meta ni envío.
- PR #111 — T4: mergeado por Codex con ambos checks verdes; guía operativa y pregunta RB1, sin ejecutar cambios de configuración.
- PR #112 — T5: mergeado por Codex con ambos checks verdes; cien trampas nuevas, 217 casos pasan, sin cambios de lógica.
- PR #113 — hallazgo T5: mergeado por Codex con ambos checks verdes; prueba negativa de ñ→n y propuesta para Claude. D1 sigue pendiente; no se arregló ni integró el detector.
- PR #114 — T6: mergeado por Codex con ambos checks verdes; banco ficticio de 40 casos, 15 trampas y umbral EV1 propuesto, no evaluado contra IA.
- PR #115 — T7: mergeado por Codex con ambos checks verdes; bocetos A/B, configuración e informes, PN1 pendiente, sin construir pantallas.

Resumen corto para la auditoria semanal de Nico y Claude (AGENTS.md, seccion 12, punto 10).
Una entrada por semana: que se hizo, que quedo abierto, que decisiones se necesitan de Nico.

### T9 — espera revisión de Claude

**HECHO:** evaluador puro de ventanas por contacto/negocio y repetición de hash de mensaje (`src/lib/agente/limite-de-uso.ts:35-51`); 80 pruebas y TypeScript pasan. Todos los máximos/ventanas y “ahora” son parámetros. Sin almacenamiento, red, texto crudo, reloj real ni ruta; no reserva atómicamente. Pregunta 12 y retención siguen con Nico. PR #117 abierto SIN MERGE; T8 permanece abierto como PR #116 esperando a Claude.

## Semana del 26 oct. 2026
- Hecho: especificacion completada (PR #88 y #91), borrador SQL, reglas del Nivel 2, revision automatica de PRs y regla de proteccion de la rama.
- Abierto: 14 preguntas de la seccion 11 de la especificacion; fuentes de la ley 21.719 por verificar.
- **HECHO — tarea 2:** mapa documental con origen y mantenimiento de catálogo, precios/duración por profesional, horarios, perfiles, ubicación y políticas online en `docs/agente/BASE_CONOCIMIENTO.md`, sección 1. **INFERENCIA:** lectura solo con aprobación por negocio; notas nuevas no reemplazan datos operativos. BC1–BC3 pendientes: responsables, vigencia y políticas discrepantes. Sin datos reales, aprobación ni implementación.
- Decisiones que necesita Nico: fase 1 (preguntas 1, 9 y 14 de la seccion 11).
- Hecho: fase 1 implementada en borrador de código con informe diario manual por correo, aislado por negocio y apagado por defecto.
- **INFERENCIA — tarea 1, fase 2:** propuesta documental en `docs/agente/RECORDATORIOS_PROPUESTA.md`: acciones e identidad, preferencias, duplicados entre canales, cuota y vuelta atrás. **HECHO:** Vercel Cron ya está configurado (`vercel.json:5-8`), corregido el alcance del DESCONOCIDO anterior. **DESCONOCIDO:** fuentes Meta con HTTP 429 el 2026-10-26; quedan R1–R4 y cuota/retención para Nico/Claude. Sin implementación, cron ni SQL.
- Probado: día vacío, varios profesionales, medianoche, más de 1.000 filas, interruptor apagado y migración faltante con datos simulados.
- Abierto: destinatarios, hora, automatización y cuota del correo interno (preguntas 15 a 18).
- **HECHO — seguimiento del PR #95:** total excluye canceladas y no asistió; conserva completadas. Pendientes incluye agendadas, confirmadas y en atención. Canceladas y ausencias tienen contadores separados y siguen visibles con su estado. `src/lib/agente/informe-diario.ts:4-5`, `src/lib/agente/informe-diario.ts:117-120` y `src/lib/agente/informe-diario-email.ts:37-42`, `src/lib/agente/informe-diario-email.ts:59`.
- **HECHO:** validación de fecha por días del mes y regla bisiesta, sin construir fechas ni convertir zonas horarias. `src/lib/agente/informe-diario.ts:50-57`. Pruebas simuladas añadidas para estados, aislamiento y calendario. `scripts/test-agente-informe.ts:88-117`.
- **HECHO / abierto:** se conserva `EMAIL_FROM` y el fallback actual; existen dos dominios distintos en `src/lib/resend.ts:168` y `src/lib/resend.ts:272`, sin remitente común en `src/lib/resend-client.ts:14-21`. Nico decide la unificación en la pregunta 19; recomendación: verificar el dominio autorizado antes de centralizarlo en otra tarea.
- **HECHO — verificación local del seguimiento:** `npx tsc --noEmit` y las 33 comprobaciones de `npx tsx scripts/test-agente-informe.ts` pasaron. No se ejecutó SQL ni se envió correo real; falta la revisión de Claude del PR nuevo.
- **HECHO — tarea 3:** clasificador puro de cuatro categorías en `src/lib/agente/respuesta-cliente.ts:1-44`, sin conexión, escritura ni registro del texto. Pruebas sintéticas en `scripts/test-agente-respuesta-cliente.ts`. **INFERENCIA de diseño:** frases completas normalizadas, máximo 160 unidades de texto; emojis, preguntas, negaciones, mezclas e instrucciones adicionales se abstienen. No valida identidad ni autoriza acciones. **Abierto:** integración/acciones siguen pendientes de Nico; ninguna ruta lo invoca en este PR.
- **HECHO — reglas leídas:** Nivel 2 vigente, Nivel 3 inactivo y contador 1 de 3 por el PR #96. `docs/agente/NIVELES.md:5-14` y `AGENTS.md:129-137`. No se modifican las reglas ni el contador. La discrepancia de merge de `AGENTS.md:122` con `docs/agente/NIVELES.md:5` queda en la pregunta 20.
- **INFERENCIA — propuesta documental:** envío diario automático con opciones manual/automático/ambos, día y hora chilenos, duplicados, reintentos, riesgos y vuelta atrás. `docs/agente/ENVIO_DIARIO_PROPUESTA.md`, secciones 2 a 6. Preguntas 15 a 19 y 21 a 24 pendientes de Nico; retención del futuro registro sujeta a pregunta 10. Sin código, SQL, cron ni cambios en `vercel.json`; revisión de Claude antes de merge.

## Lote autónomo — tarea 4 y cierre de las cuatro tareas

- **HECHO — tarea 4:** se amplía únicamente la prueba del informe: medianoche, cambio de mes/año y bisiesto, relaciones objeto/lista/ausentes, varios servicios y escape HTML de todos los campos. `scripts/test-agente-informe.ts:136-184`. El simulador registra filtros/rangos/orden (`:36-67`); pruebas con 0, 1.000, 1.005 y 2.005 citas verifican paginación y aislamiento (`:186-208`). Se mantienen pruebas de canceladas/no_show (`:105-125`). No se cambió lógica de `src/`.
- **HECHO — verificación local:** `npx tsc --noEmit` y las 63 comprobaciones del informe pasan. **DESCONOCIDO:** integración real con Supabase, entrega y entorno desplegado, no probados. No se detectó un error de lógica en estos casos cubiertos; no se afirma que el sistema completo esté libre de errores.
- **HECHO — entregas del lote:** tarea 1 en PR #100 (propuesta recordatorios, fuentes Meta bloqueadas por HTTP 429); tarea 2 en PR #101 (mapa de conocimiento); tarea 3 en PR #102 (detector puro, 117 casos pasan); tarea 4 en este PR (63 comprobaciones del informe). Cada rama parte de `agente/whatsapp` actualizado, sin apilar entre sí. Ningún PR fue mergeado por Codex. Los documentos/código de los PRs anteriores permanecen en sus ramas para revisión.
- **INFERENCIA — pendiente de Nico:** acciones sobre citas, coordinación correo/WhatsApp y cuota, consentimiento y alcance/retención de baja; editor/aprobador del conocimiento, vigencia y políticas de cancelación/abono. Preguntas R1–R4 en PR #100 y BC1–BC3 en PR #101; decisiones anteriores de horario/automatización/destinatarios/remitente siguen abiertas. Claude debe verificar los requisitos oficiales Meta y los hallazgos legacy antes de habilitar integración. No se decide ni implementa integración en este lote.
- **HECHO — límites respetados:** sin cambios en AGENTS.md, NIVELES.md, vercel.json, configuración, supabase/ o .env; no hay SQL nuevo/ejecutado, cron nuevo, ruta nueva ni envío real. Se termina la lista de cuatro tareas y se detiene el trabajo a la espera de Claude/Nico.

### Hallazgo documental de T5 — pendiente de corrección

**HECHO:** reproducción negativa local falla al esperar `desconocido` para una palabra con ñ; el detector devuelve `confirmar` por normalización (`src/lib/agente/respuesta-cliente.ts:28-30`). Evidencia y propuesta en `docs/agente/HALLAZGO_DETECTOR_ENIE.md`. D1 queda para Nico/Claude. Este PR documental no corrige código ni integra acciones; los scripts de regresión existentes siguen verdes. No se oculta el fallo dentro de una expectativa de aceptación.

### T8 — espera revisión de Claude

**HECHO:** verificador HMAC-SHA256 genérico, comparación de digests con `timingSafeEqual`, entradas crudas y secreto por parámetro, sin ruta/entorno/red (`src/lib/agente/webhook-firma.ts:1-22`). TypeScript y 111 casos sintéticos pasan (`scripts/test-agente-webhook-firma.ts:17-62`). **DESCONOCIDO:** firma específica de Meta por HTTP 429; fuentes y límites en `docs/agente/WEBHOOK_FIRMA.md`. No mergear este PR con código hasta revisión de Claude; ninguna integración ni envío.
