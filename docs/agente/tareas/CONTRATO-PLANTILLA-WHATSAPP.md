# Contrato propuesto de recordatorio (C4)
INFERENCIA de implementación, 27 oct. 2026: nombre `recordatorio_cita`, idioma `es_CL`; configurar mediante WHATSAPP_REMINDER_TEMPLATE y WHATSAPP_REMINDER_LANGUAGE, sin respaldo literal en la ruta. DESCONOCIDO: alta, aprobación y disponibilidad reales en Meta; este documento no las acredita.
Las cuatro variables del cuerpo, en orden (sin IDs ni teléfonos):
1. Fecha y hora de la cita: «miércoles 28 de octubre, 15:30».
2. Hora: «15:30». Se conserva la segunda posición del contrato existente; es repetición deliberada, no otra zona horaria.
3. Profesional.
4. Servicio(s).
Propuesta de cuerpo: «Te recordamos tu cita del {{1}}. Hora: {{2}}. Profesional: {{3}}. Servicio: {{4}}.»
DOS botones de respuesta rápida: **Confirmar** y **Cancelar**, en ese orden; payload, si la configuración lo suministra, `confirmar` / `cancelar`. No URLs ni IDs de citas en botones.
HECHO: `variablesPlantillaRecordatorio` usa parseWallClock y UTC para preservar los campos de pared ya chilenos (`src/lib/agente/plantilla-recordatorio.ts:4`); no aplica dos veces America/Santiago.
HECHO: el extractor usa button.payload si existe y button.text solo si no existe (`src/lib/agente/whatsapp-meta.ts`, rama C4). Un payload vacío/no válido no se reemplaza por el título. La intención no autoriza una cita: el webhook verifica referencia de proveedor y contacto.
No registrar ni aprobar plantillas ni enviar mensajes reales desde este PR. Revisan Claude y Nico antes de habilitar.
