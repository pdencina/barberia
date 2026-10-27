# Bitacora del agente de WhatsApp

## 27 oct. 2026 — PR #136: SQL005 recordatorios, tanda A (espera Claude)
SQL aditivo, apagado, RLS sin políticas, HMAC por negocio y cascadas hacia cita/tenant; sin texto/teléfonos; limpieza DESCONOCIDO (`docs/agente/sql/005_recordatorios_whatsapp_borrador.sql:1`).
TypeScript y 66 comprobaciones PGlite pasan (003→004→005 completos repetidos, permisos/reclamo/borrados con función072 y orden real del cliente); no Supabase ni concurrencia multisession; sin merge, B no iniciada.

## 27 oct. 2026 — PR #133: seguimiento remitente #127 (espera Claude)
Tras merge #131 se reutiliza resolverRemitente existente (sin duplicarlo); se completa la prueba del POST manual con handler extraído sin cambiar permisos/consultas (`src/lib/agente/informe-diario-manual.ts:17`).
TypeScript, 14 casos nuevos (incluido POST manual), 65 programado, 63 informe y 11 HTML pasan; Node con loader tsx por bloqueo IPC del CLI. Sin Supabase/Resend/sesión reales ni correos; no mergear.

## 27 oct. 2026 — pieza 4: informe programado, PR #127 (espera Claude)

**HECHO:** PR #127 abierto hacia `agente/whatsapp` desde `codex/agente-informe-programado`, con ficha del Anexo B; sin merge. No se creó ni habilitó el cron. Se completa esta pieza y se espera la revisión de Claude.

**HECHO — base y autenticación:** piezas 1–3 presentes en base e3cbfe8; al detectar ausencia del helper se mantuvo la conexión bloqueada. Nico confirmó esperar a su sincronización; tras el merge de #126 se actualizó a 792aaa4 y se reutilizó `verifyCron` sin copiar/modificarlo (`src/lib/cron-auth.ts:9-21`). Dependencias reales después del guard (`src/app/api/agente/informe-programado/route.ts:8-17`); dryRun exige secreto válido también en desarrollo.

**HECHO — implementación:** paginación por perfil, último informe aceptado, reclamo único sin sobrescritura, relectura de perfil/negocio/preferencia después de generar, destinatario exclusivamente del perfil y fecha/hora única del calendario. Registro aceptado/fallido/incierto, sin reintentos de filas existentes y sin tocar procesando previos. Salida de conteos, sin datos personales ni errores crudos. Remitente solo `EMAIL_FROM`, sin fallback ni cupo comercial (`src/lib/agente/informe-diario-email.ts:87-112`). Contrato y límites: `docs/agente/INFORME_PROGRAMADO.md:1`.

**HECHO — verificación:** `npx tsc --noEmit` pasa; 61 casos del nuevo script pasan, con verifyCron real y entorno/base/proveedor/reloj simulados, incluidos dos ejecuciones simultáneas con reclamo simulado, paginación de 1.005 preferencias, cambios de datos durante generación, medianoche/DST, fallos de proveedor/registro y privacidad. También pasan 63 casos del informe, 11 de HTML horario, 44 del calendario y 95 de preferencias. Sin red de prueba, base, credenciales reales ni envíos. **DESCONOCIDO:** Supabase/PostgREST y Resend reales, concurrencia PostgreSQL multisession, duración de Vercel y carreras posteriores a la última lectura; no probados.

**INFERENCIA — para Nico:** máximo inicial propuesto de 20 nuevos reclamos por llamada en una constante, pendiente IA5; no es cuota ni garantía de duración. #22 reintentos/conciliación y #10 retención siguen pendientes. No se inventó columna de motivo: `fallido` es la categoría genérica persistida que admite 004. Sin SQL, cron, pantalla, cambios de `vercel.json`, dependencias, AGENTS.md o NIVELES.md. Este PR de código queda abierto para Claude, sin merge autónomo; al completar esta pieza se detiene el trabajo.

## Código por administrador — pieza 1, PR #123 (espera Claude)

