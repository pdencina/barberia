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
**En la rama `claude/ia-guiada` (PR pendiente a `agente/whatsapp`, lo mergea Nico):** submenú del curso con botones, lista tras cada respuesta del curso, IA sin preguntas abiertas, botón "Malla del curso" que sí envía el PDF, la IA ya no menciona "el contexto", y **este archivo de traspaso**.
**Sin probar todavía en WhatsApp real:** el submenú del curso completo, el envío del PDF desde botón, el video.

**Pendientes y decisiones abiertas (de Nico):**
1. **Datos de pago del curso de David** (recepcionista humano): transferencia, RUT, banco, link de Mercado Pago, cuotas, política de clase perdida. Meta AI los entregó pero **sin confirmar** (banco dudoso): **no están en el contexto**. Regla de David a respetar: **el agente nunca confirma una inscripción**; da los datos y pide el comprobante; confirma una persona.
2. **Link del video explicativo** del curso (`youtu.be/Cv4-g-LBzXo`): está en el contexto pero **sin verificar**. También `estudiolevels.com/cursos` y `mpago.li/2iCxUE2`: sin confirmar, no se usan.
3. **Fecha de inicio del curso** ("10 de noviembre"): revisar vigencia antes de seguir mostrándola.
4. **Producción** (Nico lo difirió): `ANTHROPIC_API_KEY` en Vercel Production, SQL 010–013 con respaldo y OK explícito, variables de WhatsApp en Production, webhook a `www.re-booking.cl/api/agente/whatsapp/webhook`, número real, textos de privacidad/legal, confirmar tarifas de Meta. Subir esto implica además mover los archivos adjuntos a una pantalla por negocio (hoy `archivos.ts` es provisorio).
5. Teléfono del menú muestra "+56 9 0000 0000" en el negocio de pruebas (dato del seed). Revisar el real de Levels.
6. Correo "Suppressed" visto en Resend de producción (jorgeluisjimenez@gmail.com): revisar con Pablo.
7. Ideas aprobadas a medias: cancelar o reagendar por chat con el enlace del correo; imágenes además de PDF en `archivos.ts` (el envío ya acepta jpeg/png).
8. Seguridad abierta del proyecto general: ver `docs/auditoria-rutas-api.md` y `CLAUDE.md` sección 7.

## 10. Cómo retomar en 2 minutos
1. `git fetch https://github.com/pdencina/barberia.git agente/whatsapp main` y mirar si `claude/ia-guiada` ya se mergeó (`git merge-base --is-ancestor <sha> FETCH_HEAD`).
2. Leer `AGENTS.md` (secciones 11 a 15) y este archivo.
3. Pedirle a Nico la **captura** o el caso que falló; reproducirlo con las pruebas (`scripts/test-agente-*.ts`).
4. Seguir el método de la sección 5.
