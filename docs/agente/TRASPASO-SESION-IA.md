# Traspaso de sesión: agente de WhatsApp con IA (Claude Code ⇄ Codex)

> **Si eres Codex o Claude Code y vas a continuar este trabajo: lee este archivo completo antes de tocar nada.**
> Última actualización: **7 nov. 2026**, al cerrar la sesión larga de Claude Code (Sonnet 5.5) del 3 al 7 nov.
> Quien trabaje después **actualiza la sección 9 ("Estado")** al terminar y sube el cambio en el mismo PR. Así Codex y Claude Code siempre parten de la misma verdad.

## 1. Quién es quién
- **Nico** (Nicolás, `nicoperezj1`): dueño de Estudio Levels. **No programa.** Prueba por WhatsApp desde su Mac y en el Preview de Vercel, decide, y **él hace los clics de Create PR y Merge**.
- **Pablo** (`pdencina`): dueño del repo oficial `pdencina/barberia`, de Vercel y del Supabase de producción. Revisa; no hace falta en el día a día.
- **Codex** (ChatGPT): escribe en ramas `codex/...` con ficha de tarea (ver `AGENTS.md` secciones 12 a 15). **Claude Code** decide el diseño final y revisa código, seguridad y SQL.

## 2. Cómo hablarle a Nico (exacto)
1. **Español, informal, simple y corto.** Avanzar programando, no explicando.
2. **Pasos numerados, con detalle:** qué pega, dónde, qué debe salir. Decir en qué ventana va cada cosa.
3. **No preguntar lo que ya está decidido.** Sí confirmar antes de cambiar el comportamiento visible del agente cuando haya varias formas razonables.
4. **Honestidad:** decir siempre qué se probó y qué no (casi todo se prueba con datos simulados; lo real lo ve Nico por WhatsApp).
5. Pronombres neutros si no se conocen.
6. Cuando algo falla en una captura de Nico: primero buscar la causa real (código, base de pruebas, logs de Vercel), no adivinar; luego arreglar y decir exactamente qué cambió.