**HECHO — actualización de Nico, 26 oct. 2026:** #16 y #21 respondidas: mismo día local de Santiago, 21:00 por defecto modificable por administrador. Sustituida la política provisional por `POLITICA_INFORME` (`src/lib/agente/calendario-informe.ts:3-6`). Texto del correo con fecha/hora de Santiago y advertencia de información modificable; los informes históricos manuales conservan fecha explícita. PR #123 actualizado, sin merge. No se inició pieza 4, no se enviaron correos ni se ejecutó SQL en esta actualización.

**HECHO — validación:** `npx tsc --noEmit` pasa; 56 casos reutilizados, 44 de decisión real y 11 del texto horario del correo pasan. Incluyen 20:59:59/21:00, fecha UTC de mañana, medianoche, ambos cambios DST y hora personalizada. **DESCONOCIDO:** integración real, reserva y entrega; no probadas. PR #123 abierto, sin merge.

**HECHO:** calendario puro en `src/lib/agente/calendario-informe.ts:1`; la prueba anterior importa el enumerador real (`scripts/test-agente-informe-frecuencia.ts:6`), y `scripts/test-agente-calendario-informe.ts:1` prueba decisión por instante, hora, vigencia y última fecha informada. Sin reloj real, red, base ni correo en las pruebas. **INFERENCIA:** IA2 se representa mediante ancla/vigencia explícitas, sin elegir cómo editarlas. Hora personalizada inexistente elegible en primera pasada posterior del día: comportamiento propuesto IA3, pendiente de Nico. No hay recuperación automática de días pasados (#22), reserva atómica ni revisión de trabajos en esta función. Son requisitos del despachador futuro, no garantías del calendario.

**HECHO comunicado por Nico:** tabla 003 aplicada en pruebas y ausente en producción; Codex no accedió a ninguna base. **DESCONOCIDO:** `src/lib/cron-auth.ts` sigue sin encontrarse en base d746b49; pieza 4 no iniciada, pendiente de merges 1–3 y revisión de Claude. Todos estos PRs quedan abiertos, ninguno se mergea autónomamente.

## 27 oct. 2026 — PR #138: acciones sobre cita propia, tanda A (espera Claude)
Referencia del recordatorio emitido y tenant/cliente autenticados; CAS de estado/horario, corte de pared Chile y notify público solo al ganar (`src/lib/agente/acciones-cita.ts:55-99`); sin abonos/devoluciones, BC3 pendiente.
TypeScript y 23 pruebas simuladas pasan (propiedad, estados, 2h exactas, DST/medianoche, concurrencia, aviso fallido); sin Supabase/notify reales ni rutas; sin merge y B no iniciada.

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

## Código por administrador — pieza 2, PR #124 (espera Claude)

**HECHO — revisión de Claude y corrección, 27 oct. 2026:** hallazgo bloqueante confirmado en PGlite: sin CASCADE, borrar perfil/negocio con envíos falla con `23503`. Corregidas únicamente las dos FK (`docs/agente/sql/004_registro_envios_informe_borrador.sql:10-11`); actualizado el comentario de retención. SQL completos 003 y 004 ejecutados en ese orden y repetidos: **41 comprobaciones pasan**, incluyendo borrado de perfil/negocio con envíos, cascada de preferencias y preservación de registros ajenos. Evidencia y modelo reducido en `docs/agente/VERIFICACION_REGISTRO_ENVIOS.md:3`. **DESCONOCIDO:** flujos reales de cuenta/negocio, otras FK del esquema desplegado, Supabase y concurrencia multisession; no probados. Retención sigue para Nico (#10), sin TTL ni limpieza. PR #124 se mantiene abierto, sin merge; pieza 4 no iniciada.

**HECHO — validación:** TypeScript y 63 comprobaciones existentes del informe pasan; PR #124 abierto, sin merge. Detalle de las 20 comprobaciones locales PGlite y límites en el reporte de verificación.

**HECHO:** borrador 004 en `docs/agente/sql/004_registro_envios_informe_borrador.sql:1`, y reporte local en `docs/agente/VERIFICACION_REGISTRO_ENVIOS.md:1`. PGlite efímero: 20 comprobaciones pasan, incluyendo segunda ejecución, RLS/privilegios, unicidad, reclamos en cola, estados y aislamiento de perfil/tenant. **INFERENCIA:** una restricción única y reclamo en una sentencia sostienen la reserva; no garantizan entrega exactamente una vez ni reemplazan el despachador. **DESCONOCIDO:** concurrencia multisession real, Supabase desplegado, retención (#10) e integración de envío. Ningún SQL ejecutado contra Supabase ni otra base externa. PR separado, sin merge; pieza 4 no iniciada.

### Detector: la ñ ya no se confunde con la n — rama claude/detector-enie

**HECHO:** `respuesta-cliente.ts` compone a NFC y devuelve "desconocido" si hay ñ/Ñ (también n + tilde suelta); las tildes en vocales se siguen ignorando. "coñfirmo" y "cañcelo" ya no confirman ni cancelan. Listas y contrato sin cambios.
**HECHO:** 12 casos nuevos (mayúsculas, ñ combinada, vocales con tilde, frases válidas); 229 casos, tsc y demás pruebas del agente pasan.
**NO probado:** otros confusables fuera de la ñ (el resto ya se rechazaba por la regla a-z); el detector sigue sin conectarse a ninguna ruta.
### Remitente del informe — rama claude/informe-remitente

**HECHO:** el informe usa `EMAIL_FROM` y, si falta o está vacío/solo espacios, el mismo respaldo del resto del sistema "re-booking <no-reply@re-booking.cl>" (`resolverRemitente` en `src/lib/agente/informe-diario-email.ts`). Ruta programada y manual comparten la función; `sendDailyReportEmail` acepta dependencias para probarla.
**HECHO:** prueba "EMAIL_FROM ausente" corregida y 4 nuevas (válido, vacío, ruta manual, sin destinatarios); tsc y todos los `test-agente-*` pasan.
**NO probado:** envío real con Resend ni que el dominio re-booking.cl acepte el informe; la ruta HTTP `/api/agente/informe-diario` solo vía su función de envío, no por HTTP.

## 27 oct. 2026 — PR #134: T-detector-enie, complemento de #132 (espera Claude)
Reproducido falso positivo con n+acento+tilde pese al arreglo NFC ya mergeado; se preserva esa letra antes de retirar marcas (`src/lib/agente/respuesta-cliente.ts:33-35`), sin cambiar listas, contrato ni rutas.
TypeScript y 239 casos pasan (229 existentes +10 nuevos); regresión falló primero contra la base. Loader tsx usado por restricción IPC; sin mensajes/datos/base reales; no mergear.

## 27 oct. 2026 — PR #140: T-wa-recordatorios (espera Claude; envío real bloqueado)
Núcleo inyectado y dryRun autenticado: 20..28h reales expresadas en pared Santiago, fetchAllRows por tenant, bajas/cuota/reclamo por canal; TypeScript, 53 casos nuevos y 211 Meta pasan sin red/base/SQL/mensajes reales; código: `src/lib/agente/recordatorios-whatsapp.ts:1`; plantilla/operación Meta DESCONOCIDAS, BC3 y BR1 (PR #139) pendientes.
Para Claude: coordinar atómicamente el cron de correo (`src/app/api/cron/reminders/route.ts:45-63`, snapshot ya leído no se protege con reminder_sent) con el registro 005; exponer aceptación/error de `sendAppointmentReminder` (`src/lib/resend.ts:457-465`, hoy void, aquí incierto), revisar su zona horaria/texto y el contrato de plantilla antes de quitar el bloqueo (`src/app/api/agente/recordatorios-whatsapp/route.ts:12-14`); no se tocó cron/vercel ni el helper de correo.

## 27 oct. 2026 — PR #137: cliente Meta genérico, tanda A (espera Claude)
Cliente puro con fetch/parámetros inyectados, desafío constante, HMAC por tenant y texto separado no serializable (`src/lib/agente/whatsapp-meta.ts:1`); formato Meta DESCONOCIDO por fuentes oficiales inaccesibles/429, URLs y fecha en el código.
TypeScript y 211 casos simulados pasan; sin API Meta/red/base/tokens reales ni integración de rutas; contrato genérico, sin merge y B no iniciada.

## 27 oct. 2026 — PR #139: T-wa-webhook (espera Claude)
Webhook con firma previa, contexto Meta ligado a proveedor/contacto/tenant y confirmación tras acciones verificadas (`src/lib/agente/whatsapp-webhook.ts:31`); SQL006 autorizado por Nico, BORRADOR sin ejecutar; ausente bloquea acciones.
TypeScript, 54 casos webhook y 211 Meta pasan sin red/base/mensajes reales; SQL/RLS/concurrencia real y contrato Meta no probados; variables: WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, AGENTE_CONTACT_HASH_SALT, WHATSAPP_ACCESS_TOKEN, WHATSAPP_API_VERSION, EMAIL_FROM, RESEND_API_KEY. BC3/BR1 pendientes.

TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: pendiente; C3: pendiente; C4: pendiente; C5: pendiente; C6: pendiente; C7: pendiente; C8: pendiente.
TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: hecho PR #143; tsc, 57 webhook y 14 PGlite OK; sin Supabase ni concurrencia multisession; C3: pendiente; C4: pendiente; C5: pendiente; C6: pendiente; C7: pendiente; C8: pendiente.
TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: hecho PR #143; tsc, 57 webhook y 14 PGlite OK; sin Supabase ni concurrencia multisession; C3: hecho PR #145; tsc y 59 casos OK; Claude programará este cron en otra hora que el antiguo; envío real bloqueado; C4: pendiente; C5: pendiente; C6: pendiente; C7: pendiente; C8: pendiente.
TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: hecho PR #143; tsc, 57 webhook y 14 PGlite OK; sin Supabase ni concurrencia multisession; C3: hecho PR #145; tsc y 59 casos OK; Claude programará este cron en otra hora que el antiguo; envío real bloqueado; C4: hecho PR #146; tsc, 15 C4 y 211 Meta OK; contrato propuesto no aprobado en Meta; C5: pendiente; C6: pendiente; C7: pendiente; C8: pendiente.
TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: hecho PR #143; tsc, 57 webhook y 14 PGlite OK; sin Supabase ni concurrencia multisession; C3: hecho PR #145; tsc y 59 casos OK; Claude programará este cron en otra hora que el antiguo; envío real bloqueado; C4: hecho PR #146; tsc, 15 C4 y 211 Meta OK; contrato propuesto no aprobado en Meta; C5: hecho PR #147; tsc, 14 C5 y 56 webhook OK; sin Supabase ni proveedores reales; C6: pendiente; C7: pendiente; C8: pendiente.
TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: hecho PR #143; tsc, 57 webhook y 14 PGlite OK; sin Supabase ni concurrencia multisession; C3: hecho PR #145; tsc y 59 casos OK; Claude programará este cron en otra hora que el antiguo; envío real bloqueado; C4: hecho PR #146; tsc, 15 C4 y 211 Meta OK; contrato propuesto no aprobado en Meta; C5: hecho PR #147; tsc, 14 C5 y 56 webhook OK; sin Supabase ni proveedores reales; C6: hecho PR #149; tsc y 20 comprobaciones flujo real con puertos en memoria; sin proveedores reales; C7: pendiente; C8: pendiente.
TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: hecho PR #143; tsc, 57 webhook y 14 PGlite OK; sin Supabase ni concurrencia multisession; C3: hecho PR #145; tsc y 59 casos OK; Claude programará este cron en otra hora que el antiguo; envío real bloqueado; C4: hecho PR #146; tsc, 15 C4 y 211 Meta OK; contrato propuesto no aprobado en Meta; C5: hecho PR #147; tsc, 14 C5 y 56 webhook OK; sin Supabase ni proveedores reales; C6: hecho PR #149; tsc y 20 comprobaciones flujo real con puertos en memoria; sin proveedores reales; C7: hecho PR #151; tsc y 16 retención OK; borrado real BLOQUEADO, bajas intactas; solo memoria; C8: pendiente.
TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: hecho PR #143; tsc, 57 webhook y 14 PGlite OK; sin Supabase ni concurrencia multisession; C3: hecho PR #145; tsc y 59 casos OK; Claude programará este cron en otra hora que el antiguo; envío real bloqueado; C4: hecho PR #146; tsc, 15 C4 y 211 Meta OK; contrato propuesto no aprobado en Meta; C5: hecho PR #147; tsc, 14 C5 y 56 webhook OK; sin Supabase ni proveedores reales; C6: hecho PR #149; tsc y 20 comprobaciones flujo real con puertos en memoria; sin proveedores reales; C7: hecho PR #151; tsc y 16 retención OK; borrado real BLOQUEADO, bajas intactas; solo memoria; C8: hecho PR #152; tsc, 51 C8 independientes y 53 C8+16 C7 en copia temporal OK; solo nombres, EMAIL_FROM opcional.
TANDA C (27 oct. 2026): C1: hecho PR #141; tsc, 24 C1 y 53 recordatorios OK; sin servicios reales; C2: hecho PR #143; tsc, 57 webhook y 14 PGlite OK; sin Supabase ni concurrencia multisession; C3: hecho PR #145; tsc y 59 casos OK; Claude programará este cron en otra hora que el antiguo; envío real bloqueado; C4: hecho PR #146; tsc, 15 C4 y 211 Meta OK; contrato propuesto no aprobado en Meta; C5: hecho PR #147; tsc, 14 C5 y 56 webhook OK; sin Supabase ni proveedores reales; C6: hecho PR #149; tsc y 20 comprobaciones flujo real con puertos en memoria; sin proveedores reales; C7: hecho PR #151; tsc y 16 retención OK; borrado real BLOQUEADO, bajas intactas; solo memoria; C8: hecho PR #152; tsc, 51 C8 independientes y 53 C8+16 C7 en copia temporal OK; solo nombres, EMAIL_FROM opcional; RESUMEN: hecho PR #153; 12 líneas, CT1 sección11; C1–C8 checks verdes y copia temporal tsc/pruebas OK; TODO espera Claude, sin merge.
TANDA D — hecho documental (PR por abrir): PILOTO.md 69 líneas y auditoría de 6 archivos/8 métodos (corte 4b0dc72); Graphify local AST y comprobación directa; SQL sin verificación final señalado, consultas propuestas solo en guía; sin SQL ejecutado, servicios reales ni activación. Guía y auditoría juntas por instrucción actual de Nico; rendimiento pendiente.
TANDA D — PR #159: listo para merge documental solo al verificar pruebas/limites-de-carpeta verdes sobre su SHA final; sin SQL/código/cron. Graphify remoto no tiene acceso a pdencina/barberia en los enlaces disponibles; grafo local AST usado. Rendimiento: en curso, preservando también ambigüedad con clientes sin recordatorio.
TANDA D — hecho: PR #159 mergeado a agente/whatsapp sobre SHA ca5cc18 con pruebas/limites-de-carpeta verdes; solo documentación. Rendimiento — listo para PR: recordatorios 48h primero, clientes candidatos por lotes<=100, guardia global por HEAD/conteo sin descargar otros clientes; tsc, 3070 comprobaciones nuevas y 14 C5+59 webhook+20 flujo OK; Graphify local usado, sin Postgres/Supabase/Meta/Resend reales ni SQL ejecutado; código espera a Claude.
Rendimiento — hecho PR #162 hacia agente/whatsapp; solo descarga clientes candidatos y mantiene bloqueo global de teléfono compartido mediante HEAD sin datos; 3070 nuevas +93 de regresión y tsc OK. NO mergear: revisión Claude; PostgREST/regex/plan SQL reales no probados. Tanda D #159 ya mergeada con checks verdes; ambas tareas cerradas para Codex.
TANDA E — E2 hecho (PR por abrir): lector comercial con base inyectada, filtros tenant (tenants.id como padre), servicios activos paginados y nulos sin defaults; 72 casos y tsc OK, compatibilidad tipada E1/E2 +6 consultas puras en copia temporal OK. Fuente real del enlace retention.ts:214-220, sin fallback genérico; sucursal no elegida (EFAQ1 pendiente). E1 #165 abierto; E3 no iniciado; sin servicios reales ni SQL.
