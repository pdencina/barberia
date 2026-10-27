BORRADOR — NO EJECUTAR

# T10 — claves puras de deduplicación

**HECHO local:** envío usa tenant + fecha informada + finalidad + canal; evento entrante usa tenant + referencia del proveedor. Serialización de tupla JSON con dominio/versionado y SHA256; solo devuelve prefijo fijo y digest (`src/lib/agente/clave-deduplicacion.ts:1-34`). No lee entorno, reloj, red o base, ni devuelve entradas o errores con sus valores. Fecha validada por aritmética, sin convertir zonas horarias.

**INFERENCIA — contrato:** identificadores canónicos del servidor, no del navegador ni del mensaje del cliente. Se comparan exactamente; no quitar tildes, cambiar mayúsculas o recortar referencias silenciosamente. Canal cerrado email/whatsapp. Texto vacío, bordes con espacios, controles y fechas imposibles producen error genérico; las finalidades se reciben explícitamente, sin decidir acciones o cuota.

**INFERENCIA — alcance:** la tupla evita ambigüedad de separadores y el tenant separa las entradas antes del hash. Las pruebas verifican estabilidad y separación en muestras; no demuestran que dos entradas diferentes jamás puedan colisionar matemáticamente. No presentar SHA256 como cifrado o anonimización: un valor predecible podría adivinarse por enumeración. No almacenar teléfono/RUT en claro para acompañar la clave; no incluir texto en logs.

**HECHO de prueba:** `scripts/test-agente-clave-deduplicacion.ts:1-64` verifica 1.600 combinaciones de envío y 200 eventos de tenants distintos con misma referencia, sin colisiones observadas; 3.452 comprobaciones pasan. **INFERENCIA:** no es una prueba de ausencia universal de colisiones ni de entrega.

**INFERENCIA — pendientes de integración:** construir la clave no reclama ni persiste el envío. Hacen falta índice/exclusión atómica, estado incierto y política de reintentos (`docs/agente/ENVIO_DIARIO_PROPUESTA.md:46-49`). Respuestas repetidas del proveedor y cambio de horario/versión de una cita pueden requerir ampliar el contexto de otra finalidad/versionado tras revisión; no inventar aquí esa semántica. Si un negocio utiliza dos proveedores con referencias que se solapan, definir su namespace canónico antes de integrarlos. Nada está conectado a rutas y T10 espera revisión de Claude.
