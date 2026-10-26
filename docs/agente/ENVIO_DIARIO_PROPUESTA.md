BORRADOR — NO EJECUTAR

# Propuesta: envío automático del informe diario por correo

**INFERENCIA — propuesta pendiente de Nico y revisión de Claude.** Este documento desarrolla la pregunta 17 de la especificación. No activa envíos ni define un cron. Implementar requiere otra tarea, después de resolver las decisiones de la sección 11.

## 1. Punto de partida verificable

- **HECHO:** existe un POST manual que valida sesión, rol de gestión y negocio antes de generar el informe; toma fecha explícita o `todayInChile()`. `src/app/api/agente/informe-diario/route.ts:7-26`
- **HECHO:** consulta el interruptor y destinatarios antes de generar y enviar; si falta la migración responde con error controlado. `src/app/api/agente/informe-diario/route.ts:29-55`
- **HECHO:** el generador pagina con `fetchAllRows` y filtra por `tenant_id` y día. `src/lib/agente/informe-diario.ts:65-84` El total, pendientes, canceladas y ausencias se calculan por separado. `src/lib/agente/informe-diario.ts:117-137`
- **HECHO:** el envío usa el cliente Resend compartido y devuelve la respuesta del proveedor. `src/lib/agente/informe-diario-email.ts:67-81` El POST no persiste un registro de entrega ni una clave de deduplicación entre generar, enviar y responder. `src/app/api/agente/informe-diario/route.ts:50-65`
- **HECHO del borrador, no de una base aplicada:** la configuración tiene interruptor general `enabled`, destinatarios y fechas de creación/actualización; no incluye hora, modo automático ni registro de ejecuciones. `docs/agente/sql/002_informe_diario_email_borrador.sql:5-13`
- **HECHO:** `todayInChile()` obtiene el día en `America/Santiago`; `parseWallClock` interpreta las horas guardadas como hora de pared. `src/lib/utils.ts:68-69` y `src/lib/wallclock.ts:1-7`
- **DESCONOCIDO:** capacidad, costo y restricciones del mecanismo de programación para esta instalación; no encontrados en los archivos anteriores. No se afirma frecuencia garantizada, precio ni comportamiento del proveedor.

## 2. Opciones para Nico

Todas las opciones y recomendaciones siguientes son **INFERENCIA — diseño propuesto**, no decisiones tomadas.

| Opción (pregunta 17) | Ventaja | Riesgo o costo operativo |
|---|---|---|
| A. Solo manual | El equipo elige cuándo revisar y enviar; no requiere programador automático. | Puede olvidarse el envío y depende de una persona. |
| B. Solo automático | Evita la acción diaria del equipo. | Fallos o destinatarios incorrectos pueden pasar inadvertidos; necesita control de duplicados y recuperación. |
| C. Automático + manual | Entrega habitual y recuperación supervisada. | El manual debe advertir que ya se envió; de otro modo puede duplicar el correo. |

**Recomendación:** conservar A mientras se valida el piloto y, si Nico autoriza automatizar, avanzar a C con apagado independiente del automático. No activar B o C por aprobar este documento.

| Día y momento del informe (preguntas 16 y 21) | Ventaja | Límite |
|---|---|---|
| Día actual antes de abrir | Sirve para preparar la jornada. | Es una foto de la agenda, no el resultado final. |
| Día actual al cerrar | Resume lo ocurrido en esa jornada. | Citas posteriores o cambios tardíos pueden quedar fuera de la foto. |
| Día anterior al comenzar la siguiente jornada | Evita mezclar una jornada aún abierta con el resumen. | El dueño recibe el cierre con demora; cambios posteriores siguen sin reflejarse. |

**Recomendación:** día anterior al comenzar la siguiente jornada si el objetivo es revisar resultados; día actual antes de abrir si Nico prioriza preparar la agenda. Nico debe elegir finalidad, hora local y días de envío; no se propone una hora numérica por defecto.

## 3. Comportamiento propuesto para otra tarea

Todos los requisitos de esta sección son **INFERENCIA — pendientes de aprobación**.

