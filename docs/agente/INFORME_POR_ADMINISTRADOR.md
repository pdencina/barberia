BORRADOR — NO EJECUTAR

# Fase 1: informe por administrador

## 1. Decisiones y fuentes

**HECHO — decisiones comunicadas por Nico el 26 oct. 2026:** #15: suscripción opcional por administrador, frecuencia diaria, cada 3 días, semanal o personalizada; #18: no consume el cupo de correos del negocio; #19: remitente `no-reply@re-booking.cl`, obtenido exclusivamente de `EMAIL_FROM`. Nico informa haberlo comprobado en un correo de producción; Codex no inspeccionó producción ni variables. Registro: sección 12 de `ESPECIFICACION.md`.

**HECHO:** `profiles` tiene `id`, `email`, `role` y `active` (`supabase/migrations/001_initial_schema.sql:14-23`); el alta guarda correo, rol y `tenant_id` juntos (`src/app/api/barberos/route.ts:171-182`). El alta de negocio asigna `admin` (`src/app/api/auth/signup-business/route.ts:57-62`). `super_admin` tiene acceso transversal y los demás quedan restringidos a su negocio (`src/lib/supabase/server.ts:127-145`). `isManagerLevel` también admite `receptionist`, por lo que no basta para seleccionar administradores destinatarios (`src/lib/supabase/server.ts:106-109`).

**INFERENCIA — contrato del rediseño:** destinatario elegible = perfil activo con rol `admin` y negocio coincidente. `super_admin` administra preferencias de esos perfiles; esto no lo suscribe como destinatario transversal. Recepción y profesionales no se incluyen. Si se desea suscribir otros roles, requiere nueva decisión.

**HECHO — brecha actual:** el envío manual consulta configuración por negocio y destinatarios (`src/app/api/agente/informe-diario/route.ts:29-55`); el borrador anterior guarda una lista de correos (`docs/agente/sql/002_informe_diario_email_borrador.sql:5-13`). **INFERENCIA:** quedan reemplazados como diseño de Fase 1 por este contrato; no se importan esas listas ni se activa una preferencia al migrarlas. Este PR no cambia el funcionamiento actual.

## 2. Preferencias y permisos

**INFERENCIA — tabla propuesta, no aplicada:** `agent_admin_report_preferences`, una fila por `profile_id`, con `tenant_id`, `enabled=false`, `frequency` cerrada (`daily`, `every_3_days`, `weekly`, `custom`), `custom_weekdays` (0 domingo…6 sábado), `weekly_weekday`, `anchor_date`, `send_local_time`, `effective_from`, `revision`, fechas de creación/actualización. Ancla y vigencia son fechas civiles de Santiago. Las filas apagadas pueden tener hora/vigencia nulas; al activar se exige configuración completa. La hora por defecto de la política decidida es modificable por administrador; el día semanal requiere elección explícita. El SQL 003 se entrega en PR separado, espera a Claude y no se ejecuta.

**INFERENCIA — destino:** NO hay columna ni entrada de correo libre. Antes de cada envío se relee `profiles.email` por `id` y `tenant_id`, con rol/actividad vigentes; si falta o es inválido se bloquea ese envío. Un cambio de correo/rol/negocio invalida el trabajo preparado: volver a validar, no enviar a una dirección capturada antes del cambio. La sincronización real entre correo de autenticación y perfil es **DESCONOCIDO — No encontrado en el repositorio en esta revisión**; no se considera verificado el correo solo porque tenga formato válido.

**INFERENCIA — autorización:** solo el propio `admin` sobre su fila y `super_admin`. Un admin no lista, lee ni modifica preferencias ajenas, incluso del mismo negocio. Sesión y rol del servidor, `profile_id` de la sesión y `tenant_id` autorizado se comprueban juntos; jamás basta el negocio enviado por el navegador. Reutilizar resolución de identidad/negocio (`src/lib/supabase/server.ts:76-96`, `src/lib/supabase/server.ts:127-145`) y añadir comprobación estricta de dueño/rol. RLS habilitado sin políticas abiertas; el borrador no concede acceso directo al navegador. Una API futura con cliente privilegiado debe aplicar estos controles porque RLS no reemplaza su autorización.

## 3. Calendario, selección y cambios

**INFERENCIA — algoritmo propuesto:** cada ejecución recibe un instante real; obtiene fecha/hora civiles con zona `America/Santiago`. Evalúa solo perfiles habilitados y elegibles cuya configuración completa esté vigente. El generador existente pagina y filtra las citas por negocio/día (`src/lib/agente/informe-diario.ts:65-84`); se puede generar una vez por negocio/fecha y entregar separadamente a cada administrador. No convertir las horas de citas con UTC real: su representación es hora de pared (`src/lib/wallclock.ts:1-7`).

