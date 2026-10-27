# Piloto de WhatsApp — guía para Nico y Pablo
Corte: `agente/whatsapp` 4b0dc72, 27 oct. 2026. HECHO significa comprobado en código; una propuesta no habilita producción.
1. **Confirmar responsables y entorno.** Propuesta operativa: Pablo prepara cuentas/configuración y Nico autoriza cada paso. Primero usar el Supabase de pruebas «rebooking Base», según `docs/agente/tareas/TANDA-D.md:7`; DESCONOCIDO: identidad/acceso real a ese proyecto desde aquí.
2. **Revisar los borradores antes de aplicar nada.** Orden: **003 → 004 → 005 → 006 → 007**. Son borradores; Codex no los ejecutó en Supabase. Solo Pablo/Nico los aplican primero en pruebas; producción requiere respaldo comprobado y OK de Nico. No retirar controles para «hacerlo funcionar».
   - 003 `sql/003_preferencias_informe_borrador.sql`: preferencias por administrador, apagadas por defecto y RLS (`:12-58`).
   - 004 `sql/004_registro_envios_informe_borrador.sql`: registro/deduplicación del informe; borrado en cascada de perfil/negocio (`:8-41`).
   - 005 `sql/005_recordatorios_whatsapp_borrador.sql`: configuración por negocio, bajas y envíos WhatsApp/correo; apagado y retención 30 por defecto (`:8-18`, `:20-65`).
   - 006 `sql/006_eventos_whatsapp_borrador.sql`: eventos sin texto y admisión atómica (`:6-28`).
   - 007 `sql/007_aviso_administrador_borrador.sql`: columna/reclamo para un aviso al administrador por contacto y hora (`:4-26`). Todas esas rutas SQL están dentro de `docs/agente/`.
3. **Verificar cada aplicación antes de seguir.** HECHO: los cinco archivos no incluyen consultas de verificación al final; no se modifican en este PR. INFERENCIA: las siguientes consultas de lectura son comprobaciones propuestas para Pablo, en el editor SQL del proyecto elegido; no son resultados observados ni sustituyen las pruebas de permisos/aislamiento.
```sql
-- Después de 003: debe aparecer la tabla y el valor predeterminado false.
SELECT to_regclass('public.agent_admin_report_preferences') AS tabla;
SELECT column_default FROM information_schema.columns
 WHERE table_schema='public' AND table_name='agent_admin_report_preferences' AND column_name='enabled';
-- Después de 004: tabla presente y dos FK con confdeltype='c' (CASCADE).
SELECT to_regclass('public.agent_admin_report_deliveries') AS tabla;
SELECT confdeltype FROM pg_constraint
 WHERE conrelid=to_regclass('public.agent_admin_report_deliveries') AND contype='f';
-- Después de 005: tres tablas presentes; defaults enabled=false y retention_days=30.
SELECT to_regclass('public.agent_whatsapp_settings'),to_regclass('public.agent_contact_optouts'),to_regclass('public.agent_reminder_deliveries');
SELECT column_name,column_default FROM information_schema.columns
 WHERE table_schema='public' AND table_name='agent_whatsapp_settings' AND column_name IN ('enabled','retention_days');
-- Después de 006: tabla y función presentes, no NULL.
SELECT to_regclass('public.agent_whatsapp_events'),
 to_regprocedure('public.agent_claim_whatsapp_event(text,uuid,text,text,timestamp with time zone)');
-- Después de 007: una columna y función presente; anon_ejecuta debe ser false.
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='agent_whatsapp_events' AND column_name='admin_notice_claimed_at';
SELECT to_regprocedure('public.agent_claim_whatsapp_admin_notice(uuid,text,text,timestamp with time zone)'),
 has_function_privilege('anon','public.agent_claim_whatsapp_admin_notice(uuid,text,text,timestamp with time zone)','EXECUTE') AS anon_ejecuta;
-- Al terminar: seis filas; RLS true y permisos de lectura false para ambos roles.
SELECT c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_lee,
 has_table_privilege('authenticated',c.oid,'SELECT') AS navegador_lee
 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relname IN ('agent_admin_report_preferences','agent_admin_report_deliveries',
 'agent_whatsapp_settings','agent_contact_optouts','agent_reminder_deliveries','agent_whatsapp_events');
```
   HECHO de esquema: RLS y revocaciones están en 003:52-58, 004:38-41, 005:62-68 y 006:17-22. Si falta algo o difiere, detener la puesta en marcha y pedir revisión a Claude; repetir el archivo no repara todo esquema previo distinto.