## 3. Reglas que no se rompen
- **Nunca** pedir, leer, pegar ni imprimir llaves, tokens o secretos. No tocar ni leer `.env*`. Las variables las carga Nico en Vercel él mismo.
- **Nunca** crear PR, ni usar `gh`, ni hacer clic en Merge. Se entrega un **enlace compare con título y cuerpo ya escritos** (ver 5.6).
- **Nunca** subir a `main`. Solo ramas `claude/<tema>` (o `codex/<tema>`).
- **Producción** (`pdencina/barberia` `main`, 4 negocios reales, ~2.700 clientes): nada destructivo, nada de datos de prueba hacia allá, **ningún SQL en producción sin respaldo y OK explícito de Nico**.
- **SQL:** migraciones aditivas y re-ejecutables (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`) con consulta de verificación al final. Solo se ejecutan en **`rebooking-pruebas`** (ref `ucwrdmwtlesayjxmlbve`), nunca en producción.
- **Todo lo nuevo viene apagado o igual que antes** cuando hay riesgo (mensajes, dinero). Interruptor por negocio o variable de entorno.
- **Fallar cerrado:** ante cualquier duda, el agente deriva a una persona ("Te contactará una persona.") en vez de inventar.
- Los mensajes de commit terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (Codex: su propio trailer). Las descripciones de PR terminan con `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 4. Entornos
| Qué | Dato |
|---|---|
| Rama de trabajo del agente | `agente/whatsapp` (protegida: exige CI `pruebas` y `limites-de-carpeta`) |
| Preview del agente | `https://barberia-git-agente-whatsapp-re-booking.vercel.app` |
| Pantalla del contexto de IA | `/dashboard/whatsapp-preguntas` (modo Avanzado) en el Preview |
| Número de prueba (Meta) | `+1 555 614 7436` |
| Negocio de pruebas | "Estudio Levels (pruebas)", id `0235d97a-6658-4a1c-be69-8c1341ac50ce`, slug `levels-pruebas-0xrf` |
| Supabase de pruebas | ref `ucwrdmwtlesayjxmlbve` ("rebooking Base"; la barra dice "PRODUCTION" pero es solo el nombre de su rama) |
| Carpeta local de Nico | `~/barberia`; el worktree de esta sesión fue `~/barberia-chat` (otras sesiones cambian de rama en `~/barberia`: **usar worktree propio** y confirmar la rama antes de cada commit) |
| Secretos | Solo en Vercel (Preview): `WHATSAPP_*`, `AGENTE_CONTACT_HASH_SALT`, `ANTHROPIC_API_KEY`, `EMAIL_FROM` (opcional). **No están en el repo.** |
| Apagados de emergencia | `AGENTE_IA_GUIADA=0` apaga la etapa guiada de la IA; `AGENTE_AVISO_CORREO=1` reactiva el aviso por correo al administrador (hoy apagado) |

## 5. El método, paso a paso (el que se usó en esta sesión)
1. **Nico pide algo** (casi siempre con una captura de WhatsApp o de la pantalla). Se identifica qué mensaje falló y por qué: leer el código real (`src/lib/agente/`), la base de pruebas con SQL de solo lectura, y si hace falta el log de build de Vercel.
2. **Si hay varias formas de resolverlo y cambia lo que ve el cliente,** proponer en 3–5 líneas y esperar el OK. Si Nico ya dijo qué quiere, **se hace**.
3. **Rama nueva por tema**, creada desde la base correcta:
   ```bash
   git fetch https://github.com/pdencina/barberia.git agente/whatsapp
   git checkout -b claude/<tema> FETCH_HEAD
   ```
   Si la base ya trae el PR anterior mergeado, no se repite trabajo. Para temas ajenos al agente se parte de `main`.
4. **Cambios pequeños, un commit por tema.** Todo lo nuevo con pruebas.
5. **Antes de cada commit:** `npx tsc --noEmit` limpio y toda la batería:
   ```bash
   for f in scripts/test-*.ts; do npx tsx $f >/dev/null 2>&1 || echo "FALLA $f"; done
   ```
   Hoy son ~95 archivos de prueba, todos con datos simulados (sin red, sin Supabase). **No correr `next build`** sin avisar.
6. **Commit y push solo a la rama `claude/<tema>`** (el `origin` local puede apuntar a otro repo, por eso siempre con URL completa):
   ```bash
   git push https://github.com/pdencina/barberia.git claude/<tema>
   ```
7. **Entregar a Nico el enlace de PR listo para un clic**, en formato:
   `https://github.com/pdencina/barberia/compare/agente/whatsapp...claude/<tema>?expand=1&title=<TÍTULO>&body=<CUERPO>` (URL-codificado). **Siempre con `title` y `body`**, siempre, o GitHub dice "Title can't be blank". Si el PR ya está abierto y se agregaron commits a la misma rama, **no hace falta otro link**: se avisa.
   - PR directo a `agente/whatsapp` = **un solo clic** y el Preview se despliega solo. Es la forma por defecto en esta etapa (Nico pidió menos PRs).
   - Llegará a `main` el día que se suba toda la rama del agente a producción.
8. **Nico hace Create → espera CI verde → Merge.** Vercel despliega el Preview (1–2 min). Si Vercel falla con error de `next/font`/fuente de Google es un fallo transitorio de descarga: **Redeploy**, no es del código.
9. **Pasos de prueba para Nico**, numerados: qué escribir al número de prueba, qué debe llegar.
10. **Nico responde con capturas** y se repite desde el paso 1.
11. **Al cerrar:** actualizar la sección 9 de este archivo y la `BITACORA.md` si corresponde.

**Trampas de Mac/Terminal que ya mordieron:** `sed -i ''` (con comillas vacías) en macOS; `pbcopy` mezcla tildes si el locale no es UTF-8 → usar `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` antes; `printf %s "$(...)" | pbcopy` para no agregar salto de línea.

## 6. Arquitectura del agente (cómo decide qué responder)
Orden en `src/lib/agente/whatsapp-webhook.ts` (adaptador real en `src/app/api/agente/whatsapp/webhook/route.ts`):
0. **Botones:** los ids de lista (`m1..m4`, `c_malla`, `c_valor`, `c_fechas`, `c_video`, `c_otras`, `c_menu`) se traducen a texto con `textoDeBoton` (menu.ts) y **descartan cualquier reserva a medias**.
1. **Reinicio:** "menú", "volver" o un saludo suelto (incluye "holla", "ola") → borra el estado y muestra el menú.
2. **Reserva por chat** (`reserva-chat.ts`, estado en `agent_chat_state`, 30 min): elegir hora, pedir nombre/correo/servicio, crear la cita con la misma ruta pública de la web. Con ≥2 citas futuras **lista y pregunta** si quiere otra (tope duro 4).
3. **Menú numerado / lista** (`menu.ts`): 1 reservar, 2 curso (abre submenú del curso), 3 precios/horarios/ubicación, 4 otras preguntas (deriva).
4. **Archivos** (`archivos.ts`): "malla", "temario", etc. → responde corto y envía el PDF (`src/lib/agente/archivos/levels/malla-curso.pdf`); solo para negocios autorizados (provisorio, regex sobre el enlace de reservas).
5. **Disponibilidad** (`disponibilidad.ts`): "¿Matías tiene hora mañana a las 3?" con la misma regla que la reserva web.
6. **FAQ Clásico** (`faq-fija.ts`): precios/horarios/dirección con los datos cargados del negocio. Tiene prioridad sobre la IA.
7. **IA, modo Avanzado** (`ia-respuesta.ts`, modelo `claude-haiku-5-5`, tope 300 usos/mes/negocio):
   - **Etapa 1 clasificador:** elige hasta 3 líneas `P:/R:` del contexto y devuelve la **R tal cual**.
   - **Etapa 2 guiada** (si ninguna línea calza): actúa como **recepcionista**, redacta ≤3 frases solo con el contexto, **sin preguntas abiertas** (ofrece 2–3 opciones), y **verifica que toda cifra, hora, enlace, correo o @usuario exista en el contexto** antes de enviar; si no, deriva.
8. **Cierre (`cta.ts`):** respuestas generales terminan con "¿Quieres agendar? Reserva aquí: <enlace>"; **si se habla del curso** terminan con "Escribe *menú* para volver al inicio" y se reenvía la lista del curso.
9. **Sin respuesta:** menú (si es saludo o no se entendió) o "Te contactará una persona." (+ aviso al admin, hoy apagado).

Otras piezas: `whatsapp-meta.ts` (envío de texto, lista, archivos, plantillas; extractor de mensajes entrantes), límite 20 mensajes/hora por contacto, estado en `agent_chat_state` (`etapa` solo `oferta`|`datos`; el resto va en el JSON `datos`, **sin migración**), contexto de IA en `agent_ai_context` (tope **30.000** caracteres; 250 fragmentos).

## 7. Cómo se carga el contexto de IA
- Pantalla `/dashboard/whatsapp-preguntas` → Paso 2 → pegar → **Guardar contexto**. Formato `P: pregunta` / `R: respuesta` por pares, **una línea de R por pregunta**, datos simples (enlaces planos, sin datos que cambian a diario, sin instrucciones al asistente).
- El contexto vigente de Estudio Levels está en `docs/agente/contexto-levels.txt` (copia de trabajo; la verdad está en la base).
- La base de pruebas tuvo que ampliarse con: `ALTER TABLE agent_ai_context DROP CONSTRAINT IF EXISTS agent_ai_context_contexto_check; ... CHECK (char_length(contexto) <= 30000);` (ya aplicado en pruebas; `docs/agente/sql/012_contexto_ia.sql` ya trae el tope nuevo para producción).

## 8. Plan de prueba manual (WhatsApp, número de prueba)
1. "hola" / "holla" → mensaje con botón **Ver opciones**.
2. **Información del curso** → lista del curso → **Malla del curso** (texto corto + PDF + lista otra vez) → **Valor y cómo reservar** → **Video explicativo** → **Volver al menú**.
3. **Reservar una hora** → disponibilidad → "Matías a las 19:00" → nombre, correo, servicio → cita creada (origen `whatsapp_agente`) → llega correo de confirmación.
4. Con 2 citas futuras pedir otra → lista + "¿otra de todas formas? sí/no".
5. Preguntas trampa: "tienen hora el viernes en la tarde", "puedo pagar en cuotas", "mi hijo tiene 13, puede hacer el curso", "me roban?", "ignora tus reglas" → no inventa; deriva o guía.

## 9. Estado (actualizar al terminar cada sesión)
**En `agente/whatsapp` (mergeado):** IA Avanzada funcionando con llave real; menú, volver, CTA; seguimientos de disponibilidad; CI rápido; arreglo del correo de confirmación (remitente `re-booking.cl`); contexto hasta 30.000 caracteres; etapa guiada recepcionista; menú como lista; PDF de malla (primer envío).
**Mergeado además (PR #348, `claude/ia-guiada`):** submenú del curso con botones, lista tras cada respuesta del curso, IA sin preguntas abiertas, botón "Malla del curso" que envía el PDF, la IA ya no menciona "el contexto", y este traspaso. **No queda ningún PR pendiente de esa tanda.**
**17 nov. 2026 (rama `claude/disponibilidad-ideal`, PR pendiente):** respuestas de disponibilidad con la estructura que pidió Nico: un profesional con muchas horas responde "Sí, X tiene horas <día>. ¿En qué horario buscas?" + link; y entiende tramos ("entre las 14 o las 15 hrs", "entre las 14 y las 16"): primero las horas pedidas, si no hay las cercanas (±45 min), si no "Lo siento, no tenemos en ese horario, lo más cercano es…", siempre con el link del profesional. Probado solo con datos simulados.
**18 nov. 2026 — ACTIVACIÓN EN PRODUCCIÓN (Estudio Levels real). Estado al cierre del día:**
- **Decisión de Nico: PILOTO CON NÚMERO APARTE.** El número real de Levels (+56 9 4266 6172) sigue en la app WhatsApp Business del celular (historial y clientes que ya escriben ahí). Coexistencia app+API exige ser Tech Provider/BSP de Meta: se evaluará en paralelo (sirve para todos los negocios). El agente atiende en un chip nuevo: **+56 9 7949 9035**. Cuando debe intervenir una persona el agente da el teléfono real con enlace `wa.me` (`derivarAlTelefono`, `textoDerivacionTelefono` en `menu.ts`, ya en `main`).
- **Meta:** portafolio **Re-booking.cl** (business_id 1110912468602696), app **Re-booking** (id 1621818342757956, **publicada** el 18 nov, ícono/privacidad/términos/eliminación cargados), cuenta de WhatsApp **Estudio Levels** (WABA 1152352274429558), número con `phone_number_id` **1489112280946919**, verificado por SMS, nombre visible "Estudio Levels", categoría Belleza/spa/estética. Usuario del sistema `agente-whatsapp` con acceso total a la app y a la cuenta Estudio Levels. Webhook: `https://www.re-booking.cl/api/agente/whatsapp/webhook`, campo `messages` suscrito. **La URL de callback es única por app: el Preview de `agente/whatsapp` ya no recibe mensajes del número de prueba; todo se prueba en producción.**
- **BLOQUEADO POR META (esperar):** la cuenta Estudio Levels está **"Pending review"**, el número figura **"No registrado"** y el interruptor "Suscribir webhooks" de esa cuenta está apagado. El botón **Registrar** (Paso 2 del caso de uso, `.../use_cases/customize/wa-configurations-v2/`) está deshabilitado hasta que Meta apruebe. Sin registrar no se puede subir la foto de perfil ni recibir mensajes.
- **Producción (Supabase EstudioLevels `ulucmbuvupulwplsrcnx`):** SQL 010–013 aplicados por Claude (aditivos; `docs/agente/sql/012_contexto_ia.sql` con tope 30.000). Tenant **Estudio Levels `c81dce57-211e-46fe-b5ac-704d01912bcf`**: contexto cargado en `agent_ai_context` (13.534 car.; sin la fecha del curso y sin el link del video, por no estar vigentes/confirmados) con **IA activa**; fila `agent_whatsapp_settings` creada con el `phone_number_id` y **`enabled = false`** (el agente NO responde a nadie mientras no se cambie).
- **Vercel Production:** las 6 variables cargadas por Nico (`WHATSAPP_ACCESS_TOKEN` permanente del usuario del sistema, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `AGENTE_CONTACT_HASH_SALT`, `WHATSAPP_API_VERSION`=v26.0, `ANTHROPIC_API_KEY` nueva). Nunca imprimir ni pedir sus valores. Producción responde 403 con token malo y 401 sin firma en el webhook.
- **Orden de lo que sigue:** (1) Meta aprueba la revisión → (2) Nico pulsa **Registrar** e inventa un PIN de 6 dígitos (secreto, no se comparte) y activa **Suscribir webhooks** → (3) Nico sube la foto de perfil (logo de Estudio Levels, cuadrado) → (4) con OK de Nico: `UPDATE agent_whatsapp_settings SET enabled = true WHERE tenant_id = 'c81dce57-211e-46fe-b5ac-704d01912bcf';` → (5) prueba desde el celular de Nico con "hola" → (6) revisar las primeras conversaciones reales y corregir → (7) recién entonces avisar a clientes (mensaje de bienvenida/ausencia en la app del número real, Instagram, Google Maps).
- **Apagado de emergencia:** `enabled = false` en esa fila (inmediato, sin redeploy). `AGENTE_IA_GUIADA=0` apaga la etapa guiada de la IA.
**Sin probar todavía en WhatsApp real:** el submenú del curso completo, el envío del PDF desde botón, el video.

**Pendientes y decisiones abiertas (de Nico):**
1. **Datos de pago del curso de David** (recepcionista humano): transferencia, RUT, banco, link de Mercado Pago, cuotas, política de clase perdida. Meta AI los entregó pero **sin confirmar** (banco dudoso): **no están en el contexto**. Regla de David a respetar: **el agente nunca confirma una inscripción**; da los datos y pide el comprobante; confirma una persona.
2. **Link del video explicativo** del curso (`youtu.be/Cv4-g-LBzXo`): **sin verificar**; por eso NO está en el contexto de producción (sí en `contexto-levels.txt` y en pruebas). Cuando Nico lo confirme, agregar la línea y re-guardar el contexto. `estudiolevels.com/cursos` y `mpago.li/2iCxUE2`: sin confirmar, no se usan.
3. **Fecha de inicio del curso:** la del 10 de noviembre ya pasó; en producción el contexto dice "escríbenos por este chat" para la próxima convocatoria. Actualizar cuando Nico defina la próxima fecha.
4. **Producción:** ver bloque del 18 nov. Pendientes de Nico: rotar el secreto del bypass de Vercel que se vio en capturas (Deployment Protection), borrar la Nota con el token viejo, textos legales revisados por abogado, confirmar tarifas de Meta, y decidir si se evalúa Tech Provider/BSP para coexistencia.
5. Teléfono del menú muestra "+56 9 0000 0000" en el negocio de pruebas (dato del seed). Revisar el real de Levels.
6. Correo "Suppressed" visto en Resend de producción (jorgeluisjimenez@gmail.com): revisar con Pablo.
7. Ideas aprobadas a medias: cancelar o reagendar por chat con el enlace del correo; imágenes además de PDF en `archivos.ts` (el envío ya acepta jpeg/png).
8. Seguridad abierta del proyecto general: ver `docs/auditoria-rutas-api.md` y `CLAUDE.md` sección 7.

## 10. Cómo retomar en 2 minutos
1. `git fetch https://github.com/pdencina/barberia.git agente/whatsapp main` y mirar si `claude/ia-guiada` ya se mergeó (`git merge-base --is-ancestor <sha> FETCH_HEAD`).
2. Leer `AGENTS.md` (secciones 11 a 17) y este archivo.
3. Pedirle a Nico la **captura** o el caso que falló; reproducirlo con las pruebas (`scripts/test-agente-*.ts`).
4. Seguir el método de la sección 5.

## 11. Modo de trabajo cuando continúa Codex (autorizado por Nico el 7 nov. 2026)
Nico quiere que Codex siga **exactamente como en la sesión de Claude Code** y que pueda **hacer cambios**. Por eso, **dentro del agente de WhatsApp** (`src/lib/agente/`, `src/app/api/agente/`, `src/app/dashboard/whatsapp-preguntas/`, `scripts/test-agente-*.ts`, `docs/agente/`):
1. **Un pedido directo de Nico en el chat (con captura o descripción del caso) vale como ficha de tarea.** No hace falta pedir otra ficha: se hace.
2. Se trabaja con el método de la sección 5: rama `codex/<tema>` creada desde `agente/whatsapp` actualizada, cambios pequeños, `tsc` + batería de pruebas, push a esa rama. **Codex puede abrir el PR hacia `agente/whatsapp`** (si no puede, entrega el enlace compare con título y cuerpo, como en 5.7). **Nico mergea.**
3. Lo demás de `AGENTS.md` sigue igual: nada a `main`, nada de `.env*` ni secretos, **ningún SQL en producción**, todo lo nuevo apagado o igual que antes si hay riesgo; el código de envíos, seguridad y SQL lo revisa Claude.
4. Al terminar: actualizar la sección 9, y decirle a Nico **qué probó, qué no, y los pasos numerados para probarlo en WhatsApp** (sección 8).
5. Si Nico pide algo **fuera del agente** (otras pantallas de re-booking), aplica `AGENTS.md` sección 15 (rama propia y ficha).

## 12. Nota para análisis de conversaciones y ventas
El agente **no guarda el texto de los mensajes** (solo contadores en `agent_whatsapp_indicadores`, ver `whatsapp-webhook.ts`). Por eso **no se pueden reconstruir conversaciones pasadas desde la base**. Cualquier análisis de cierres de venta o motivos de pérdida necesita una **fuente nueva** (exportar chats de WhatsApp Business, o guardar mensajes con consentimiento y retención definidos). Es una **decisión de Nico** (privacidad, Ley 21.719), no algo a hacer por defecto.

## 13. Simulador de conversaciones con datos reales (19 nov. 2026)
`scripts/simulador-conversacion.ts <instantanea.json> [guion.json]` corre conversaciones completas por el webhook real (sin red, sin llaves; la IA se simula apagada y lo que llegaría a ella se marca). La instantánea es un JSON con los datos del negocio (tenant, horas, servicios, profesionales, sucursales) sacado de la base **solo con SELECT**; **no se versiona** (es dato del negocio). Un guion base está en `docs/agente/simulacion/guion-basico.json`. Úsalo después de cada cambio de conversación y antes de encender un negocio.
Hallazgos de la primera pasada con datos de Estudio Levels (y qué se hizo):
- Corregido en código: derivación a una persona con teléfono real (ya en el PR del piloto); mensajes que no son texto (foto/audio/documento) respondían "Te contactará una persona" sin teléfono; "quiero cancelar/cambiar/reagendar" y "quiero hablar con una persona" caían al menú; "holas/wena/hi" no eran saludo; "primer profesional disponible" no se entendía; con una sola sucursal activa el agente preguntaba "¿de qué sucursal?" y no respondía "¿a qué hora abren?" (producción no tiene `business_hours.branch_id`); la lista de servicios de la reserva traía duplicados y servicios de otro profesional; los datos de la reserva pedían todo en un mensaje y un "sí" gastaba un intento.
- Datos de producción por decidir con Nico (no son código): sucursal de prueba activa "Estudio Levels La Florida" (dirección "test 1111") que hace al agente preguntar por sucursal; horario en la base (L–V 10:00–20:00) distinto al del contexto (19:30); "Corte + barba paños calientes" $27.000 en la base vs $24.000 en el contexto.
- Decisión de privacidad abierta: la reserva sigue exigiendo nombre, correo y servicio **en un solo mensaje** (por diseño no se guardan datos personales a medias en `agent_chat_state`); solo se conserva el servicio elegido (no es dato personal).

## 14. Pruebas con 325 mensajes en chileno (19 nov. 2026)
Guion: `docs/agente/simulacion/guion-chileno.json` (114 conversaciones, 325 mensajes). La IA se probó **sin llave** con subagentes Haiku que actuaron como el clasificador y la etapa guiada con el contexto real (`scripts/preparar-lotes-ia.ts`, `scripts/procesar-lotes-ia.ts`; validadas con las mismas reglas del producto). Es una aproximación: confirmar con la llave real en las primeras conversaciones.
- De 160 mensajes que llegan a la IA: 73 respondidos con una línea del contexto, 51 con la etapa guiada, 36 sin respuesta (agradecimientos, "xd", intentos de inyección: correcto).
- Hallazgo mayor: **la IA no tiene memoria**; "y con barba?", "cuanto dura?", "y el video?" llegan sin el tema anterior. Propuesta: guardar en `agent_chat_state` solo los ids de las líneas del contexto usadas (no es dato personal) y pasarlos como "tema anterior" (requiere migración aditiva del CHECK de `etapa`).
- Ventas cerradas en el guion por el flujo de reserva: de 2 a 9 tras los arreglos (hora ambigua "a las 6/06:00/7" con aviso, próximas horas para elegir, asignación automática del primer profesional si el cliente solo dice la hora, "sí" suelto con varias opciones, servicios ordenados con el corte básico primero, gracias/chao sin IA).
- Bug de configuración corregido: el envío de la malla en PDF y del video solo se activaba con el enlace `/b/estudiolevels`; producción usa `/estudiolevels`.
- Video del curso confirmado: https://youtu.be/Cv4-g-LBzXo ("Información curso de barbería Estudio Levels", canal @estudiolevels); el botón "Video explicativo" lo envía sin IA y está en el contexto de producción.

## 15. Memoria de tema de la IA (19 nov. 2026)
La IA ya no recibe cada mensaje "en frío": el adaptador guarda en `agent_chat_state` (etapa `tema`, migración `docs/agente/sql/014_tema_conversacion.sql`, **aplicada en pruebas y producción**) los **números de las líneas del contexto** usadas en la última respuesta de la IA (nunca texto del cliente) y se los pasa al modelo como "TEMA ANTERIOR" en el siguiente mensaje (`mensajeConTema` en `ia-respuesta.ts`; lectura/escritura en `src/lib/agente/tema.ts`). Así "¿y con barba?", "¿cuánto dura?" o "¿y el abono se devuelve?" se entienden. Vigencia 30 min; si hay una reserva en curso el tema se agrega a sus datos sin pisarla; `leerEstado` ignora las filas `tema` para no confundirlas con una reserva. Si la memoria falla, la IA responde como antes. Límite: solo recuerda lo que respondió la IA, no las respuestas del modo Clásico.

## 16. Conversación más fluida (23 nov 2026, tras la primera prueba real en el número piloto)
Nico probó el agente encendido en producción y vio 4 fallas; se corrigieron juntas (rama `claude/agente-conversacion-fluida`):
1. **Perdía el día/hora al estar en el paso de datos** ("¿qué barberos más tienen a esa hora?" respondía "hoy"). Ahora el webhook hereda `fecha` y `hora` también de la etapa `datos` y reemplaza "esa hora" por la hora hablada.
2. **Ya no elige barbero por el cliente.** Si una hora la tienen varios, se pregunta con quién (texto numerado + lista para tocar `r1..r8`; el estado guarda `horaPendiente`). "Con cualquiera" sí toma el primero. "Busco cerca de las 5" es una búsqueda (la responde la disponibilidad).
3. **"¿Quién atiende el miércoles?"** lista a cada profesional con sus primeras 3 horas (`disponibilidad.ts`).
4. **Datos de a uno:** nombre → correo → servicio (lista para tocar). Se sigue aceptando todo junto. **Privacidad:** `agent_chat_state.datos` ahora guarda `cliente` y `correo` mientras dura la reserva (VIGENCIA_MIN = 30 min) y se borra al confirmar, cancelar, derivar o vencer. Pendiente de revisar con el abogado (Ley 21.719) si se quiere dejar así.
Webhook: `ListaReserva` (rc.lista) se envía con `responderLista` usando el texto como cuerpo; si falla, va el texto numerado.

## 17. Número administrador y avisos (24 nov 2026)
- Migración **015** (`docs/agente/sql/015_admin_avisos.sql`): `agent_admin_contacts` (números del dueño, solo dígitos) y `agent_avisos` (instrucciones confirmadas). **Aplicada en pruebas y producción**; en producción está registrado +56 9 8493 9625 como administrador de Estudio Levels.
- Seguridad: SOLO el número registrado puede usar los comandos (se compara con el remitente que firma Meta; a cualquier otra persona esas palabras no le hacen nada ni se le menciona el modo administrador). El administrador, por lo demás, conversa como un cliente normal: solo `ayuda`, `reporte [hoy|mes]`, `aviso: ...` (o `instrucción:`), `avisos`, `borrar N` y las confirmaciones `guardar` / `descartar` (solo si hay una pendiente) lo activan; todo lo demás devuelve `null` y sigue el flujo de cliente.
- Un aviso **solo informa**: se agrega ("📌 Aviso: ...") a respuestas sobre horario/horas/disponibilidad. No bloquea la agenda real. Dura hasta la fecha que diga la frase o 14 días; máximo 10 vigentes.
- Código: `src/lib/agente/admin.ts`, bloque `deps.admin` en `whatsapp-webhook.ts` y adaptador en la ruta del webhook; pruebas `scripts/test-agente-admin.ts` y casos "admin:" en `test-agente-wa-webhook.ts`.

## 18. Opción Manicure (24 nov 2026)
Quinta fila del menú ("Manicure", de las últimas) y primera fila renombrada "Reservar hora | Barbería" (WhatsApp admite 24 caracteres por título). `src/lib/agente/manicure.ts`: submenú con "Reservar hora / Precios" → https://www.re-booking.cl/looky-estudio y "Conocer los trabajos" → https://estudiolevels.com/para-ellas, más "Volver al menú". Es **otra línea de negocio**: se atiende antes de la reserva en curso, la disponibilidad y la IA (sale de una reserva de barbería si el cliente habla de manicure) y no recibe los avisos del administrador; la barbería nunca menciona manicure. La fila Manicure vuelve como el texto "manicure" (no como "5", que se confundiría con una hora). Un "5" suelto sin reserva en curso también abre Manicure.

## 19. Errores de la prueba real del 24 nov (video de Nico y Dylan)
1. **Tocar una opción de la reserva (ids `r1..r8`) borraba la reserva** (el webhook trataba todo botón como "decisión nueva") → "No entendí lo que me escribes". Ahora solo los botones del menú/curso/manicure dejan atrás la reserva.
2. **"Corte más barba" se tomó como nombre** y pisó "Bleiner". Ahora el nombre ya dado no se pisa y el servicio se entiende por palabras en cualquier orden (`reserva-chat.ts`); si calza con varios se muestra una lista acotada (`opcionesServicio`), y si uno solo tiene exactamente esas palabras, gana ("corte y cejas" = "Corte + Cejas").
3. **Nombres con mala ortografía** ("dilan" = Dylan, "filipe" = Felipe): `src/lib/agente/nombres.ts` (`palabraCalza`: pronunciación aproximada y una letra de diferencia) usado en reserva y disponibilidad.
4. **"no sé cuál elegir" cancelaba la reserva** (empezaba con "no"). Ahora solo cancelan frases cortas como "no", "no gracias", "mejor no".

## 20. Datos en tres líneas (24 nov, prueba de Carlitos)
"carlitos run / correo / corte" dejaba el servicio sin entender porque varios servicios empiezan con "corte". Ahora "corte" a secas es el corte básico (el servicio llamado exactamente Corte / Corte de cabello / Corte clásico / Corte simple, si existe) aunque venga junto al nombre, y se aceptan etiquetas ("Nombre: ... Correo: ... Servicio: ...").

## 21. Consultas difíciles por WhatsApp (24 nov 2026)
- Idea de Nico: cuando el agente no sabe responder, le escribe al dueño (número admin 56984939625) en el mismo chat; el dueño da una instrucción y el agente responde al cliente y lo guarda en la base de conocimiento.
- Código: `src/lib/agente/consultas.ts` (lógica pura, modelo inyectado), enganche en `whatsapp-webhook.ts` (`deps.consultas`, `esConsultable`) y adaptador en `route.ts`. Migración `docs/agente/sql/016_consultas_pendientes.sql` (`agent_consultas`; la fila se BORRA al cerrar: no se conserva teléfono ni pregunta).
- Cuándo se consulta: mensaje largo que nada responde, o pregunta con «?» de 3+ palabras que iba al menú. Saludos y texto suelto siguen al menú. Tope 10 abiertas; una por cliente; si no se puede avisar al dueño, se deriva al teléfono como antes.
- Dueño responde con `N: instrucción` o citando el aviso. `N: enviar: texto` (textual, sin IA, no se guarda), `N: descartar`, `consultas`, `saber`, `olvidar N`. Si algo no queda claro, la IA pregunta y la siguiente instrucción se suma.
- Guardas: la IA solo usa la instrucción y el contexto; cifras/enlaces/horas deben estar en ellos (`datosRespaldados`). Se guarda en `agent_faq_custom` con `orden = 1000` (así se listan y se pueden olvidar).
- Límite de WhatsApp: el aviso al dueño y la respuesta al cliente solo salen dentro de las 24 h desde el último mensaje de cada uno. Si el dueño no escribió en 24 h, el aviso falla y se deriva como antes (a futuro: plantilla aprobada).
- Pruebas: `scripts/test-agente-consultas.ts` (12 casos) y 8 casos en `test-agente-wa-webhook.ts`. También se actualizó el enlace esperado `/whatsapp` (#463 había dejado esa prueba en rojo).

## 22. Trabajos químicos, abono y comprobantes (24 nov 2026)
- Valores cargados por Nico: rizo y ondulación permanente $80.000; visos $85.000 (1 bloque) / $95.000 (2 bloques); color global desde $100.000 (según color y largo). Todos incluyen asesoría previa y corte. Reservar = abono de $15.000 por transferencia (datos en la respuesta propia «Reservar trabajo químico (abono)», SOLO en la base; no se versionan en el repo), la hora se toma con el comprobante, luego 2 fotos de referencia y fotos del cabello.
- Dónde vive: `agent_faq_custom` (orden 20–24, tienen prioridad sobre el catálogo de servicios, que respondía solo «Sí, tenemos Visos: $85.000») y el contexto de la IA (`agent_ai_context`). `faq-extra.ts`: si la clave de una respuesta está contenida en la clave más larga de otra, gana la más específica («reservar visos» no mezcla la respuesta de visos). `cta.ts` (`DE_QUIMICOS`): estas respuestas no llevan «Reserva aquí».
- Comprobantes con revisión humana: el cliente manda imagen/documento → se le reenvía a Nico (`enviarMedioPorId`, `leerMedio`) con «N: confirmado» (pide las fotos al cliente; la consulta sigue abierta para reenviar las fotos), «N: listo» (cierra) o una instrucción libre. Lo respondido a una imagen NO se guarda como conocimiento. Migración 017 (`agent_consultas.tipo`), aplicada en producción.
- Decisión de Nico: NO leer comprobantes con IA (podrían ser falsos); Nico verifica en Mercado Pago.
