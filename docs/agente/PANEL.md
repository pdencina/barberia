BORRADOR — NO EJECUTAR

# Bocetos del panel del negocio

**HECHO — actualización 26 oct. 2026:** preferencias de informe propias del administrador, correo de su perfil y acceso solo propio/super_admin, por decisión de Nico. **INFERENCIA:** para Fase 1 rige el boceto de `INFORME_POR_ADMINISTRADOR.md`, sección 6; la lista libre por negocio de este boceto anterior queda superada. PN1 sigue abierta solo para WhatsApp.

**INFERENCIA — propuesta de pantallas, sin código ni activación.** Desarrolla sección 8 de la especificación. Ninguna pantalla de este documento existe por aprobar el PR. Botones, permisos de edición y persistencia nuevos están pendientes de construir/revisar; Nico decide PN1, preguntas 9–10, 14–19 y 21–24.

## 1. Configuración

**INFERENCIA — boceto de texto:**

```text
Negocio: [negocio autorizado de la sesión]
Agente WhatsApp: APAGADO
Informe por correo: APAGADO
Automatización diaria: PENDIENTE DE DECISIÓN / APAGADA
Destinatarios aprobados: [lista del negocio, sin valor supuesto]
Día informado / hora local / días de envío: SIN CONFIGURAR
Vía de atención humana: SIN CONFIGURAR
Estado de datos: [disponibles / falta aplicar migración / error]
[Guardar configuración] [Apagar negocio] [Solicitar activación]
```

**INFERENCIA:** mostrar siempre el negocio resuelto y no un tenant libre editable. Guardar debe validar sesión, rol y negocio; activar no debe estar disponible sin destinatarios/vía humana, política y fuentes aplicables. Tabla faltante: deshabilitar guardar/activar y mostrar migración pendiente; no tratarlo como un guardado exitoso.

| Dato de pantalla | HECHO de fuente actual o borrador | Falta para construir |
|---|---|---|
| Apagado del informe y lista de correos | Borrador `agent_daily_report_settings`: tenant, `enabled=false`, destinatarios. `docs/agente/sql/002_informe_diario_email_borrador.sql:5-13`. Lector actual `src/lib/agente/informe-diario.ts:150-172` | Tabla aplicada DESCONOCIDO; editor, validación de propiedad del correo y permisos PN1 pendientes. |
| Agente WhatsApp y modo de traspaso | Borrador `agent_business_settings`: tenant, `enabled=false`, modo cerrado. `docs/agente/sql/001_agente_whatsapp_borrador.sql:8-21` | Editor/lector operativo, destinos y disponibilidad del equipo no están en esas columnas. |
| Hora, días, día informado y automático separado | Propuestas `docs/agente/ENVIO_DIARIO_PROPUESTA.md:25-49` | No están en el borrador 002; requieren modelo/validación nuevos tras decisión de Nico. |
| Conocimiento aprobado | Borrador `agent_knowledge_items`: tipos, activo, aprobación y vigencia. `docs/agente/sql/001_agente_whatsapp_borrador.sql:23-37` | Editor, identidad del aprobador/versiones e invalidación; BC1–BC2. No duplicar catálogo/horarios; mapa en `docs/agente/BASE_CONOCIMIENTO.md:11-26`. |
| Cupo disponible | Ruta de lectura por negocio `src/app/api/message-quota/route.ts:8-20`; Configuración ya la consulta `src/app/dashboard/configuracion/page.tsx:434-442` | Definir si/cuánto consume el informe y agente; no usar cuota como estado de entrega. |

**INFERENCIA — al apagar:** impedir futuros envíos/respuestas según alcance del interruptor; no borrar textos, citas o bloqueos, ni prometer cancelar mensajes en curso. El informe actual solo comprueba al comenzar (`src/app/api/agente/informe-diario/route.ts:31-39`); verificación justo antes del envío y apagado global siguen propuestos (`docs/agente/ENVIO_DIARIO_PROPUESTA.md:41-45`). No se muestra un botón global funcional sin construirlo.

## 2. Conversaciones: opción A, solo estado