4. **Configurar Vercel sin copiar secretos al chat.** Propuesta: Pablo crea/configura y custodia los valores en Vercel; Nico confirma que es el entorno de pruebas. DESCONOCIDO: permisos/cuentas y valores actuales; no se consultaron. Estos son solo NOMBRES, tomados de `src/lib/agente/whatsapp-meta.ts:4-16`:
   - `WHATSAPP_APP_SECRET`: firma del POST; `WHATSAPP_VERIFY_TOKEN`: desafío del GET (`src/app/api/agente/whatsapp/webhook/route.ts:11-12`). El segundo debe coincidir con la configuración humana del webhook.
   - `AGENTE_CONTACT_HASH_SALT`: mismo secreto estable para bajas, emisor y receptor (`src/app/api/agente/recordatorios-whatsapp/route.ts:21`, `src/app/api/agente/whatsapp/webhook/route.ts:13-17`). No cambiarlo durante una vuelta atrás: dejaría de encontrar las bajas anteriores.
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`: transporte; alcance real del token es DESCONOCIDO y la pregunta CT1 sigue abierta (`src/app/api/agente/recordatorios-whatsapp/route.ts:32-33`).
   - `WHATSAPP_REMINDER_TEMPLATE`, `WHATSAPP_REMINDER_LANGUAGE`: plantilla e idioma (`src/app/api/agente/recordatorios-whatsapp/route.ts:27-30`).
   - `EMAIL_FROM`: opcional/informativa para el diagnóstico; se usa en avisos al administrador (`src/lib/agente/whatsapp-meta.ts:4-8`, `src/app/api/agente/whatsapp/webhook/route.ts:30`).
   Además hacen falta `CRON_SECRET` para las rutas programadas y `RESEND_API_KEY` para correo; no forman parte de ese verificador (`src/lib/cron-auth.ts:9-19`, `src/lib/resend-client.ts:14-16`).
5. **Preparar Meta, todavía sin prometer disponibilidad.** URL propuesta: `https://<dominio-del-piloto>/api/agente/whatsapp/webhook`. El GET compara verify token y devuelve el desafío; el POST exige firma antes de parsear (`src/lib/agente/whatsapp-webhook.ts:39-50`).
   DESCONOCIDO: pantallas, permisos, alta/coexistencia del número, versión y aprobación reales de Meta; las fuentes fallaron antes y no se vuelven a abrir. Pablo debe acreditarlos antes de avanzar. No escribir ni pedir valores de tokens en documentos.
   Usar el contrato propuesto en `docs/agente/tareas/CONTRATO-PLANTILLA-WHATSAPP.md:2-9`: `recordatorio_cita`, `es_CL`, cuatro variables en orden y dos botones **Confirmar**/**Cancelar**. Que esté escrito no significa que Meta lo haya aprobado.
   Asociar el `phone_number_id` que Meta confirme al negocio correcto; es único y se exige si enabled=true (`docs/agente/sql/005_recordatorios_whatsapp_borrador.sql:9-18`). No usar el texto del cliente como identificador del negocio.
6. **Preparar el negocio apagado y comprobar diagnóstico.** Pablo prepara la fila de `agent_whatsapp_settings` con tenant correcto, phone_number_id y retención 15..30; inicialmente `enabled=false`. No hay una pantalla de activación acreditada por esta guía: se requiere operación supervisada.
   Para probar candidatos, Nico autoriza activar SOLO el negocio de pruebas. HECHO: `enabled` se relee antes de procesar/enviar (`src/lib/agente/recordatorios-whatsapp.ts:89-95`, `src/lib/agente/whatsapp-webhook.ts:70-71`).
7. **Separar instalación de programación y de envío real.** Existe cron del informe cada 15 minutos (`vercel.json:30-32`); no hay entradas para recordatorios WhatsApp ni limpieza en ese archivo. Claude solo agregará esas entradas en otro PR, después de revisión y OK de Nico; el horario del recordatorio debe ser distinto del cron de correo, según la decisión C3.
   HECHO: recordatorios tiene `permitirEnvio:false` (`src/app/api/agente/recordatorios-whatsapp/route.ts:14-16`); limpieza tiene `permitirBorrado:false` (`src/app/api/agente/limpieza-retencion/route.ts:6-8`). Activar una fila NO quita esos bloqueos. Cambiarlos requiere PR de código revisado, nunca un cambio de este documento.
   Horarios diferentes reducen coincidencias, pero no garantizan exclusión de ejecuciones manuales solapadas. Antes de envío real, Claude debe cerrar la coordinación con el cron antiguo y el resultado verificable del correo de respaldo (`src/app/api/agente/recordatorios-whatsapp/route.ts:14-16`, `:44-46`). El borrado real sigue bloqueado durante el piloto descrito aquí.
8. **Pruebas de humo, estrictamente en este orden y a cargo de Nico/Pablo.** No las ejecutó Codex. Usar solo datos ficticios y un número de prueba de Nico con su autorización; no mezclar clientes reales.
   1. GET `/api/agente/recordatorios-whatsapp?dryRun=1`, con autenticación Bearer gestionada por Pablo fuera del chat. Esperar dryRun=true, conteos y `configuracion_faltante`; resolver faltantes obligatorias. EMAIL_FROM es informativa. Un 401/503 no habilita omitir la autenticación (`src/lib/agente/informe-programado.ts:37-45`, `src/lib/agente/recordatorios-whatsapp.ts:69-76`).
   2. GET `/api/agente/limpieza-retencion?dryRun=1`, misma autenticación. Revisar candidatos y cero borrados; nada toca bajas (`src/lib/agente/limpieza-retencion.ts:2-3`, `:27-38`).
   3. Mensaje manual de prueba al número autorizado de Nico mediante el canal que Pablo haya verificado en Meta. DESCONOCIDO: mecanismo/pantalla reales de prueba; no se inventa una ruta del repo para ese envío.
   4. Crear una cita ficticia futura del negocio de pruebas. Para el emisor, debe caer en la ventana 20..28 horas (`src/lib/agente/recordatorios-whatsapp.ts:39-45`). Con permiso de código todavía false, el modo real devuelve bloqueo; no continuar hasta revisión y autorización del paso 7.
   5. Tras un envío de prueba aceptado y registrado, pulsar **Confirmar**; verificar estado de cita antes del acuse. Repetir con OTRA cita ficticia para **Cancelar**; el corte usa al menos dos horas de pared chilena (`src/lib/agente/acciones-cita.ts:58-70`). No prometer devolución de abonos.
   6. Enviar «baja» y comprobar su registro; un mensaje posterior no debe generar contacto ni cambiar cita. El acuse de baja inicial es la excepción prevista (`src/lib/agente/whatsapp-webhook.ts:66-81`). No borrar la baja para «reiniciar» la prueba.
9. **Apagar en un minuto.** Propuesta de operación humana: Pablo pone `enabled=false` en el negocio afectado; para todos, lo hace en todas las filas WhatsApp. Confirmar por lectura que están apagadas. El chequeo previo se cita en el paso 6; no cancela una solicitud al proveedor que ya estaba en vuelo.
   Para frenar futuros disparos programados globales, Claude retira/desactiva SOLO las nuevas entradas del agente mediante el proceso aprobado; no tocar crons ajenos. Mantener/restaurar `permitirEnvio:false` y `permitirBorrado:false` con un PR revisado. Esto requiere acceso y despliegue: DESCONOCIDO el tiempo real de esa segunda medida.
10. **Volver atrás sin perder las bajas.** Dejar apagado, detener nuevas ejecuciones y volver al último despliegue revisado con Pablo. Conservar tablas, registros y sal de hashes; no ejecutar DROP ni restablecer reclamos aceptados/inciertos. Reabrir solo tras nueva prueba autorizada.
11. **Mirar fallos sin exponer datos.** Compartir solo conteos/códigos de respuesta, nunca cuerpos de mensajes, teléfonos, correos o secretos. 401/503: revisar autenticación/configuración; `migracion_pendiente`: revisión humana del esquema; `bloqueado_coordinacion`/`borrado_bloqueado`: bloqueo de código esperado, no fallo a saltar (`src/lib/agente/recordatorios-whatsapp.ts:69-76`, `src/lib/agente/limpieza-retencion.ts:22-29`).
   Pablo revisa, en privado, `agent_reminder_deliveries` por tenant/canal/estado: `aceptado_proveedor` no acredita entrega al teléfono; `incierto` no se reenvía automáticamente. Eventos, bajas y límite de aviso están en 006/007; no abrir datos de otros negocios. Fuentes: `docs/agente/sql/005_recordatorios_whatsapp_borrador.sql:37-54`, `src/lib/agente/recordatorios-whatsapp.ts:117-125`.
12. **No dar por terminado un piloto con solo tests simulados.** Las pruebas de humo, Supabase, Meta, Resend y tiempos operativos reales siguen DESCONOCIDOS hasta que Nico/Pablo los registren. Preguntas de producto siguen en sección 11; este PR no las decide.
