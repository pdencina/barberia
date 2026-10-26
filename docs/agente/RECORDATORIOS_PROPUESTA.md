BORRADOR — NO EJECUTAR

# Fase 2: recordatorios y respuesta del cliente

**INFERENCIA — propuesta, no autorización para enviar o modificar citas.** Nico decide acciones, canales y cuota; Claude revisa la futura implementación. Piloto propuesto: Estudio Levels, con interruptor apagado por defecto. No se implementan API, webhook, cron ni SQL en este PR.

## 1. Cómo funciona hoy

| Componente | HECHO verificado | Límite para reutilizar |
|---|---|---|
| Programación | Vercel configura `/api/cron/reminders` con `0 */1 * * *`. `vercel.json:5-8` | Prueba configuración versionada, no historial real de ejecuciones ni capacidad/costo contratados. |
| Selección por correo | Busca `scheduled`/`confirmed`, `reminder_sent = false` y `start_time` entre ahora +20 y +28 horas. `src/app/api/cron/reminders/route.ts:45-63` | Consulta global, sin paginación ni filtro tenant en esa selección; compara instantes UTC con horas guardadas como pared. No copiarla al agente. |
| Envío y marca | Usa `tryConsumeQuota(tenantId, email, reminder, appt.id)` si hay tenant; envía y luego marca `reminder_sent`, incluso si no hubo correo exitoso. `src/app/api/cron/reminders/route.ts:85-119` | La marca no prueba entrega y no distingue canales. La ausencia de tenant permite saltar cuota en ese código; no es el comportamiento propuesto. |
| Correo | `sendAppointmentReminder` incluye botones “Asistiré” y “No podré ir”; envía mediante Resend. `src/lib/resend.ts:425-464` | `await emails.send` no comprueba su campo `error` en esa función. No prometer entrega efectiva a partir de la marca anterior. |
| WhatsApp manual | Resuelve negocio, filtra fecha/tenant/estado y crea enlaces `wa.me` con cuota `reminder`. `src/app/api/cron/reminders/whatsapp/route.ts:16-40`, `:80-98` | Generar enlace no equivale a enviar por API. |
| Cuota | Límites por plan/overrides, conteo por tenant/canal/ciclo; categorías `confirmation`, `reminder`, `retention`. `src/lib/message-quota.ts:20-21`, `:31-69` | Si encuentra la misma referencia devuelve true y permite seguir; no evita repetir el envío. `src/lib/message-quota.ts:123-145` |
| Preferencias existentes | `clients` añade consentimiento de marketing y `do_not_contact`. `supabase/migrations/101_pin_huella_y_consentimiento.sql:10-14` | El cron de correo no los selecciona ni verifica. `src/app/api/cron/reminders/route.ts:50-63`, `:85-98` No asumir consentimiento WhatsApp por tener correo/teléfono o consentimiento de marketing. |

**HECHO — corrección del alcance de la incertidumbre anterior:** ya existe configuración de programador Vercel en el repo (`vercel.json:5-8`). **DESCONOCIDO:** estado desplegado, historial de ejecución, límites y costo de la cuenta; no encontrados en esos archivos. No se consultó producción.

**HECHO — hallazgos fuera de implementación:** el cron admite falta de secreto incluso en producción (`src/app/api/cron/reminders/route.ts:9-19`); su selección es global y el embed usa `profiles(name)` (`:50-63`). Los enlaces públicos de confirmación/cancelación identifican la cita por ID, sin comprobación de identidad del cliente en las rutas leídas (`src/app/api/public/confirm-attendance/route.ts:5-32`; `src/app/api/public/cancel/route.ts:6-44`). **INFERENCIA:** no exponerlos como acciones WhatsApp; Claude debe revisar estos controles antes de conectar canales. No se modifican aquí.

## 2. Requisitos externos: verificación pendiente

Consultas del **2026-10-26**. Las fuentes oficiales siguientes respondieron **HTTP 429**; no se obtuvo texto verificable, por lo que no se atribuye ninguna cita a Meta ni se revalida el texto histórico de la especificación.