**INFERENCIA — boceto:** lista “Conversación de prueba A · entrante · texto · derivada · fecha/hora”; detalle de estados y resultados, sin burbujas ni búsqueda por contenido. Botones propuestos: [Ver estados], [Solicitar intervención del equipo], [Ver preferencia de contacto]. No mostrar nombre o teléfono como si existieran en el modelo de conversación.

**HECHO del borrador:** conversaciones guardan referencia hash, cierre/escalamiento y vencimiento (`docs/agente/sql/001_agente_whatsapp_borrador.sql:52-63`); mensajes, dirección/tipo/resultado y referencias (`:65-81`); preferencias, opt-in/opt-out/bloqueo (`:39-50`). **INFERENCIA:** A deja ambos textos en NULL. No permite mostrar “qué dijo”, resúmenes cualitativos ni explicar literalmente una respuesta. Asociar una conversación a un cliente real requeriría identidad autorizada, no recuperar teléfonos a partir de un hash.

**INFERENCIA — al apagar:** historial mínimo sigue sujeto al plazo aprobado, pero no se generan respuestas nuevas. Abrir una fila no reactiva nada. Intervención/asignación humana, editor de preferencias y controles del panel están pendientes; la tabla no tiene asignación de operador en esas columnas.

## 3. Conversaciones: opción B, texto redactado

**INFERENCIA — boceto:** misma lista de estados y detalle con burbujas parciales “[texto redactado de prueba]”, etiqueta “contenido recortado/redactado” y vencimiento. Botones: [Ver estados], [Solicitar intervención], [Reportar respuesta incorrecta]. No ofrecer descargar texto completo ni restaurar lo borrado.

**HECHO del borrador:** `incoming_text_redacted` y `outgoing_text_redacted` son opcionales, con `retention_until` (`docs/agente/sql/001_agente_whatsapp_borrador.sql:72-75`). **INFERENCIA:** solo mostrar si Nico eligió B, plazo/acceso/redacción están definidos y el dato no venció. No asumir que un valor no NULL ya pasó un filtro de privacidad; ese procesamiento no está implementado por el SQL.

**INFERENCIA — al apagar:** no borrar ni prolongar retención de forma implícita. Un botón “Reportar” recopilaría solo referencia/estado mínimo aprobado; sin enviar datos a otra persona automáticamente. Mecanismo de borrado, auditoría de acceso y pantalla siguen pendientes de construir.

## 4. Informes

**INFERENCIA — boceto:** selector de fecha, “Citas totales”, “Pendientes”, “Canceladas”, “No asistió” y detalle por profesional: hora/servicio/cliente/estado. Botones propuestos: [Ver vista previa], [Enviar manualmente] y estado separado [aceptado por proveedor / fallido / incierto], este último pendiente de persistencia. Canceladas visibles y marcadas; no sumar canceladas/no_show al total.

**HECHO:** el reporte se construye desde citas y relaciones, con tipos y contadores (`src/lib/agente/informe-diario.ts:31-39`, `:65-84`, `:117-138`); el POST actual exige sesión/gestión/negocio, envía y retorna conteos (`src/app/api/agente/informe-diario/route.ts:7-21`, `:50-65`). **INFERENCIA:** no usar ese POST para una vista previa, porque envía. Haría falta lectura sin envío para el botón de vista previa. Roles del POST actual incluyen recepción (`src/lib/supabase/server.ts:106-109`); eso no decide quién puede editar destinatarios o activar automatización.

**INFERENCIA:** no existe historial de entregas en las columnas del borrador 002 ni en la respuesta actual del POST; por tanto no dibujar un historial funcional sin registro nuevo. No presentar `sent: true` como “llegó al destinatario”. Opción A/B de chat no cambia por sí sola las citas que ya alimentan este informe. **Al apagar:** deshabilitar envío; permitir solo consulta autorizada, sin borrar agenda ni alterar estados.

**DESCONOCIDO:** tablas realmente aplicadas, datos reales, permisos finales, datos de destinatarios y entrega; no se inspeccionaron. Esta propuesta no crea rutas ni pantallas y no resuelve retención, destinatarios, horarios ni acciones por Nico.
