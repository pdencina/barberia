BORRADOR — NO EJECUTAR

# Guía de operación para Nico y Pablo

**INFERENCIA — procedimiento propuesto.** No habilita el agente ni autoriza acciones en producción. “Pendiente de construir” significa que no hay un botón/procedimiento implementado verificado. No ejecutar SQL, pegar secretos ni enviar mensajes reales para probar esta guía.

## 1. Apagar un negocio en un minuto

1. **HECHO:** el informe manual comprueba `enabled` del negocio y se detiene si está apagado (`src/lib/agente/informe-diario.ts:150-172`; `src/app/api/agente/informe-diario/route.ts:31-39`). **DESCONOCIDO:** tabla aplicada y estado real del negocio; no se revisó la base.
2. **HECHO:** al buscar `agent_daily_report_settings`, `agent_business_settings` y `/api/agente/` en `src/`, se encuentra el lector del informe, no una pantalla/ruta para editar esos interruptores (`src/lib/agente/informe-diario.ts:154-158`). **Pendiente de construir:** botón de apagado y confirmación visual. Hoy no se puede garantizar un apagado en un minuto desde el panel.
3. **INFERENCIA:** Nico avisa a Pablo, identifica el negocio por una referencia interna sin copiar datos de clientes y pide detener nuevos intentos del informe. Pablo verifica si existe configuración aplicada y usa solo el procedimiento de cambio autorizado por Nico; esta guía no proporciona ni ejecuta SQL.
4. **INFERENCIA — pendiente de construir:** desactivar por negocio el agente/WhatsApp y los trabajos en espera, y comprobar de nuevo antes de cada envío. Propuesto en `docs/agente/RECORDATORIOS_PROPUESTA.md:68-70` y `docs/agente/ENVIO_DIARIO_PROPUESTA.md:82-85`. No confundir estos interruptores futuros con la comprobación del informe actual.
5. **INFERENCIA:** comprobar apagado con simulación o lectura de configuración por operador, sin disparar un correo. Un mensaje ya aceptado o un envío en curso puede no ser cancelable; no prometer retirada del mensaje.

## 2. Apagar para todos

1. **Pendiente de construir — INFERENCIA:** interruptor global del agente y comprobación antes de generar/responder/enviar. No encontrado al buscar los mismos identificadores en `src/`; el lector actual solo consulta un tenant (`src/lib/agente/informe-diario.ts:150-158`).
2. **INFERENCIA:** Nico solicita a Pablo detener el futuro disparador y todo nuevo intento del agente, dejando registro del alcance. Propuesta de contingencia: `docs/agente/ENVIO_DIARIO_PROPUESTA.md:82-85`. No modificar desde esta guía cron, Vercel ni producción; esa intervención requiere autorización y procedimiento operativo propio de Pablo.
3. **INFERENCIA:** no apagar a ciegas correos/recordatorios legacy ajenos al agente ni borrar registros para vaciar colas. Reanudar solo cuando Nico apruebe y Pablo/Claude verifiquen la corrección y los envíos inciertos.

## 3. Un cliente informa un mensaje equivocado

1. **INFERENCIA:** no pedir que publique el mensaje en un grupo ni copiar nombre, teléfono, RUT o conversación al PR. Pedir referencia mínima de incidente por canal privado autorizado; canal y acceso pendientes (RB1).
2. **INFERENCIA:** identificar negocio, día informado, canal y estado del envío; comprobar que el destinatario estaba aprobado y que el cliente/cita pertenecían al negocio. El reporte actual devuelve solo fecha/conteos (`src/app/api/agente/informe-diario/route.ts:57-65`); **pendiente de construir:** historial consultable de entregas y datos mínimos de auditoría (`docs/agente/ENVIO_DIARIO_PROPUESTA.md:46-48`).
3. **INFERENCIA:** detener nuevos intentos del negocio por el procedimiento autorizado de sección 1. No reenviar el mismo informe “para probar” ni concluir que fue entregado por ver `sent: true`.
4. **INFERENCIA:** Nico avisa a Pablo y Claude para revisión de aislamiento, destinatarios y datos expuestos; no prometer a la persona acciones legales, borrados o recuperación no comprobados. No cambiar citas para ocultar el incidente.
5. **INFERENCIA:** documentar causa y alcance mínimos, corregir en PR revisado y pedir aprobación de Nico antes de reactivar. Si el problema pertenece a un PR mergeado solo por Codex, detener el lote y esperar a Claude; no modificar AGENTS/NIVELES. Regla: `AGENTS.md:135`.