| Tema solicitado | Fuente oficial intentada | Resultado |
|---|---|---|
| Ventana de 24 horas y mensajes permitidos | https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages y https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages | **DESCONOCIDO:** regla vigente y excepciones no verificadas en esta consulta. |
| Plantillas y aprobación | https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages | **DESCONOCIDO:** condiciones vigentes de aprobación y envío no verificadas. |
| Consentimiento/opt-in | https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in y https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/ | **DESCONOCIDO:** alcance exacto del consentimiento exigido no verificado. |

**INFERENCIA — condición de diseño:** antes del piloto, verificar en fuente oficial accesible ventana, plantilla aprobada y vigente para el negocio/categoría/idioma, y evidencia válida de opt-in por canal y finalidad. Si falta comprobación o estado, bloquear el envío. No suponer que la plantilla autoriza una acción sobre citas ni que una ventana abierta reemplaza el consentimiento. No se fijan tarifas ni se aprueba una plantilla desde este documento. Pregunta R4.

## 3. Recepción y acciones cerradas propuestas

Todo este flujo es **INFERENCIA**, pendiente de Nico en R1; no amplía silenciosamente las acciones permitidas de la fase 4 ni la sección 6 de la especificación.

1. Un futuro webhook autenticado por firma del proveedor valida autenticidad, deduplica evento y resuelve el negocio desde el número comercial configurado en servidor. Nunca desde texto libre o tenant enviado por el cliente. Controles de sesión y negocio permanecen en cualquier futura ruta del panel; el webhook necesitaría revisión específica de Claude y autenticación de servidor.
2. Vincular respuesta a recordatorio emitido, cliente y cita del mismo tenant mediante referencias verificadas del proveedor. Conocer un appointmentId, poseer un número o escribir un nombre no basta por sí solo para autorizar una modificación. Verificar asociación del contacto y contexto; contactos compartidos, ajenos o de identidad incierta requieren revisión humana sin revelar datos de la cita.
3. Lista cerrada: `confirmar`, `cancelar`, `no_quiero_mensajes`, `desconocido`. Un detector de texto solo clasifica; no autentica, autoriza ni ejecuta. Respuesta ambigua, negada, con dos intenciones o cita no identificada: `desconocido`, no actualizar, escalar o solicitar aclaración sin datos de terceros.
4. Si Nico habilita confirmar: proponer transición condicional `scheduled -> confirmed` únicamente para la cita propia aún futura y autorizada. Ya confirmada: operación idempotente. Cancelada/completada/no_show/en atención o estado cambiado concurrentemente: no reabrir ni sobrescribir; revisión.
5. Si Nico habilita cancelar: proponer solo `scheduled/confirmed -> cancelled` de la cita propia, con plazo/política que él apruebe. Ningún reagendamiento, cobro, devolución, comisión ni aviso al cliente adicional se autoriza aquí. El límite de dos horas existe en la ruta pública (`src/app/api/public/cancel/route.ts:26-37`), pero no se adopta como decisión del agente.
6. Antes de escribir: volver a leer contexto, estado y permiso; actualización atómica con `tenant_id`, `client_id`, ID y estado esperado. Un evento repetido no produce otra transición ni otro aviso. Confirmar al remitente solo tras resultado verificado y por la política de mensajes aprobada; el texto saliente/plantilla sigue sujeto a revisión.

## 4. Opt-out antes de cada envío

**HECHO del borrador, no de una tabla aplicada:** `agent_contact_preferences` tiene clave única `(tenant_id, contact_ref_hash)`, opt-in, opt-out, bloqueo y vencimiento. `docs/agente/sql/001_agente_whatsapp_borrador.sql:39-50`; RLS activo en el borrador `:101`. No guarda canal, finalidad ni evidencia detallada de consentimiento en esas columnas.

**INFERENCIA — propuesta:** comprobar antes de preparar y nuevamente justo antes de enviar: negocio habilitado, contacto asociado al tenant, preferencia vigente, opt-in verificable para ese canal/finalidad, ausencia de `opted_out_at`, `do_not_contact` de preferencias y de cliente. Cualquier bloqueo prima. Tabla ausente, evidencia insuficiente o preferencia expirada: no enviar; avisar migración/configuración pendiente. No convertir ausencia de registro en permiso.

