# TANDA D (despues de terminar la tanda C; solo documentacion, la puedes mergear tu)
Orden: primero termina TODO lo pendiente de la tanda C (revisa las ultimas 30 lineas de `docs/agente/BITACORA.md`). Solo despues empieza esta. Dos PRs de solo documentacion en `docs/agente/` (Nivel 3: puedes mergearlos tu si las dos revisiones estan verdes). Sin codigo, sin SQL, sin cron.

## D1 `docs/agente/PILOTO.md` (guia de puesta en marcha para Nico y Pablo, maximo 120 lineas)
Pasos NUMERADOS y concretos, en lenguaje simple (Nico no programa), solo con hechos del repo (cita ruta:linea cuando afirmes algo del codigo; marca DESCONOCIDO lo que dependa de Meta):
1. Orden exacto de los SQL 003 a 007 y como verificar cada uno (consulta de verificacion al final de cada archivo); primero en el Supabase de pruebas (`rebooking Base`), despues en produccion con respaldo y OK de Nico.
2. Variables de entorno en Vercel (solo NOMBRES, nunca valores; las de `verificarConfiguracionWhatsApp`), quien las crea y donde se usa cada una.
3. Configuracion en Meta: webhook (URL de `/api/agente/whatsapp/webhook`, verify token), plantilla con botones Confirmar y Cancelar (contrato en `docs/agente/tareas/CONTRATO-PLANTILLA-WHATSAPP.md`), numero y `phone_number_id`.
4. Como se enciende un negocio (fila en `agent_whatsapp_settings` con `enabled`), cuando Claude agrega los cron en `vercel.json` y como se habilita el envio real (`permitirEnvio`).
5. Pruebas de humo en este orden: dryRun de recordatorios, dryRun de limpieza, un mensaje de prueba a un numero de Nico, una cita de prueba, un "Confirmar" y un "Cancelar" por boton, una baja.
6. Como apagarlo en un minuto (por negocio y para todos) y como volver atras.
7. Que mirar si algo falla (respuestas con conteos de cada ruta, registros de envios) sin exponer telefonos.

## D2 `docs/agente/AUDITORIA-RUTAS-AGENTE.md` (matriz, maximo 80 lineas)
Una tabla de CADA ruta bajo `src/app/api/agente/`: metodo, como se autentica (sesion y rol, `verifyCron` o firma del webhook), de donde sale el negocio, si acepta datos del navegador, que escribe, y que prueba la cubre (ruta del script). Al final, lista de brechas que veas (sin arreglarlas) como pregunta para Claude. No repitas hallazgos ya resueltos.

Informe final: 6 lineas, y detente. No inventes mas tareas.
