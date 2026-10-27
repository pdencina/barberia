# Hallazgos F1 — abiertos para Claude

Base: `claude/e3-e4-combinado`, commit `a898cc4`. Solo pruebas y documentación; no se corrigió `src/`. Datos enteramente sintéticos. Los cinco casos fallidos se retiraron del ejecutable con comentarios `EXCLUIDO F1-xx`; **no cuentan como aprobados**. Quedan 227 casos activos, incluidas 85 entradas hostiles probadas contra la FAQ y el webhook con el adaptador real y una base en memoria.

## F1-01 — Negocio inactivo con agente todavía habilitado

- Caso mínimo: en `fixture()`, `f.tablas.tenants[0].active = false`; dejar `flags.enabled = true`; enviar `¿Cuál es la dirección?` con `f.post(...)`.
- Esperado por la prueba: cero mensajes salientes para el negocio inactivo.
- Obtenido: un mensaje `Te contactará una persona.` y aviso al administrador; no expone datos comerciales.
- Evidencia: `datos-negocio.ts:56` devuelve `null`; `whatsapp-webhook.ts:109` y `:115` convierten la ausencia en traspaso. La habilitación del agente y el estado del negocio son controles separados.
- Caso retirado: `W-inactivo-no-envia`. ABIERTO: revisar con Claude el bloqueo de salidas por estado del negocio; no se activó ni desactivó nada real.

## F1-02 — Negocio suspendido con agente todavía habilitado

- Caso mínimo: `f.tablas.tenants[0].status = "suspended"`, con `flags.enabled = true`; `f.post("¿Cuál es la dirección?")`.
- Esperado por la prueba: cero mensajes salientes para el negocio suspendido.
- Obtenido: un mensaje `Te contactará una persona.` y aviso al administrador; los datos del negocio no se devuelven.
- Evidencia: mismo recorrido de F1-01 (`src/lib/agente/datos-negocio.ts:56`, `src/lib/agente/whatsapp-webhook.ts:109` y `:115`).
- Caso retirado: `W-suspendido-no-envia`. ABIERTO para Claude.

## F1-03 — Pregunta general de horario cuando ninguna sucursal tiene semana

- Caso mínimo puro: datos con `sucursales: [{id:"centro", nombre:"Centro", direccion:null, horario:[]}]`; preguntar `¿Qué horario tienen?`.
- Caso mínimo integrado: añadir a `f.tablas.branches` una sucursal activa `centro` del tenant `A`, sin ninguna fila de horario con `branch_id:"centro"`; hacer la misma pregunta.
- Esperado según la tarea F1: traspaso; en el webhook, `Te contactará una persona.` y aviso al administrador, sin elegir una sucursal.
- Obtenido puro e integrado: respuesta `¿De qué sucursal necesitas el horario? Sucursales: Centro. Indica la sucursal en tu consulta.` No inventa horarios ni elige una, pero tampoco deriva pese a no existir una semana de sucursal.
- Evidencia: `src/lib/agente/faq-fija.ts:76` pregunta cuál antes de validar la semana (`:90`).
- Casos retirados: `P-sucursales-todas-sin-horario` y `W-sucursales-todas-sin-horario`. ABIERTO para Claude. Los casos que nombran la sucursal y tienen 0, 1 o 6 días sí derivan y permanecen activos.

## F1-04 — El tercer texto idéntico no se corta si supera la memoria del extractor

- Caso mínimo: mismo fixture y contacto, tres eventos con IDs distintos y texto `"x".repeat(LIMITE_TEXTO_EN_MEMORIA + 1)` (16.385 caracteres).
- Esperado: dos respuestas; la tercera queda limitada por ser idéntica a las dos anteriores.
- Obtenido: tres respuestas de traspaso. El límite general de 10 por hora sigue funcionando; esta prueba no demuestra un bypass de ese límite.
- Evidencia: `src/lib/agente/whatsapp-meta.ts:25` y `:173` descartan el texto que excede 16.384; `src/lib/agente/whatsapp-webhook.ts:68` usa el ID del evento cuando el texto es `null`, por lo que cambian los hashes. No se guardó ni registró el texto.
- Caso retirado: `W-tercer-identico-fuera-memoria`. ABIERTO para Claude. Tres textos idénticos de 5.000 caracteres sí se cortan; esa regresión permanece activa.

## Validación y límites

`npx tsx scripts/test-agente-faq-adversarial.ts`: 227 casos pasan, cinco retirados. Captura `log/info/warn/error/debug` durante cada caso y exige silencio; verifica ausencia del mensaje completo y del marcador privado en HTTP, respuestas simuladas, avisos, consultas y datos persistibles. Vacío/espacios se prueban como traspaso, sin comparar la subcadena vacía. Los controles positivos verifican las seis intenciones para evitar que un traspaso general haga pasar toda la suite.

No se probó Meta, correo, producción ni una base real. No se leyeron llaves ni entorno. `permitirEnvio` y `permitirBorrado` no se tocaron. Fuentes con rutas abreviadas de arriba: todas pertenecen a `src/lib/agente/`. Los fallos necesitan revisión de Claude en un PR de código posterior, fuera de F1.
