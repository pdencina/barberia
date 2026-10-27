BORRADOR — NO EJECUTAR

# Textos propuestos para WhatsApp

**INFERENCIA — borradores editoriales:** español chileno sobrio, sin promociones ni datos reales. No son plantillas aprobadas, no se cargaron en Meta ni autorizan envío. Nico decide contenido/acciones; Claude revisa cualquier implementación saliente. Las variables son nombres lógicos de este documento, no sintaxis API verificada.

## Fuentes y categoría

**DESCONOCIDO — consulta 2026-10-26:** no se verificó la regla de categorías utilidad/marketing ni requisitos vigentes de aprobación. Intentos oficiales: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview (HTTP 429) y https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/categories (inaccesible). No se ofrece cita de contenido no leído. Las cinco categorías permanecen DESCONOCIDO hasta resolver R4 de la sección 11.

**INFERENCIA:** su finalidad propuesta es operativa, sin promociones; eso no garantiza categoría utilidad, aceptación o precio. No sustituir aprobación de Meta por la de Nico. Fuera/dentro de ventana y consentimiento siguen sujetos a verificación (`docs/agente/RECORDATORIOS_PROPUESTA.md:25-33`).

## Borradores

Las condiciones de uso de la tabla son **INFERENCIA — requisitos propuestos**, no controles ya construidos. **HECHO editorial:** longitud medida en caracteres Unicode del texto literal, incluidos espacios, puntuación y nombres de variables entre llaves. El texto final puede medir distinto al sustituir variables; no se afirma un límite Meta.

| ID y finalidad | Texto literal | Variables | Longitud literal | Categoría Meta | Condición previa para usar |
|---|---|---|---|---|---|
| P1 — recordatorio | Hola, {{nombre}}. Te recordamos tu cita en {{negocio}} el {{fecha}} a las {{hora}}. Responde CONFIRMO o QUIERO CANCELAR MI CITA. | nombre, negocio, fecha, hora | 128 | **DESCONOCIDO** | Identidad/cita/contexto válidos, permiso y cuota; R1 debe autorizar ambas acciones antes de invitar a ellas. No enviar este texto si solo se aprobó derivación. |
| P2 — confirmación recibida | Hola, {{nombre}}. Tu cita en {{negocio}} del {{fecha}} a las {{hora}} quedó confirmada. | nombre, negocio, fecha, hora | 87 | **DESCONOCIDO** | Cambio de estado comprobado en servidor sobre cita propia y autorización de Nico. “Confirmar” clasificado por sí solo no basta. |
| P3 — cancelación recibida | Hola, {{nombre}}. Tu cita en {{negocio}} del {{fecha}} a las {{hora}} quedó cancelada. | nombre, negocio, fecha, hora | 86 | **DESCONOCIDO** | Cancelación efectivamente registrada y política aprobada; no promete reembolso ni cancela otras citas. |
| P4 — baja aceptada | Recibimos tu solicitud de no recibir más mensajes de {{negocio}}. No cambia tus citas. | negocio | 86 | **DESCONOCIDO** | Bloqueo persistido con alcance acordado en R3; esta única respuesta de acuse también debe estar permitida por política/proveedor. No enviarla si no se puede comprobar baja efectiva o permiso del acuse. |
| P5 — no entendí y contacto humano | No entendí tu respuesta. Te contactará una persona de {{negocio}}. | negocio | 66 | **DESCONOCIDO** | Traspaso real aceptado por equipo responsable y canal aprobado (pregunta 9). Si no existe esa vía/persona, no prometer contacto futuro: derivar por canal aprobado con otro texto revisado. |

## Variables y revisión antes de aprobar

1. **INFERENCIA:** `nombre` solo del cliente verificado de esa cita; `negocio` del tenant resuelto. Fecha legible y hora de pared de Chile de la misma cita. Nunca del texto libre del remitente. La fuente actual de reporte lee nombres/servicios filtrando tenant/día (`src/lib/agente/informe-diario.ts:65-84`), pero no es una herramienta de autorización para clientes.
2. **INFERENCIA:** no poner teléfonos, RUT, notas internas, nombres de terceros ni enlaces sin contexto. Si falta variable aprobada, detener y derivar; no reemplazarla con un dato inventado. Definir muestras sintéticas al presentar plantillas para aprobación.
3. **HECHO:** “confirmo” y “quiero cancelar mi cita” se reconocen en el detector puro (`src/lib/agente/respuesta-cliente.ts:7-13`); el detector no valida contexto (`:3-6`). **INFERENCIA:** usarlo únicamente ante recordatorio abierto y cita propia verificada; “cancelar” fuera de ese contexto puede ser ambiguo. Referencia de revisión: `docs/agente/NIVELES.md:18`.
4. **INFERENCIA:** aprobación final de estos textos, alcance de acciones, baja y traspaso sigue en preguntas R1, R3, R4 y 9. Cambiar texto, categoría, variables o propósito requiere nueva revisión. Registrar solo estado mínimo según opción A/B elegida; este documento no decide guardar conversaciones.

**DESCONOCIDO:** ID/nombre API de plantilla, idioma/categoría aceptados, estado del proveedor, costo y destinatarios de prueba; no encontrados ni verificados. Ningún texto está habilitado para clientes.