## 4. Spam o bucle

1. **INFERENCIA:** suspender respuestas del negocio afectado mediante procedimiento autorizado; no contestar a cada mensaje repetido ni devolver contenido de entrada completo a logs.
2. **HECHO:** el detector no cuenta mensajes y no aplica cupos (`src/lib/agente/respuesta-cliente.ts:23-44`). La cuota de mensajes no es un límite de velocidad ni evita reenvíos de la misma referencia (`src/lib/message-quota.ts:123-145`).
3. **Pendiente de construir — INFERENCIA:** límite por contacto/negocio, deduplicación y alerta con conteos sin texto. Nico fija cantidades y duración en pregunta 12. Pablo identifica origen; Claude revisa controles; Nico autoriza reactivar. No bloquear permanentemente clientes por una suposición.

## 5. Caída del proveedor

1. **HECHO:** el envío de informe lanza error si Resend devuelve `error` y la ruta responde error genérico (`src/lib/agente/informe-diario-email.ts:72-81`; `src/app/api/agente/informe-diario/route.ts:66-68`). Eso no informa si un timeout dejó un envío aceptado.
2. **INFERENCIA:** detener reintentos ciegos. Pablo revisa evidencia mínima del proveedor con su acceso habitual, sin compartir llaves; si no puede comprobar aceptación, tratar como incierto. El estado persistido y panel de revisión están **pendientes de construir** (`docs/agente/ENVIO_DIARIO_PROPUESTA.md:46-49`).
3. **INFERENCIA:** Nico decide si se recuperan atrasos y por qué canal (preguntas 22/R2). No activar WhatsApp como reemplazo automático ni duplicar correo por defecto. Una vez resuelto, probar sin envíos reales y revisar con Claude antes de reactivar.

## 6. Revisar cuota

1. **HECHO:** Configuración consulta `/api/message-quota` (`src/app/dashboard/configuracion/page.tsx:434-442`) y muestra “Cupo de Mensajeria”, WhatsApp y Correos (`:947-960`). Usar sesión autorizada y negocio correcto; no modificar IDs en el navegador.
2. **HECHO:** la ruta valida negocio y devuelve ambos canales; es lectura (`src/app/api/message-quota/route.ts:8-20`). `getQuotaStatus` informa límite, usado y restante (`src/lib/message-quota.ts:75-86`). Si la pantalla no carga, no interpretar ausencia como cupo ilimitado.
3. **INFERENCIA:** no comprar ni aumentar cupos sin Nico. La regla del informe interno sigue pendiente (#18); estas cifras tampoco prueban cantidad de mensajes entregados. Si hay discrepancia, Pablo/Claude revisan el registro, sin descontar o devolver unidades manualmente desde esta guía.

## 7. Quién avisa a quién

**INFERENCIA — propuesta pendiente en RB1:** Nico recibe el aviso del negocio, comunica impacto mínimo a Pablo y Claude, y decide apagado/reactivación; Pablo verifica operación/proveedor; Claude revisa causa/corrección y seguridad. **DESCONOCIDO:** contactos privados, canal, suplente y horario de disponibilidad; no encontrados en el repositorio. No se contactó a nadie desde esta tarea. Elegirlos antes del piloto; no prometer atención permanente.