| Frecuencia | INFERENCIA — condición de calendario |
|---|---|
| Diaria | Cada fecha civil desde `effective_from`. |
| Cada 3 días | Fechas `anchor_date + 3 × k`, con k entero no negativo; diferencia de días civiles, nunca 72 horas desde el último envío. El fallo no mueve el ancla. |
| Semanal | Día semanal explícito; no asumir lunes ni el día del alta. |
| Personalizada | Solo los días elegidos, sin repetidos, y al menos uno antes de activar. |

**INFERENCIA — sin deriva ni duplicación:** enumerar fechas debidas desde el cursor de evaluación, sin depender del último éxito. Registrar cada ocurrencia y reclamarla atómicamente antes de enviar. Dos ejecuciones de la misma fecha local comparten clave, incluidos reloj repetido y reintentos. Esto evita perder fechas al cambiar de mes/año; no garantiza entrega si el proveedor falla. La recuperación de ocurrencias atrasadas, su antigüedad y límites siguen en #22. No acumular ni reenviar automáticamente mientras no se decida.

**INFERENCIA — verano/invierno:** decidir por fecha civil, no por duración del día. Si la hora elegida no existe por adelanto: A) primera ejecución posterior ese día (recomendación, mantiene la fecha), B) marcar para revisión (más control, posible atraso). Si se repite una hora, una sola ocurrencia. Falta decidir esto en IA3; la hora predeterminada ya está decidida en #16; IA3 afecta horas personalizadas inexistentes.

**INFERENCIA — cambios de frecuencia:** incremento de `revision` y `effective_from` explícito. A) mantener ancla/ciclo (continuidad, menos intuitivo); B) nuevo ciclo desde fecha elegida (claro, desplaza la próxima entrega); C) aplicar después de la próxima ocurrencia anterior (previsible, demora el cambio). Recomendación B con vista de “próximo envío” y sin retroactividad; Nico decide IA2. Un trabajo con revisión vieja se cancela/recalcula; la revisión NO forma parte de la clave de entrega, para no duplicar el mismo informe tras un cambio. Bajar el interruptor tiene efecto inmediato, aunque exista trabajo en cola.

**HECHO — #16/#21 decididas por Nico, 26 oct. 2026:** informe de citas del MISMO DÍA local en America/Santiago a las 21:00 por defecto, con hora modificable por cada administrador. Registro en sección 12; política única `POLITICA_INFORME` (`src/lib/agente/calendario-informe.ts:3-6`). El correo dice “Citas de hoy, generado a las HH:MM” y aclara que la información puede cambiar después. Cada 3 días/semanal informa el día de esa ejecución, no un intervalo acumulado. El instante del envío debe revalidarse en el despachador futuro si una ejecución cruza medianoche; no reutilizar una fecha calculada en otro día. No es un cierre contable ni una garantía de inmutabilidad.

## 4. Automatización y vuelta atrás

**HECHO:** Vercel ya llama reminders cada hora y post-service a la media hora (`vercel.json:5-12`). **INFERENCIA — opciones #24:** A) incorporar evaluación a una ejecución existente: menos infraestructura, acopla fallos/tiempos; B) cron dedicado: aislamiento y observación propios, requiere configuración y capacidad aprobadas. Recomiendo B si Pablo confirma capacidad; conservar manual hasta entonces. Ninguna opción se crea en esta tarea.

**DESCONOCIDO — No encontrado en el repositorio:** `src/lib/cron-auth.ts` en la base revisada `a54195d`. **HECHO:** reminders permite continuar si falta `CRON_SECRET` (`src/app/api/cron/reminders/route.ts:9-19`); post-service inicia su GET sin esa validación (`src/app/api/cron/post-service/route.ts:8-26`). Contradice el aviso de autenticación ya exigida. **INFERENCIA — requisito bloqueante IA4:** Claude debe confirmar/restaurar el helper común y autenticación Bearer con `CRON_SECRET`, rechazando secreto ausente o incorrecto antes de leer datos o enviar. No reutilizar la omisión como patrón y no tocar esas rutas en este PR.

**INFERENCIA — riesgos y vuelta atrás:** evaluar zona local en cada pasada; no asumir que el cron coincide con una hora local fija. Duración, frecuencia disponible, costos y entrega efectiva de esta instalación son **DESCONOCIDO — No encontrado en el repositorio**. Antes de integrar, acordar ventana de ejecución y tratamiento de atrasos. Para parar: deshabilitar preferencias y el despachador futuro; volver a comprobarlas antes de cada envío; conservar registro de aceptados para evitar repetición al reactivar. No borrar tablas ni volver al envío indiscriminado por negocio. Rollback de código/calendario en otro PR revisado; SQL no se elimina ni ejecuta aquí.

## 5. Deduplicación, límites y fallos

**HECHO:** `crearClaveEnvio` usa negocio, fecha informada, finalidad y canal; valida fecha y produce hash de tupla versionada (`src/lib/agente/clave-deduplicacion.ts:3-8`, `src/lib/agente/clave-deduplicacion.ts:24-29`). No persiste ni reclama trabajos.

