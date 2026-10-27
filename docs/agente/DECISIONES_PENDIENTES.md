# Decisiones de Nico — hoja de consulta

**HECHO:** resumen de la sección 11 (`docs/agente/ESPECIFICACION.md:367-397`); incluye R1–R4 y BC1–BC3. Correo ya decidido (#6); regla de merge ya aclarada (#20). **INFERENCIA:** todas las recomendaciones y prioridades siguientes son propuestas. **F1** bloquea habilitar el informe; **F1-auto** solo su automatización; **F2** bloquea recordatorios WhatsApp; **después** puede esperar a fase 3/4. No se activa nada con esta hoja.

| # / tema | Pregunta simple | Recomendación y motivo | Desbloquea |
|---|---|---|---|
| **Informe diario** | | | |
| 15 | **RESPONDIDA — Nico, 26 oct. 2026.** | Opcional por administrador, correo de su perfil; diaria / cada 3 días / semanal / personalizada. | No reabrir destinatarios; implementar preferencias propias. |
| 18 | **RESPONDIDA — Nico, 26 oct. 2026.** | NO consume cupo de correos del negocio. | No aplicar cuota comercial. |
| 19 | **RESPONDIDA — Nico, 26 oct. 2026.** | `no-reply@re-booking.cl`, solo desde `EMAIL_FROM`. Verificación productiva informada por Nico. | Quitar fallback literal en futura tarea de código. |
| 16 | ¿Qué hora y días? | Hora local configurable; respeta cada negocio. | **F1-auto:** horario. |
| 17 | ¿Manual, automático o ambos? | Manual para piloto; ambos después si apruebas automatizar. | **F1-auto:** modalidad. |
| 21 | ¿Agenda de hoy o resultado de ayer? | Ayer para resultados; hoy si quieres preparar jornada. | **F1-auto:** día informado. |
| 22 | ¿Qué hacer si falla o llega tarde? | Revisar manualmente al principio; evita duplicados. | **F1-auto:** recuperación. |
| 23 | ¿Enviar también con cero citas? | Sí durante piloto; distingue vacío de fallo. | **F1-auto:** días vacíos. |
| 24 | ¿Qué servicio programa el envío? | Evaluar Vercel existente con Pablo; capacidad/costo sin verificar. | **F1-auto:** implementación posterior. |
| 6 | ¿Por qué canal? | **HECHO:** correo, ya decidido (`ESPECIFICACION.md:376`). | Resuelto; no volver a decidir. |
| **Recordatorios** | | | |
| 1 | ¿Qué fase priorizamos? | Continuar informes y luego recordatorios; aprovecha lo preparado. | Orden del trabajo; no bloquea decisiones anteriores. |
| R1 | ¿Puede confirmar o cancelar una cita propia? | Derivar primero; escritura requiere identidad y política validadas. | **F2:** acciones autorizadas. |
| R2 | ¿Correo, WhatsApp o ambos? | Correo hasta coordinar canales; evita doble contacto. | **F2:** canal y recuperación. |
| R3 | ¿Cómo se acepta y se respeta una baja? | Priorizar baja y acreditar permiso; evita recontacto indebido. | **F2:** preferencias. |
| R4 | ¿Quién verifica las reglas de Meta? | Claude/Pablo revisan fuente oficial; consulta anterior bloqueada. | **F2:** requisitos externos. |
| **Datos y retención** | | | |
| 7 | ¿De dónde puede responder? | Datos actuales y notas aprobadas; no rellenar huecos. | **Después:** fuentes. |
| BC1 | ¿Quién escribe y quién aprueba? | Editor del negocio + aprobación de Nico para piloto. | **Después:** responsables. |
| BC2 | ¿Cómo mantener respuestas al día? | Consultar datos vigentes; revisar versiones de textos aprobados. | **Después:** actualización. |
| BC3 | ¿Qué decir sobre cancelación y abonos? | Derivar discrepancias; cancelar no equivale a devolver dinero. | **F2** si admite cancelar; después para FAQ. |
| 10 | ¿Cuánto guardar cada dato? | Comparar 30 días con 7/90; justificar necesidad y borrado. | **F2:** preferencias; después conversaciones. |
| 14 | ¿Guardar conversaciones o solo estados? | Solo estados si alcanzan; texto aumenta exposición. | **Después:** panel y auditoría. |
| **WhatsApp y atención** | | | |
| 3 | ¿Meta directo o intermediario? | Comparar operación y costo total con Pablo; no elegir a ciegas. | **F2:** proveedor. |
| 4 | ¿Qué número usa cada negocio? | Número separado si propiedad/portabilidad se verifican. | **F2:** asociación del negocio. |
| 9 | ¿Cómo interviene una persona? | Chat atendido si hay responsable; si no, canal aprobado. | **F2:** respuestas ambiguas. |
| 11 | ¿Qué hacer con fotos, audios y stickers? | No interpretar ni guardar en piloto; derivar. | **F2** entrante; después chat. |
| 12 | ¿Cuántos mensajes permitir y cuándo frenar? | Límite y repetidos juntos; Nico fija cantidades/ventanas. | **F2:** spam y bucles. |
| 13 | ¿Qué idiomas atender? | Español primero; derivar otros idiomas. | **F2** entrante; después chat. |
| **IA y alcance** | | | |
| 2 | ¿Qué proveedor de IA? | Comparar con prueba acotada antes de elegir; sin recomendación validada. | **Después:** fase 3. |
| 5 | ¿Qué puede hacer el asistente del piloto? | FAQ y consultas aprobadas; cambios de cita requieren decisión aparte. | **Después:** fase 4; coordinar con R1. |
| **Costos y reglas de trabajo** | | | |
| 8 | ¿Qué cupo consumen mensajes del agente? | Categoría y límite explícitos; evita cambios de cobro implícitos. | **F2:** cuota WhatsApp. |
| 20 | ¿Quién puede mergear PRs? | **HECHO:** aclarado por Claude/Nico; Nivel 3 activo (`AGENTS.md:122`, `docs/agente/NIVELES.md:24`). | Resuelto; código/SQL esperan a Claude. |

**HECHO:** #15, #18 y #19 respondidas por Nico el 26 oct. 2026; registro en sección 12. **INFERENCIA:** para automatizar faltan #16–17 y #21–24, además de IA1–IA6 (ancla, cambios de frecuencia, horario de verano, autenticación, límites operativos y baja). Opciones y recomendación en sección 11 y `INFORME_POR_ADMINISTRADOR.md`. No se activa nada.
