# Qué falta para encender WhatsApp

Lista de pendientes al 27 de octubre de 2026. **ABIERTO** significa que no se verificó su cumplimiento externo; este documento no autoriza ejecutar SQL ni activar envíos. Los PR #173, #174 y #175 siguen sin merge, a revisión de Claude.

- [ ] **ABIERTO — Meta verificada:** confirmar cuenta, número del negocio y webhook con firma. Validación externa pendiente de Pablo; no se hicieron llamadas reales.
- [ ] **ABIERTO — Variables en Vercel por Pablo:** configurar y comprobar las variables requeridas de WhatsApp, firma, verificación y sal de hashes sin copiarlas a documentos, logs ni al repositorio. No se leyeron archivos de entorno.
- [ ] **ABIERTO — Plantilla aprobada con botones Confirmar/Cancelar:** comprobar idioma español y contrato de variables/botones de [la plantilla](tareas/CONTRATO-PLANTILLA-WHATSAPP.md), incluido el vínculo al recordatorio. No se enviaron mensajes de prueba reales.
- [ ] **ABIERTO — SQL 005–007 en producción, solo con OK de Nico:** Claude/Pablo revisan primero y Nico autoriza la ejecución manual, después de pruebas. Borradores: [005](sql/005_recordatorios_whatsapp_borrador.sql), [006](sql/006_eventos_whatsapp_borrador.sql), [007](sql/007_aviso_administrador_borrador.sql). Codex no los ejecutó ni verificó su aplicación.
- [ ] **ABIERTO — Cron de recordatorios:** Claude debe coordinarlo con el cron anterior para evitar dobles envíos; después Pablo configura y valida el cron autorizado. El bloqueo actual está descrito en `src/app/api/agente/recordatorios-whatsapp/route.ts:14`.
- [ ] **ABIERTO — Revisión de Claude y validación previa:** revisar E3/EFAQ1/E4, combinar el lector conservando `const consultar`, probar baja, aislamiento, deduplicación, máximo 10/hora y corte al tercer idéntico. Sin horarios completos por sucursal se deriva a una persona; no se extrapolan días.
- [ ] **ABIERTO — Activar `permitirEnvio` en una tarea posterior y autorizada:** solo tras resolver los puntos anteriores y el bloqueo del cron, con OK de Nico y ejecución por Claude/Pablo. Hoy sigue `false` en `src/app/api/agente/recordatorios-whatsapp/route.ts:16`; el manejador bloquea envíos sin ese permiso (`src/lib/agente/recordatorios-whatsapp.ts:74`). El negocio también debe habilitarse explícitamente. `permitirBorrado` permanece `false` (`src/app/api/agente/limpieza-retencion/route.ts:8`); esta lista no pide activarlo.

Estado de la tanda y PR: [índice](tareas/INDICE.md). Este PR solo modifica documentación.