**INFERENCIA — uso propuesto:** `tenantId` validado; `fechaInformada` decidida por #21; `canal: "email"`; `finalidad: JSON.stringify(["informe-admin-v1", profileId])`. Así dos administradores tienen claves distintas; reintentar o cambiar frecuencia no crea otra clave para el mismo administrador/día informado. No incluir correo, nombre, revisión o instante de ejecución en esa finalidad. Envíos separados: nunca un `to` compartido entre administradores. #21 ya fija un día único; no se agrega acumulación de períodos.

**INFERENCIA:** almacenamiento futuro con unicidad por clave y reserva atómica, estado preparado/aceptado/fallo inequívoco/incierto. SQL 003 modela SOLO preferencias, no ese registro de entregas: automatización bloqueada hasta diseñarlo y revisarlo. Aceptado no se reenvía; fallo inequívoco admite propuesta de reintentos acotados; timeout posterior a envío es incierto, revisar proveedor antes de repetir. Opciones manual/reintentos/atrasos y sus límites: #22; no se fijan cantidades aquí.

**HECHO:** `evaluarLimiteDeUso` necesita historial, hashes y reglas explícitas (`src/lib/agente/limite-de-uso.ts:11-18`); evalúa contacto/negocio/bucle sin reservar (`src/lib/agente/limite-de-uso.ts:35-51`). **INFERENCIA:** no aplicar automáticamente los límites de chat a informes internos. Puede servir para protección operativa si se acuerdan unidades/reglas y reserva compartida (IA5); nunca descontar cupo del negocio, por #18. Tamaño de lote, reintentos y concurrencia no son decisiones comerciales implícitas.

**HECHO:** el informe usa `getResendClient` pero tiene fallback literal (`src/lib/agente/informe-diario-email.ts:75-92`); otros envíos priorizan `EMAIL_FROM` con fallbacks distintos (`src/lib/resend.ts:168`, `src/lib/resend.ts:272`); el cliente común no define remitente (`src/lib/resend-client.ts:14-21`). **INFERENCIA — implementación posterior de #19:** leer exclusivamente `EMAIL_FROM`, sin dominio escrito a mano; si falta, error controlado y ningún envío. Corregir el fallback del informe en PR de código revisado, no con este documento.

## 6. Opt-in, baja y pantalla propuesta

**INFERENCIA:** no crear suscripciones activas automáticamente. La activación es decisión expresa del administrador; conservar evidencia mínima de su ajuste, sin texto de citas, con retención pendiente en #10. Super_admin puede gestionar la fila, sin inferir consentimiento de una lista vieja. Antes de cada intento, incluidos reintentos, releer baja, rol, actividad, negocio, revisión y correo. Una baja cancela trabajos pendientes; un correo ya aceptado por el proveedor no puede retirarse prometiendo lo contrario.

**INFERENCIA — baja con un clic:** ajuste autenticado en el perfil propio, interruptor “Recibir informes” pasa a apagado con una acción; guardar en servidor con protección de sesión y CSRF. Un enlace en el correo puede llevar a ese ajuste; no debe ejecutar una baja con un GET que activen escáneres. Alternativa: enlace firmado de propósito único con confirmación y token sin datos de clientes; requiere diseño/revisión de Claude. Recomiendo ajuste autenticado primero (IA6), no implementar enlaces públicos con IDs manipulables.

**INFERENCIA — boceto, no pantalla implementada:**

```text
Mis informes de citas
Recibir informes por correo  [Apagado]
Se enviarán al correo de tu perfil: [tu correo, solo lectura]
Para cambiar ese correo, revisa los datos de tu cuenta.

Frecuencia: Diaria / Cada 3 días / Semanal / Elegir días
Si eliges Semanal: [día de la semana]
Si eliges Elegir días: [Lun] [Mar] [Mié] [Jue] [Vie] [Sáb] [Dom]
Hora de envío (Santiago): [hora elegida; por defecto la política del informe]
Próximo envío: [fecha calculada según tu frecuencia]
[Guardar mis preferencias]

Solo cambias tus informes. Puedes dejar de recibirlos aquí con un clic.
Estos informes no consumen el cupo de correos de tu negocio.
```

**INFERENCIA — aceptación:** dos admins del mismo negocio eligen independientemente; ninguna lista devuelve preferencias ajenas; cambiar tenant/id no amplía permisos; migración faltante mantiene apagado y avisa “Falta aplicar la migración”; email ausente, perfil desactivado, rol cambiado y opt-out en cola bloquean envío. Calendario se prueba con datos ficticios, sin red ni correo real. No se considera terminada la Fase 1 automática hasta resolver #22–24 e IA1–IA6 y revisar implementación/SQL con Claude.