1. Mantener el envío automático apagado por defecto, separado del interruptor general. Apagar el automático conserva la opción manual; apagar el general bloquea ambos. Una configuración/migración faltante impide el envío y muestra “Falta aplicar la migración”.
2. Resolver día y hora en `America/Santiago`, independientemente de la zona del servidor. Elegir explícitamente el día informado; no deducirlo del día UTC. Las horas de citas siguen siendo hora de pared. En cambios de horario estacional, impedir doble envío si se repite una hora y aplicar la política acordada si la hora no ocurre.
3. El futuro disparador automático tendrá autenticación de servidor, con rechazo si falta o no coincide la credencial, y selección de negocios autorizados desde configuración del servidor. No llamar al POST manual fingiendo una sesión ni aceptar un tenant libre de una petición sin autorización. Conservar los controles de sesión y negocio del envío manual.
4. Enumerar negocios elegibles con paginación y límites de trabajo; generar cada informe con un `tenant_id` explícito. Un fallo de un negocio no habilita ni mezcla datos de otros. La frecuencia y los lotes dependen del mecanismo que se apruebe; no se fijan aquí.
5. Reutilizar el generador y el HTML existentes, sin modificar citas, cuotas de clientes ni contenido del informe. Antes del envío, volver a comprobar interruptores y destinatarios aprobados. Si hubo apagado o cambio de destinatarios desde que se preparó el trabajo, detener ese intento para revisión.
6. Reclamar atómicamente un envío por negocio y fecha informada, compartido por manual y automático. Una comprobación seguida de inserción sin exclusión atómica no basta ante dos ejecuciones simultáneas. Persistencia futura aditiva con `tenant_id`, RLS y tolerancia a migración faltante, siempre mediante SQL borrador revisado; este PR no agrega SQL.
7. Proponer estados mínimos: pendiente, procesando, aceptado por proveedor, fallido e incierto. Una respuesta de aceptación del proveedor no equivale a entrega en bandeja de entrada. Si el proveedor pudo aceptar el correo pero se perdió la respuesta o el registro posterior, marcar incierto y no reenviar a ciegas. La garantía de idempotencia del proveedor sigue **DESCONOCIDA**, pendiente de verificar documentación oficial en la tarea de implementación.
8. Proponer registro mínimo de negocio, fecha informada, estado, intento, instantes e identificador de proveedor si existe. No guardar HTML, nombres de clientes ni listas completas de destinatarios en logs. Plazo de retención, acceso y borrado deben aprobarse antes de crear persistencia (pregunta 10).
9. No recuperar automáticamente informes atrasados ni repetir envíos ya aceptados sin la política elegida por Nico. Un reenvío manual deliberado debe estar claramente identificado y advertir el riesgo de duplicado; requiere diseño y aprobación posteriores.

## 4. Riesgos y decisiones para mitigarlos

Todas las mitigaciones son **INFERENCIA — propuestas**.

| Riesgo | Mitigación propuesta | Decisión pendiente |
|---|---|---|
| Correo con nombres de clientes enviado al destinatario equivocado | Destinatarios aprobados por tenant, acceso restringido y comprobación justo antes del envío. | Pregunta 15; no inferir destinatarios desde clientes ni desde quien pulsa enviar. |
| Duplicados por concurrencia, reintentos o manual + automático | Reclamación atómica y estado incierto ante respuesta ambigua. | Pregunta 22: reintentos, atrasos y reenvíos. |
| Día equivocado o doble ejecución por cambio horario | Reloj chileno, fecha explícita y deduplicación por día informado. | Preguntas 16, 21 y 22. |
| Informe sin citas confundido con fallo | Resultado vacío distinguible de error de consulta. | Pregunta 23: enviar resumen vacío o no enviar. |
| Cambios posteriores en la agenda | Mostrar día informado y momento de generación en el futuro correo; no prometer un cierre inmutable. | Validar redacción y finalidad al elegir pregunta 21. |
| Cuota, remitente o infraestructura sin resolver | Mantener apagado hasta resolverlos y verificar el mecanismo elegido. | Preguntas 18, 19 y 24. |
| Falla después de algunos destinatarios o entrega incierta | No afirmar entrega completa ni repetir toda la lista automáticamente; revisar evidencia del proveedor. | Pregunta 22 y verificación técnica posterior. |

## 5. Piloto y criterios de aceptación propuestos

**INFERENCIA — para la futura implementación:** comenzar con Estudio Levels solo cuando Nico autorice destinatarios, modo, horario, día, política de fallos, retención y mecanismo. Antes de cualquier envío real, simular reloj, proveedor y base sin red ni llaves:

- Día y hora chilenos cerca de medianoche, cambio de mes/año, bisiesto y horario estacional repetido/inexistente.
- Dos ejecuciones simultáneas y combinación manual/automática del mismo negocio y día: una sola reclamación ordinaria.
- Interruptores apagados, migración ausente, destinatarios vacíos o cambiados y desactivación entre preparación y envío: no invocar al proveedor.
- Error de consulta, más de 1.000 citas y negocios paginados, día vacío, y fallo de un tenant sin afectar otro.
- Error antes del envío, aceptación seguida de fallo al registrar y respuesta perdida: distinguir fallido de incierto sin reenvío ciego.
- Ejecución tardía, caída temporal del programador, lista parcialmente aceptada y reenvío manual según política aprobada.

**DESCONOCIDO:** comportamiento real de la infraestructura, entrega del correo y persistencia; no probados en este PR documental. Claude revisa el código futuro; Nico autoriza la prueba operativa y cualquier SQL de pruebas.

## 6. Apagado y vuelta atrás propuestos

**INFERENCIA — procedimiento para la futura implementación:**

1. Nico o el operador autorizado desactiva el modo automático del negocio. Cada trabajo pendiente debe comprobar ese estado antes de enviar; el manual puede seguir disponible si el interruptor general permanece activo.
2. Si hay riesgo de destinatarios o contenido incorrectos, apagar también el interruptor general y detener nuevos intentos del negocio. Un correo ya aceptado o una llamada al proveedor en curso no se pueden prometer como cancelables.
3. Ante incidente general, el operador deshabilita el futuro disparador y revisa los estados inciertos antes de reanudar. No borrar el registro de deduplicación ni vaciar la cola para forzar reenvíos.
4. Volver al flujo manual existente, sin revertir ni borrar datos de citas. Reanudar automatización solo por decisión de Nico; no reenviar el atraso acumulado por defecto.

**HECHO actual:** apagar `enabled` en una configuración aplicada bloquea el POST manual en su siguiente comprobación; la ruta retorna antes de generar y enviar. `src/app/api/agente/informe-diario/route.ts:31-36` El modo automático separado y los controles de trabajos anteriores son propuestas nuevas, no funciones existentes.
