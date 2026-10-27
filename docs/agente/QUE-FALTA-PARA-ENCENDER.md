
## Coordinación de recordatorios (hecho)
- `/api/cron/reminders` (el de siempre, por correo) **omite** a los negocios con `agent_whatsapp_settings.enabled=true`; esos los atiende `/api/agente/recordatorios-whatsapp` (WhatsApp con respaldo por correo). Nadie recibe dos avisos.
- La ruta nueva solo envía si en Vercel existe `AGENTE_RECORDATORIOS_ENVIO=1` (interruptor global). Sin la variable responde 503 salvo `?dryRun=1`.
- El cron de la ruta nueva NO está en `vercel.json` a propósito (fallaría cada 15 min sin la variable). Al encender: agregar `{"path":"/api/agente/recordatorios-whatsapp","schedule":"*/15 * * * *"}`.
