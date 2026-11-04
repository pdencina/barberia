# Borrador: tratamiento de mensajes con IA (modo Avanzado) — para revisión de abogado

Texto sugerido para la política de privacidad del negocio y el contrato de encargo (NO es asesoría legal):

- Si el negocio activa las respuestas con IA, el texto de los mensajes de WhatsApp que el sistema no puede responder con reglas fijas se envía a **Anthropic, PBC** (proveedor de IA) únicamente para interpretar qué pregunta hizo el cliente (la IA solo elige un texto ya escrito por el negocio; no redacta respuestas).
- No se guarda el texto de los mensajes de los clientes en re-booking. Solo se cuenta cuántas respuestas con IA se dieron por mes.
- No se envían mensajes que contengan RUT, números de tarjeta o correos, ni los que traten de salud, reclamos o devoluciones: los atiende una persona.
- La respuesta que recibe el cliente es siempre texto escrito por el administrador del negocio; si ninguna línea responde, se deriva a una persona. Además del mensaje, se envía a Anthropic el texto del contexto del negocio (información comercial).
- Anthropic actúa como subencargado de tratamiento (transferencia internacional de datos: Ley 21.719). Revisar cláusulas y retención de datos de la API con el abogado antes de activar en producción.
- Dato técnico pendiente: confirmar la política vigente de retención de Anthropic para la API (por defecto no entrena con datos de la API; verificar en el contrato).
