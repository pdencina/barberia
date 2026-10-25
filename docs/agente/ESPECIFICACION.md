# Especificación — Agente de WhatsApp por negocio (ESQUELETO)

> **Estado:** ESQUELETO. Nada de esto está construido. Esta rama (`agente/whatsapp`) **no se despliega y no toca producción**.
> **Completa:** Codex · **Revisa y promueve a producción:** Claude · **Decide:** Nico.
> Reglas para quien completa: `AGENTS.md` (sección 11). Marca cada afirmación como **HECHO** (con `ruta:línea`), **INFERENCIA** o **DESCONOCIDO**. Cita fuentes oficiales con **URL y fecha de consulta**.

## 0. Cómo trabajamos (resumen)
1. Rama de trabajo: `agente/whatsapp`. Codex abre sus PRs **hacia `agente/whatsapp`, nunca hacia `main`**.
2. Codex escribe **solo dentro de `docs/agente/`** (esta especificación, borradores de SQL en `docs/agente/sql/`, borradores de código en `docs/agente/borradores/`). Todo borrador va marcado "BORRADOR — NO EJECUTAR".
3. Claude revisa los cambios con el **Anexo A** y los pasa a `main` en PRs chicos, uno por tema, cuando Nico lo apruebe.
4. Nada se ejecuta en Supabase/producción sin el OK de Nico en ese momento (primero en `rebooking-pruebas`).

## 1. Objetivo y alcance
- **Objetivo:** que cada negocio tenga un asistente conectado a su WhatsApp que (a) responda preguntas frecuentes de clientes, (b) envíe recordatorios, (c) entregue informes de citas y mensajes al negocio.
- **Ya decidido por Nico:** es **por negocio**; el agente **no inventa** (responde solo con datos del negocio) y **pasa a una persona** cuando no sabe; se prueba primero con **Estudio Levels**.
- **Dentro del alcance:** [Codex: lista concreta]
- **Fuera del alcance:** [Codex: lista concreta]

## 2. Fases y entregables
| Fase | Qué entrega | ¿Usa IA? | ¿Usa WhatsApp API? | Riesgo | Depende de |
|---|---|---|---|---|---|
| 1 | Informe diario de citas al negocio | No | [Codex: por correo o WhatsApp] | Bajo | — |
| 2 | Recordatorios automáticos con plantillas + confirmación del cliente | No | Sí | Medio | Meta: plantillas aprobadas |
| 3 | Chat de prueba dentro del panel (sin WhatsApp) | Sí | No | Medio | Base de conocimiento del negocio |
| 4 | Responder preguntas frecuentes por WhatsApp con traspaso a persona | Sí | Sí | Alto | Fases 2 y 3 |

[Codex: criterios de "terminado" por fase]

## 3. Requisitos y restricciones externas (verificar con fuentes oficiales)

### 3.1 WhatsApp Business Platform (Meta)

**HECHO — consulta: 2026-10-25.** Para contactar a una persona por WhatsApp, el negocio debe tener su número o usuario y un opt-in para recibir mensajes posteriores; debe respetar toda solicitud de no recibir más comunicaciones. Fuente oficial: [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/) (consultada el 2026-10-25).

**HECHO — consulta: 2026-10-25.** Una conversación iniciada por el usuario abre o reinicia una ventana de atención de 24 horas. Dentro de ella se puede responder sin plantilla; fuera de ella solo se puede enviar una plantilla aprobada. Las conversaciones iniciadas por el negocio también requieren plantilla aprobada. Fuente oficial: [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/) (consultada el 2026-10-25).

**HECHO — consulta: 2026-10-25.** La automatización dentro de esa ventana exige una vía de escalamiento clara, rápida y directa a una persona. El flujo del agente debe incluir traspaso humano antes de cualquier piloto. Fuente oficial: [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/) (consultada el 2026-10-25).