**INFERENCIA:** una baja auténtica de ese contacto bloquea futuros envíos de su negocio/canal con la precedencia que apruebe Nico, sin cancelar citas. Resolver persistencia del bloqueo más allá de `retention_until`: borrar la única evidencia de baja no debe reactivar envíos. No guardar teléfonos ni RUT en claro en datos nuevos. Preguntas 10 y R3; canal/finalidad/evidencia requerirán diseño aditivo y SQL borrador posterior, no esta tarea.

## 5. Coordinación con correo, enlaces manuales y cuota

**INFERENCIA — opciones R2:** (A) correo solamente durante piloto técnico: menor cambio, sin probar entrega WhatsApp; (B) WhatsApp primario y correo como recuperación de fallo inequívoco: menos doble contacto, exige coordinar procesos; (C) ambos canales explícitos: más cobertura, mayor ruido y consumo. Recomendar A hasta resolver fuentes y acciones; si Nico habilita WhatsApp, evaluar B. Ningún canal nuevo se activa sin decisión.

**INFERENCIA:** la futura coordinación necesita registro atómico común por tenant/cita/versión de horario/finalidad y estado por canal, compartido con correo y generación de enlaces. El `reminder_sent` global no alcanza para distinguir aceptado, fallido o incierto. No usar la deduplicación de cuota como prueba de envío. El correo y la generación manual existentes tendrían que participar de la exclusión; si no se pueden coordinar, mantener WhatsApp apagado para no prometer ausencia de duplicados. Cambiar código legacy fuera de las carpetas permitidas requiere trabajo de Claude.

**HECHO:** `tryConsumeQuota` registra uso antes del envío; el código no devuelve una reserva ni confirma entrega (`src/lib/message-quota.ts:113-145`). **INFERENCIA — opciones R2:** reutilizar categoría `reminder` por canal (compatible, pero medir aceptación requiere adaptación); categoría/límite propio (separa consumo, requiere cambios de datos/plan); piloto sin consumo (simplifica, cambia cobro y requiere decisión explícita). Recomendar evaluar `reminder` sin cambiar límites; no asumir reembolso de fallo ni cobrar dos veces una referencia ya usada por enlace. Sin límite/categoría/semántica acordados: no enviar.

## 6. Pruebas, piloto, apagado y vuelta atrás

**INFERENCIA — pruebas futuras sin red, base ni llaves:** tenant ajeno; firma inválida; contacto compartido/ajeno; dos citas sin contexto; negaciones y texto ambiguo; cita vencida o estado cambiado; repetición/concurrencia; opt-out entre preparación y envío; preferencia vencida/migración ausente; cupo agotado; plantilla no aprobada; ventana no comprobada; error inequívoco y respuesta perdida; coordinación correo/link/WhatsApp; más de 1.000 filas; medianoche y cambios de horario de Chile. No pasar solo con un detector correcto: probar autorización y transiciones por separado.

**INFERENCIA — piloto:** Estudio Levels únicamente, tras aprobación de R1–R4 y decisiones de retención. Primero simulación y revisión de Claude; Nico autoriza configuración de prueba y cualquier SQL manual. Medir conteos de bloqueados, ambiguos, fallidos e inciertos sin copiar mensajes completos ni datos personales a logs. No se ejecuta una prueba con clientes en esta tarea.

**INFERENCIA — apagar en un minuto:** operador autorizado apaga recordatorios WhatsApp por tenant; todo trabajo pendiente verifica interruptor antes de enviar y todo cambio de cita antes de escribir. Mantener desactivación independiente para no apagar el correo existente sin decisión. Detener nuevos trabajos y revisar los inciertos; un correo/mensaje ya aceptado no se puede prometer como cancelable.

**INFERENCIA — vuelta atrás:** volver a correo/manual según la opción aprobada, sin reenviar automáticamente lo pendiente ni revertir citas confirmadas/canceladas. Revisar cambios ya efectuados, no deshacerlos en bloque. Reanudar solo con OK de Nico. **DESCONOCIDO:** interruptor de fase 2, registro coordinado y asociaciones proveedor/cliente/cita no se encontraron implementados en las rutas y borradores citados; requieren otra tarea.