**HECHO — consulta: 2026-10-25.** Meta cobra por mensaje desde el 1 de julio de 2025; las categorías publicadas son marketing, utilidad, autenticación, servicio y Meta Business Agent. Las tarifas dependen de categoría y mercado. Desde el 1 de octubre de 2026, los primeros 1.000 mensajes de servicio mensuales por número comercial son sin cargo y los siguientes se cobran según tarifa publicada. No se incorpora una cifra de precio aquí: debe consultarse la tarifa vigente al diseñar costos. Fuente oficial: [FAQ de WhatsApp Business](https://whatsappbusiness.com/resources/faq/) (consultada el 2026-10-25).

**DESCONOCIDO.** No pude verificar en una fuente oficial accesible los requisitos operativos exactos y vigentes para la verificación de cada negocio ni una obligación de Meta de usar exactamente un número por negocio. Antes de alta, Pablo/Claude debe confirmarlo en la documentación o soporte de Meta; no asumirlo como una restricción de plataforma.

### 3.2 IA y política de Meta

**HECHO — consulta: 2026-10-25.** Los términos de WhatsApp restringen a proveedores de IA que ofrezcan una IA de propósito general como funcionalidad principal mediante la WhatsApp Business Solution, y limitan el uso de datos de la solución para entrenar o mejorar modelos de IA. Fuente oficial: [WhatsApp Business Solution Terms](https://www.whatsapp.com/legal/business-solution-terms) (consultada el 2026-10-25).

**DESCONOCIDO.** No está verificado que el agente propuesto para re-booking en Chile sea considerado por Meta un uso permitido o restringido bajo esos términos, ni qué modalidad de producto de Meta estaría disponible. Antes de construirlo o conectarlo, Nico debe decidir si se pide una confirmación escrita a Meta/partner; Claude valida la implementación contra esa respuesta.

### 3.3 Proveedor: API directa de Meta o intermediario

| Opción | HECHO verificado | Riesgo / costo a validar |
|---|---|---|
| API directa de Meta | Requiere un desarrollador que pueda llamar APIs y configurar webhooks; Meta no cobra una tarifa adicional por acceso directo. | El equipo asume integración, soporte operativo y facturación directa. |
| Proveedor intermedio (BSP) | Puede operar como intermediario; Meta indica que puede cobrar cargos adicionales por servicios o tecnología de valor agregado y facturar el uso. | Costos, contrato, portabilidad del número y alcance del soporte son **DESCONOCIDO** hasta comparar proveedores. |

Fuente oficial de ambas opciones: [FAQ de WhatsApp Business](https://whatsappbusiness.com/resources/faq/) (consultada el 2026-10-25).

**Recomendación para decisión de Nico — INFERENCIA, no decisión:** evaluar API directa para el piloto solo si Pablo/Claude confirman que pueden operar webhooks, soporte y facturación; si no, comparar proveedores con costos y condiciones por escrito. La decisión queda pendiente en la sección 11.

### 3.4 Ley 21.719 y datos personales

**HECHO — consulta: 2026-10-25.** La Biblioteca del Congreso Nacional informa que la Ley 21.719 entra en vigencia el 1 de diciembre de 2026. Su texto establece principios de finalidad y proporcionalidad; los datos deben conservarse solo el tiempo necesario y luego suprimirse o anonimizarse, salvo excepción legal o consentimiento. También contempla consentimiento libre, informado y específico, revocable con medios expeditos, y derechos como supresión y oposición. Fuente oficial: [Ley 21.719 — BCN](https://www.bcn.cl/leychile/navegar?i=1209272) (consultada el 2026-10-25).

**Requisito de diseño — INFERENCIA basada en la fuente anterior:** antes de cualquier piloto se debe registrar la evidencia de opt-in (fecha, alcance y categoría), aplicar opt-out bloqueando nuevos envíos, y definir una política documentada de retención y supresión/anonimización de conversaciones.

**DESCONOCIDO.** No se verificó un plazo fijo aplicable a todas las conversaciones del agente ni requisitos regulatorios complementarios para este caso. Claude/Pablo deben validarlo legalmente antes de producción; no se define un plazo en este documento.

### 3.5 Planes y cuotas existentes

**HECHO.** La cuota actual reconoce canales "whatsapp" y "email", y solo las categorías "confirmation", "reminder" y "retention". src/lib/message-quota.ts:20-21 La cuota se resuelve por plan y por override del negocio. src/lib/message-quota.ts:31-49 Al alcanzar el límite, tryConsumeQuota devuelve false; si hay cupo, registra uso en message_usage. src/lib/message-quota.ts:113-145

**HECHO.** El control de funcionalidades por plan incluye "whatsapp_bulk"; el helper comprueba que la funcionalidad exista en plan_limits.features. src/lib/plan-features.ts:16-29 src/lib/plan-features.ts:53-62

**INFERENCIA.** Los mensajes del agente no encajan explícitamente en las tres categorías actuales de cuota. Nico debe decidir si cuentan en la cuota existente, requieren una categoría nueva o quedan fuera; no se asume ninguna alternativa aquí.

**DESCONOCIDO.** No está decidido qué plan habilita el agente ni su cuota mensual. Se mantiene como pregunta abierta en la sección 11.

## 4. Arquitectura
[Codex: diagrama de texto + descripción]
- Componentes: webhook de entrada · cola/proceso · agente · herramientas (acciones permitidas) · base de conocimiento por negocio · panel del negocio.
- Flujo de un mensaje, de punta a punta (paso a paso).
- Multi-negocio: cómo se identifica a qué negocio pertenece cada mensaje y cómo se evita mezclar datos.
- Qué se **reutiliza** del código actual (con `ruta:línea`) y qué es nuevo.

## 5. Datos (borrador SQL en `docs/agente/sql/`)
[Codex: tablas nuevas — todas con `tenant_id`, RLS activado, migración **aditiva y re-ejecutable**, y el código debe tolerar que falte]
- Qué se guarda (mensajes, conversaciones, estado, consentimiento) y **por cuánto tiempo**.
- Qué NO se guarda.

## 6. El agente
- **Fuentes permitidas** (únicas de las que puede responder): [Codex: servicios, precios, horarios, dirección, políticas, FAQ propias del negocio]
- **Herramientas / acciones permitidas** (lista cerrada): [Codex: ej. ver disponibilidad, agendar, cancelar; para cada una: qué valida el servidor]
- **Cuándo traspasa a una persona** y cómo se avisa al negocio.
- **Reglas de respuesta:** tono, idioma, largo, qué nunca responde (dinero, salud, quejas, datos de otros clientes).
- **Modelo de IA:** [Codex: opciones y costo estimado por mensaje; decide Nico]
- **Evaluación:** [Codex: 30 preguntas de prueba con respuesta esperada, incluyendo trampas — preguntas cuya respuesta NO está en los datos → debe decir que no sabe y traspasar]

## 7. Seguridad y privacidad
[Codex: checklist con ruta:línea de dónde se cumple]
- Verificación de la firma del webhook · rutas con sesión y negocio validados (`requireRole`/`resolveTenantForRequest`) · secretos solo en Vercel (los gestiona Pablo; nunca en el repo o el chat) · límites de uso por negocio · interruptor por negocio **apagado por defecto** · registro de todo lo que responde el agente · bloqueo a quien pidió no ser contactado.

## 8. Panel del negocio
[Codex: pantallas — configuración (encender/apagar, horarios del agente, FAQ propias, mensajes), conversaciones, informes. Un boceto simple por pantalla.]

## 9. Pruebas, piloto y vuelta atrás
[Codex: pruebas automáticas (como `scripts/test-*.ts`), plan del piloto en Estudio Levels, **cómo apagarlo en un minuto**, cómo volver atrás.]

## 10. Costos
[Codex: tabla con supuestos explícitos (mensajes/mes, % que usa IA, costo por mensaje). Sin cifras de memoria: cada precio con fuente y fecha.]

## 11. Preguntas abiertas para Nico
| # | Pregunta | Opciones | Recomendación | Decisión |
|---|---|---|---|---|
| 1 | ¿Qué fase primero? | Informes / Recordatorios / Agente | Informes y recordatorios (sin IA) | _pendiente_ |
| 2 | ¿Qué modelo de IA? | OpenAI / Anthropic | [Codex] | _pendiente_ |
| 3 | ¿Proveedor de WhatsApp? | API directa de Meta (operación propia) / proveedor intermedio (BSP) | **INFERENCIA:** API directa para el piloto si Pablo/Claude confirman capacidad de operar API, webhooks, soporte y facturación; si no, comparar BSPs por escrito. | _pendiente — Nico decide_ |
| 4 | ¿Cómo se maneja el número de WhatsApp de cada negocio? | Número propio del negocio / número dedicado administrado por re-booking | **INFERENCIA:** número dedicado y aislado por negocio para el piloto, sujeto a verificar alta, propiedad y portabilidad con Meta. | _pendiente — Nico decide_ |

## 12. Registro de decisiones
| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-25 | El agente es por negocio, no inventa y traspasa a persona cuando no sabe | Nico |
| 2026-10-25 | Se trabaja en la rama `agente/whatsapp`, sin tocar `main` ni producción; Codex diseña, Claude revisa y promueve | Nico |

---

## Anexo A — Checklist de revisión de Claude (antes de pasar algo a `main`)
1. **Alcance:** ¿el cambio toca solo lo permitido (`docs/agente/`) o lo ya aprobado para promover?
2. **SQL:** aditivo (`IF NOT EXISTS`), con `tenant_id` y RLS, y el código tolera que falte. Probado primero en `rebooking-pruebas`.
3. **Rutas nuevas:** validan sesión **y** negocio; el webhook verifica la firma; ninguna devuelve datos de otro negocio.
4. **Secretos:** ninguna llave ni token en archivos; variables de entorno solo en Vercel.
5. **Datos personales:** nada se registra de más; respeta a quien no quiere ser contactado.
6. **Multi-negocio:** toda consulta filtra por `tenant_id`; sin límite silencioso de 1.000 filas.
7. **Fuentes:** afirmaciones externas (Meta, precios, leyes) con URL y fecha; si no, se devuelve a Codex.
8. **Apagado:** el interruptor por negocio existe y viene apagado.
9. **Pruebas:** existen y pasan (`npx tsc --noEmit`, `npx tsx scripts/<archivo>`).
10. **Tamaño:** PR chico, un tema; si es grande, se divide antes de revisar.

## Anexo B — Ficha que Codex adjunta en cada PR hacia `agente/whatsapp`
```
QUÉ CAMBIA: (una frase)
SECCIÓN DE LA ESPECIFICACIÓN: (número)
DECISIONES DE NICO QUE USA: (cita la fila del registro)
ABIERTO / SIN RESOLVER: (lo que falta)
FUENTES EXTERNAS: (URL + fecha de consulta)
ARCHIVOS TOCADOS: (todos dentro de docs/agente/)
```
